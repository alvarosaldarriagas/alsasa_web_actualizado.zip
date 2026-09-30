/**
 * Inactive protocol reference, 2026-09-15. NO production imports/adapters.
 * Ledger is a mandatory external transactional service, NEVER a Base44 entity.
 * These functions do not fetch, construct SDKs, create keys, or start timers.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

export const REFERENCE_ONLY = true;
export const DEFAULT_POLICY = Object.freeze({ enabled: false });
const resources = new Set(['base44_sdk_attempt', 'openai_call', 'openai_input_token', 'openai_output_token']);
const positive = n => Number.isSafeInteger(n) && n > 0;
const bounded = s => typeof s === 'string' && s.length > 0 && s.length <= 160;
const secretOK = key => Buffer.isBuffer(key) && key.length >= 32;
const mac = (key, value) => createHmac('sha256', key).update(value).digest('hex');
const canonical = e => JSON.stringify([e.version, e.app, e.channel, e.route, e.operation, e.subject,
  e.policy, e.expiresAt, e.bodyTag]);

export function bodyTag(key, bytes) {
  if (!secretOK(key) || !Buffer.isBuffer(bytes) || bytes.length > 65536) throw Error('invalid input');
  return mac(key, bytes);
}
// ONLY a trusted server may call this after input, consent and anti-bot checks.
// key/subject must never come from a browser's request JSON.
export function signEnvelope(key, fields, bytes) {
  if (!secretOK(key)) throw Error('invalid key');
  const envelope = { ...fields, version: 1, bodyTag: bodyTag(key, bytes) };
  return { ...envelope, signature: mac(key, canonical(envelope)) };
}

export function verifyEnvelope(key, e, bytes, expected, now) {
  try {
    if (!secretOK(key) || !e || e.version !== 1 || !Number.isSafeInteger(now) ||
        !Number.isSafeInteger(e.expiresAt) || e.expiresAt <= now || e.expiresAt > now + 300000 ||
        !bounded(e.operation) || !bounded(e.subject) || !bounded(e.policy) ||
        e.app !== expected.app || e.route !== expected.route || e.channel !== expected.channel ||
        !/^[a-f0-9]{64}$/.test(e.signature) || bodyTag(key, bytes) !== e.bodyTag) return false;
    return timingSafeEqual(Buffer.from(e.signature, 'hex'), Buffer.from(mac(key, canonical(e)), 'hex'));
  } catch { return false; }
}

export function validPlan(plan) {
  if (!Array.isArray(plan) || plan.length < 1 || plan.length > 32 ||
      new Set(plan.map(s => s?.id)).size !== plan.length) return false;
  const totals = {};
  return plan.every(s => {
    if (!bounded(s?.id) || !bounded(s.receiptSchema) || !s.costs || Array.isArray(s.costs) ||
        Object.keys(s.costs).length < 1) return false;
    return Object.entries(s.costs).every(([r, n]) => {
      totals[r] = (totals[r] || 0) + n;
      return resources.has(r) && positive(n) && Number.isSafeInteger(totals[r]);
    });
  });
}

// policy and plan are trusted server configuration. The reference default is closed.
export async function admit({ policy = DEFAULT_POLICY, plan, ledger, key, envelope, bytes, now }) {
  if (policy.enabled !== true) return { status: 'closed' };
  if (!validPlan(plan) || !Number.isSafeInteger(policy.startsAt) ||
      !Number.isSafeInteger(policy.endsAt) || now < policy.startsAt || now >= policy.endsAt ||
      !Number.isSafeInteger(now)) return { status: 'closed' };
  if (!verifyEnvelope(key, envelope, bytes, policy, now) || envelope.policy !== policy.id)
    return { status: 'unauthorized' };
  try {
    // Must return ONLY AFTER confirmed COMMIT on the authoritative DB writer.
    // Error / lost commit response never authorizes an effect.
    const result = await ledger.admit({
      policy: policy.id, operation: envelope.operation, channel: envelope.channel,
      subject: envelope.subject, bodyTag: envelope.bodyTag, expiresAt: envelope.expiresAt,
      plan: structuredClone(plan)
    }, now);
    return result && ['admitted', 'duplicate', 'conflict', 'limited', 'closed'].includes(result.status)
      ? result : { status: 'unavailable' };
  } catch { return { status: 'unavailable' }; }
}

/**
 * Internal executor only, not an HTTP handler. beginStep rechecks the live policy,
 * operation binding, sequence, window and expiry atomically. A fresh committed
 * claim is the ONLY execution permission. "Already claimed by same owner" is NOT.
 *
 * effect must perform exactly ONE provider request with SDK/transport retries off.
 * An abort/timeout cannot prove cancellation of that request.
 */
export async function runStep({ ledger, operation, bodyTag: tag, step, attempt, now,
  effect, validateReceipt }) {
  if (![operation, tag, step, attempt].every(bounded) ||
      typeof effect !== 'function' || typeof validateReceipt !== 'function')
    return { status: 'closed' };
  let claim;
  try { claim = await ledger.beginStep({ operation, bodyTag: tag, step, attempt }, now); }
  catch { return { status: 'unavailable' }; }
  if (!claim || claim.status !== 'claimed' || claim.operation !== operation ||
      claim.step !== step || claim.attempt !== attempt)
    return { status: claim?.status === 'confirmed' ? 'already_confirmed' : 'blocked' };
  try {
    const receipt = await effect();
    if (validateReceipt(receipt) !== true) throw Error('uncertain receipt');
    const result = await ledger.confirmStep({ operation, step, attempt }, now);
    if (result?.status !== 'confirmed') throw Error('uncertain confirmation');
    return { status: 'confirmed' };
  } catch {
    // Best effort mark. If DB is down the durable "started" state itself blocks retry.
    try { await ledger.hold({ operation, step, attempt }); } catch {}
    return { status: 'review_required' };
  }
}
