// @ts-nocheck
// INACTIVE CUTOVER CANDIDATE. Installing in base44/functions publishes immediately.
import { Buffer } from "node:buffer";

// candidates/base44/entries/captureChatLead.ts
import pg from "npm:pg@8.23.0";
import { createAxiosClient } from "npm:@base44/sdk@0.8.25/dist/utils/axios-client.js";
import { createEntitiesModule } from "npm:@base44/sdk@0.8.25/dist/modules/entities.js";

// candidates/base44/runtime/inbox-2026-09-15/capture-ledger.mjs
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
var aad = (c) => Buffer.from(JSON.stringify(["alsasa-capture-v1", c.scope, c.operation, c.bodyTag]));
function seal(key2, keyId, bytes, context) {
  if (!Buffer.isBuffer(key2) || key2.length !== 32 || !Buffer.isBuffer(bytes) || !bytes.length || bytes.length > 16384 || !/^[a-zA-Z0-9_-]{1,80}$/.test(keyId) || !context.scope || !context.operation || !/^[a-f0-9]{64}$/.test(context.bodyTag)) throw Error("Invalid encryption input");
  const iv = randomBytes(12), c = createCipheriv("aes-256-gcm", key2, iv);
  c.setAAD(aad(context));
  const ciphertext = Buffer.concat([c.update(bytes), c.final()]);
  return { alg: "AES-256-GCM", keyId, iv: iv.toString("hex"), tag: c.getAuthTag().toString("hex"), ciphertext: ciphertext.toString("hex") };
}
function unseal(key2, p, context) {
  if (!Buffer.isBuffer(key2) || key2.length !== 32 || p.alg !== "AES-256-GCM") throw Error("Invalid decryption input");
  const d = createDecipheriv("aes-256-gcm", key2, Buffer.from(p.iv, "hex"));
  d.setAAD(aad(context));
  d.setAuthTag(Buffer.from(p.tag, "hex"));
  return Buffer.concat([d.update(Buffer.from(p.ciphertext, "hex")), d.final()]);
}
var CaptureLedger = class {
  constructor(pool, scope) {
    this.pool = pool;
    this.scope = scope;
  }
  async call(action, p) {
    const c = await this.pool.connect();
    let broken = false;
    try {
      await c.query("BEGIN");
      await c.query("SET LOCAL statement_timeout='5s'");
      await c.query("SET LOCAL synchronous_commit=on");
      const result = (await c.query("SELECT alsasa_guard_v1.capture($1,$2,$3::jsonb) AS r", [this.scope, action, JSON.stringify(p)])).rows[0].r;
      if ((await c.query("COMMIT")).command !== "COMMIT") throw Error("Unconfirmed commit");
      return result;
    } catch (e) {
      broken = true;
      try {
        await c.query("ROLLBACK");
      } catch {
      }
      throw e;
    } finally {
      c.release(broken);
    }
  }
};

// candidates/base44/runtime/inbox-2026-09-15/keyring.mjs
var idOK = (x) => typeof x === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(x);
var InboxKeyring = class {
  #keys = /* @__PURE__ */ new Map();
  #active;
  #destroyed = false;
  constructor({ activeId, entries, requiredKeyIds, signingKey } = {}) {
    if (!idOK(activeId) || !Array.isArray(entries) || !entries.length || entries.length > 32 || !Array.isArray(requiredKeyIds) || !requiredKeyIds.every(idOK) || !Buffer.isBuffer(signingKey) || signingKey.length < 32) throw Error("Invalid key configuration");
    const ids = /* @__PURE__ */ new Set(), materials = /* @__PURE__ */ new Set();
    for (const e of entries) {
      if (!e || !idOK(e.id) || ids.has(e.id) || !Buffer.isBuffer(e.key) || e.key.length !== 32 || signingKey.equals(e.key) || materials.has(e.key.toString("hex"))) throw Error("Invalid key configuration");
      ids.add(e.id);
      materials.add(e.key.toString("hex"));
    }
    if (!ids.has(activeId) || requiredKeyIds.some((id4) => !ids.has(id4))) throw Error("Required key unavailable");
    for (const e of entries) this.#keys.set(e.id, Buffer.from(e.key));
    this.#active = activeId;
  }
  #get(id4) {
    if (this.#destroyed || !idOK(id4) || !this.#keys.has(id4)) throw Error("Key unavailable");
    return this.#keys.get(id4);
  }
  encrypt(bytes, context) {
    return seal(this.#get(this.#active), this.#active, bytes, context);
  }
  decrypt(payload, context) {
    if (!payload || payload.alg !== "AES-256-GCM" || !idOK(payload.keyId) || typeof payload.iv !== "string" || !/^[a-f0-9]{24}$/.test(payload.iv) || typeof payload.tag !== "string" || !/^[a-f0-9]{32}$/.test(payload.tag) || typeof payload.ciphertext !== "string" || payload.ciphertext.length < 2 || payload.ciphertext.length > 32768 || payload.ciphertext.length % 2 || !/^[a-f0-9]+$/.test(payload.ciphertext)) throw Error("Invalid encrypted payload");
    return unseal(this.#get(payload.keyId), payload, context);
  }
  bind(ledger, bytes) {
    const copy = Buffer.from(bytes);
    return { admit: (request) => ledger.call("admit", { ...request, payload: this.encrypt(copy, { scope: ledger.scope, operation: request.operation, bodyTag: request.bodyTag }) }) };
  }
  destroy() {
    for (const k of this.#keys.values()) k.fill(0);
    this.#keys.clear();
    this.#destroyed = true;
  }
};

// candidates/base44/runtime-config.mjs
var validId = (x) => typeof x === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(x);
var key = (x) => {
  if (typeof x !== "string" || !/^[a-f0-9]{64}$/.test(x)) throw Error("Invalid receiver configuration");
  return Buffer.from(x, "hex");
};
function database(raw, role) {
  const u = new URL(raw);
  if (!["postgres:", "postgresql:"].includes(u.protocol) || !/^ep-[a-z0-9-]+-pooler\.[a-z0-9.-]+\.neon\.tech$/.test(u.hostname) || decodeURIComponent(u.username) !== role || !u.password || !/^\/[a-zA-Z0-9_]+$/.test(u.pathname) || u.port && u.port !== "5432") throw Error("Invalid receiver database");
  return {
    host: u.hostname,
    port: 5432,
    database: u.pathname.slice(1),
    user: role,
    password: decodeURIComponent(u.password),
    ssl: { rejectUnauthorized: true, servername: u.hostname },
    max: 4,
    connectionTimeoutMillis: 5e3,
    idleTimeoutMillis: 5e3,
    statement_timeout: 5e3,
    query_timeout: 6e3
  };
}
function readReceiverConfig(env) {
  if (env.ALSASA_CAPTURE_ENABLED !== "true") return null;
  const scope = env.ALSASA_CAPTURE_SCOPE, id4 = env.ALSASA_CAPTURE_POLICY;
  if (!validId(scope) || !validId(id4)) throw Error("Invalid receiver policy");
  const startsAt = Date.parse(env.ALSASA_CAPTURE_STARTS_AT), endsAt = Date.parse(env.ALSASA_CAPTURE_ENDS_AT);
  if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt) || endsAt <= startsAt || endsAt - startsAt > 864e5) throw Error("Invalid pilot window");
  const signingKey = key(env.ALSASA_CAPTURE_SIGNING_KEY), identityKey = key(env.ALSASA_CAPTURE_IDENTITY_KEY);
  if (signingKey.equals(identityKey)) throw Error("Key reuse");
  if (typeof env.ALSASA_CAPTURE_KEYRING_JSON !== "string" || env.ALSASA_CAPTURE_KEYRING_JSON.length > 12e3) throw Error("Invalid keyring");
  const configured = JSON.parse(env.ALSASA_CAPTURE_KEYRING_JSON);
  if (!Array.isArray(configured.entries)) throw Error("Invalid keyring");
  const entries = configured.entries.map((e) => ({ id: e.id, key: key(e.key) }));
  if (entries.some((e) => e.key.equals(identityKey))) throw Error("Key reuse");
  const ring = { activeId: configured.activeId, entries, requiredKeyIds: [], signingKey };
  new InboxKeyring(ring).destroy();
  const admission = database(env.ALSASA_CAPTURE_ADMISSION_DATABASE_URL, "alsasa_capture_admit");
  const execution = database(env.ALSASA_CAPTURE_EXECUTION_DATABASE_URL, "alsasa_capture_exec");
  if (admission.host !== execution.host || admission.database !== execution.database) throw Error("Database mismatch");
  return {
    scope,
    policy: { id: id4, enabled: true, startsAt, endsAt },
    signingKey,
    identityKey,
    ring,
    admission,
    execution,
    serverUrl: "https://base44.app"
  };
}

// candidates/base44/inventory-ledger.mjs
var InventoryAdmissionLedger = class {
  constructor(pool, scope, keyIds) {
    this.pool = pool;
    this.scope = scope;
    this.keys = new Set(keyIds);
  }
  async call(action, request) {
    if (action !== "admit" || !this.keys.has(request?.payload?.keyId)) throw Error("Invalid admission");
    const c = await this.pool.connect();
    let broken = false;
    try {
      await c.query("BEGIN");
      await c.query("SET LOCAL statement_timeout='5s'");
      await c.query("SET LOCAL lock_timeout='3s'");
      await c.query("SET LOCAL synchronous_commit=on");
      const inventory = (await c.query("SELECT alsasa_guard_v1.required_capture_keys($1) AS keys", [this.scope])).rows[0]?.keys;
      if (!Array.isArray(inventory) || inventory.length > 32 || inventory.some((id4) => !this.keys.has(id4))) throw Error("Required key unavailable");
      const result = (await c.query("SELECT alsasa_guard_v1.capture($1,$2,$3::jsonb) AS r", [this.scope, action, JSON.stringify(request)])).rows[0]?.r;
      if (!result || typeof result.status !== "string") throw Error("Invalid admission receipt");
      if ((await c.query("COMMIT")).command !== "COMMIT") throw Error("Unconfirmed admission");
      return result;
    } catch (error) {
      broken = true;
      try {
        await c.query("ROLLBACK");
      } catch {
      }
      throw error;
    } finally {
      c.release(broken);
    }
  }
};

// lib/capture-contract.mjs
var CAPTURE_ROUTES = Object.freeze({
  form: Object.freeze({ app: "68b1e87f22e7326f9f762688", channel: "web-contact", route: "publicApi" }),
  chat: Object.freeze({ app: "68b1e87f22e7326f9f762688", channel: "chat-capture", route: "captureChatLead" })
});

// candidates/base44/capture-router.mjs
function createCaptureRouter({ kind, receiver: receiver2, readPublic } = {}) {
  const binding = CAPTURE_ROUTES[kind];
  const reply4 = (status, code) => Response.json({ success: false, code }, {
    status,
    headers: { "Cache-Control": "no-store" }
  });
  return async (request) => {
    if (!binding) return reply4(503, "unconfigured");
    const paths = [`/functions/${binding.route}`, `/api/apps/${binding.app}/functions/${binding.route}`];
    if (!paths.includes(new URL(request.url).pathname)) return reply4(404, "route_not_found");
    if (["GET", "OPTIONS"].includes(request.method) && kind === "form" && typeof readPublic === "function") return readPublic(request);
    if (request.method !== "POST") return reply4(405, "method_not_allowed");
    if (typeof receiver2?.handle !== "function") return reply4(503, "paused");
    try {
      return await receiver2.handle(request);
    } catch {
      return reply4(503, "temporarily_unavailable");
    }
  };
}

// candidates/base44/runtime/redesign-2026-09-15/protocol-reference.mjs
import { createHmac, timingSafeEqual } from "node:crypto";
var DEFAULT_POLICY = Object.freeze({ enabled: false });
var resources = /* @__PURE__ */ new Set(["base44_sdk_attempt", "openai_call", "openai_input_token", "openai_output_token"]);
var positive = (n) => Number.isSafeInteger(n) && n > 0;
var bounded = (s) => typeof s === "string" && s.length > 0 && s.length <= 160;
var secretOK = (key2) => Buffer.isBuffer(key2) && key2.length >= 32;
var mac = (key2, value) => createHmac("sha256", key2).update(value).digest("hex");
var canonical = (e) => JSON.stringify([
  e.version,
  e.app,
  e.channel,
  e.route,
  e.operation,
  e.subject,
  e.policy,
  e.expiresAt,
  e.bodyTag
]);
function bodyTag(key2, bytes) {
  if (!secretOK(key2) || !Buffer.isBuffer(bytes) || bytes.length > 65536) throw Error("invalid input");
  return mac(key2, bytes);
}
function verifyEnvelope(key2, e, bytes, expected, now) {
  try {
    if (!secretOK(key2) || !e || e.version !== 1 || !Number.isSafeInteger(now) || !Number.isSafeInteger(e.expiresAt) || e.expiresAt <= now || e.expiresAt > now + 3e5 || !bounded(e.operation) || !bounded(e.subject) || !bounded(e.policy) || e.app !== expected.app || e.route !== expected.route || e.channel !== expected.channel || !/^[a-f0-9]{64}$/.test(e.signature) || bodyTag(key2, bytes) !== e.bodyTag) return false;
    return timingSafeEqual(Buffer.from(e.signature, "hex"), Buffer.from(mac(key2, canonical(e)), "hex"));
  } catch {
    return false;
  }
}
function validPlan(plan) {
  if (!Array.isArray(plan) || plan.length < 1 || plan.length > 32 || new Set(plan.map((s) => s?.id)).size !== plan.length) return false;
  const totals = {};
  return plan.every((s) => {
    if (!bounded(s?.id) || !bounded(s.receiptSchema) || !s.costs || Array.isArray(s.costs) || Object.keys(s.costs).length < 1) return false;
    return Object.entries(s.costs).every(([r, n]) => {
      totals[r] = (totals[r] || 0) + n;
      return resources.has(r) && positive(n) && Number.isSafeInteger(totals[r]);
    });
  });
}
async function admit({ policy = DEFAULT_POLICY, plan, ledger, key: key2, envelope, bytes, now }) {
  if (policy.enabled !== true) return { status: "closed" };
  if (!validPlan(plan) || !Number.isSafeInteger(policy.startsAt) || !Number.isSafeInteger(policy.endsAt) || now < policy.startsAt || now >= policy.endsAt || !Number.isSafeInteger(now)) return { status: "closed" };
  if (!verifyEnvelope(key2, envelope, bytes, policy, now) || envelope.policy !== policy.id)
    return { status: "unauthorized" };
  try {
    const result = await ledger.admit({
      policy: policy.id,
      operation: envelope.operation,
      channel: envelope.channel,
      subject: envelope.subject,
      bodyTag: envelope.bodyTag,
      expiresAt: envelope.expiresAt,
      plan: structuredClone(plan)
    }, now);
    return result && ["admitted", "duplicate", "conflict", "limited", "closed"].includes(result.status) ? result : { status: "unavailable" };
  } catch {
    return { status: "unavailable" };
  }
}

// candidates/base44/runtime/http-2026-09-15/internal-receiver.mjs
var APP = "68b1e87f22e7326f9f762688";
var ROUTES = Object.freeze({
  form: { app: APP, channel: "web-contact", route: "publicApi", paths: ["/functions/publicApi", "/api/apps/" + APP + "/functions/publicApi"] },
  chat: { app: APP, channel: "chat-capture", route: "captureChatLead", paths: ["/functions/captureChatLead", "/api/apps/" + APP + "/functions/captureChatLead"] }
});
var reply = (status, code) => Response.json({ success: false, code }, { status, headers: { "Cache-Control": "no-store" } });
async function boundedBody(req, maximum = 16384, deadline = 2e3) {
  if (req.headers.get("content-encoding") && req.headers.get("content-encoding") !== "identity") throw Error("encoding");
  const length = req.headers.get("content-length");
  if (length !== null && (!/^[0-9]+$/.test(length) || Number(length) > maximum)) throw Error("size");
  if (!req.body) throw Error("empty");
  const reader = req.body.getReader();
  let timer, total = 0;
  const parts = [];
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(Error("deadline")), deadline);
  });
  try {
    for (; ; ) {
      const { done, value } = await Promise.race([reader.read(), timeout]);
      if (done) break;
      total += value.byteLength;
      if (total > maximum) throw Error("size");
      parts.push(Buffer.from(value));
    }
    return Buffer.concat(parts);
  } finally {
    clearTimeout(timer);
    void reader.cancel().catch(() => {
    });
  }
}
function createInternalReceiver({ kind, policy = { enabled: false }, ledger, ledgerForBytes, key: key2, validate, now = Date.now } = {}) {
  const binding = ROUTES[kind];
  return async (req) => {
    if (!binding || policy.enabled !== true) return reply(503, "paused");
    if (typeof validate !== "function" || !ledger && typeof ledgerForBytes !== "function" || !Buffer.isBuffer(key2) || key2.length < 32) return reply(503, "unconfigured");
    if (req.method !== "POST") return reply(405, "method_not_allowed");
    if (!binding.paths.includes(new URL(req.url).pathname)) return reply(404, "route_not_found");
    if (req.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return reply(415, "json_required");
    const header = req.headers.get("x-alsasa-envelope");
    if (!header || header.length > 2048) return reply(401, "authorization_required");
    let envelope, bytes, body;
    try {
      envelope = JSON.parse(header);
      bytes = await boundedBody(req);
    } catch {
      return reply(400, "invalid_request");
    }
    const timestamp = now();
    if (!verifyEnvelope(key2, envelope, bytes, binding, timestamp)) return reply(401, "invalid_authorization");
    if (!/^[a-f0-9]{64}$/.test(envelope.subject)) return reply(401, "invalid_authorization");
    try {
      body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
      if (!body || typeof body !== "object" || Array.isArray(body) || body.consent !== true) return reply(400, "consent_required");
      if (await validate(body) !== true) return reply(400, "invalid_fields");
    } catch {
      return reply(400, "invalid_fields");
    }
    let requestLedger;
    try {
      requestLedger = ledgerForBytes ? await ledgerForBytes(Buffer.from(bytes)) : ledger;
    } catch {
      return reply(503, "temporarily_unavailable");
    }
    const result = await admit({ policy: { ...policy, ...binding }, plan: policy.plan, ledger: requestLedger, key: key2, envelope, bytes, now: timestamp });
    const statuses = {
      admitted: [202, "reserved_not_delivered"],
      duplicate: [202, "already_reserved_not_confirmed"],
      conflict: [409, "operation_conflict"],
      limited: [429, "limit_reached"],
      closed: [503, "paused"],
      unauthorized: [401, "invalid_authorization"],
      unavailable: [503, "temporarily_unavailable"]
    };
    return reply(...statuses[result.status] ?? [503, "temporarily_unavailable"]);
  };
}

// candidates/base44/runtime/inbox-2026-09-15/rotating-receiver.mjs
function createRotatingReceiver({ kind, policy, key: key2, validate, now, ledger, activeId, entries, requiredKeyIds } = {}) {
  let ring;
  try {
    if (!ledger || typeof ledger.call !== "function" || typeof ledger.scope !== "string" || !ledger.scope) throw Error("configuration");
    ring = new InboxKeyring({ activeId, entries, requiredKeyIds, signingKey: key2 });
  } catch {
    return { handle: async () => Response.json({ success: false, code: "unconfigured" }, { status: 503, headers: { "Cache-Control": "no-store" } }), close() {
    } };
  }
  const handle = createInternalReceiver({ kind, policy, key: key2, validate, now, ledgerForBytes: (bytes) => ring.bind(ledger, bytes) });
  return {
    async handle(req) {
      const r = await handle(req), body = await r.json();
      if (r.status === 202) {
        body.code = body.code === "reserved_not_delivered" ? "stored_pending_delivery" : "already_stored_pending_confirmation";
        body.stored = true;
        body.delivered = false;
      }
      return Response.json(body, { status: r.status, headers: { "Cache-Control": "no-store" } });
    },
    close() {
      ring.destroy();
    }
  };
}

// candidates/base44/runtime/validation-2026-09-17/capture-validator.mjs
var own = (o, keys) => o !== null && typeof o === "object" && !Array.isArray(o) && Object.getPrototypeOf(o) === Object.prototype && Object.keys(o).every((k) => keys.includes(k));
var text = (v, max, required = false) => v == null ? !required : typeof v === "string" && v.length <= max && (!required || v.trim().length > 0) && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v);
var number = (v, max = Number.MAX_SAFE_INTEGER) => v == null || v === "" || (typeof v === "number" || typeof v === "string" && /^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(v)) && Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= max;
var list = (v, n, max) => v == null || Array.isArray(v) && v.length <= n && v.every((x) => text(x, max, true));
var budgets = (o) => number(o.budget_min) && number(o.budget_max) && (!(o.budget_min != null && o.budget_min !== "" && o.budget_max != null && o.budget_max !== "") || Number(o.budget_min) <= Number(o.budget_max));
var email = (v) => text(v, 160, true) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
var intents = ["buy", "rent", "sell", "landlord", "invest", "valuation", "human", "information", "other"];
function validateCapture(kind, b) {
  try {
    const common = ["email", "phone", "consent"];
    if (!own(b, kind === "form" ? [...common, "full_name", "message", "source", "lead_type", "property_id", "budget_min", "budget_max", "preferred_areas"] : kind === "chat" ? [...common, "name", "qualification", "messages"] : [])) return false;
    if (b.consent !== true || !email(b.email) || !text(b.phone, 25)) return false;
    if (kind === "form") return text(b.full_name, 120, true) && text(b.message, 1500) && text(b.source, 80) && text(b.lead_type, 80) && text(b.property_id, 100) && budgets(b) && list(b.preferred_areas, 10, 120);
    if (kind !== "chat" || !text(b.name, 120, true)) return false;
    const q = b.qualification ?? {};
    if (!own(q, ["intent", "property_ids", "preferred_areas", "lead_score", "budget_min", "budget_max", "budget_range", "urgency"]) || !(q.intent == null || q.intent === "" || intents.includes(q.intent)) || !list(q.property_ids, 10, 100) || !list(q.preferred_areas, 10, 120) || !number(q.lead_score, 100) || !budgets(q) || !text(q.budget_range, 200) || !text(q.urgency, 120)) return false;
    const messages = b.messages ?? [];
    return Array.isArray(messages) && messages.length <= 30 && messages.every((m) => own(m, ["role", "content"]) && ["user", "bot", "assistant"].includes(m.role) && text(m.content, 2e3, true)) && messages.reduce((n, m) => n + m.content.length, 0) <= 3e4;
  } catch {
    return false;
  }
}

// candidates/base44/runtime/validation-2026-09-17/validated-receiver.mjs
function createValidatedReceiver(config = {}) {
  const kind = config.kind;
  return createRotatingReceiver({ ...config, validate: (body) => validateCapture(kind, body) });
}

// candidates/base44/runtime/commercial-2026-09-19/commercial-flow.mjs
import { randomUUID as randomUUID2, createHash as createHash3, createHmac as createHmac3 } from "node:crypto";

// candidates/base44/runtime/commercial-2026-09-19/client-flow.mjs
import { randomUUID, createHash as createHash2 } from "node:crypto";

// candidates/base44/runtime/commercial-2026-09-19/identity-guard.mjs
import { createHmac as createHmac2 } from "node:crypto";
function clientIdentityTag(key2, email2) {
  if (!Buffer.isBuffer(key2) || key2.length < 32 || typeof email2 !== "string" || email2.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email2.trim())) throw Error("Invalid identity");
  return createHmac2("sha256", key2).update(JSON.stringify(["alsasa-client-email-v1", email2.trim().toLowerCase()])).digest("hex");
}
var IdentityLedger = class {
  constructor(pool, scope) {
    this.pool = pool;
    this.scope = scope;
  }
  async call(action, request) {
    const c = await this.pool.connect();
    let broken = false;
    try {
      await c.query("BEGIN");
      await c.query("SET LOCAL statement_timeout='5s'");
      await c.query("SET LOCAL synchronous_commit=on");
      const r = (await c.query("SELECT alsasa_guard_v1.identity_guard($1,$2,$3::jsonb) AS result", [this.scope, action, JSON.stringify(request)])).rows[0].result;
      if ((await c.query("COMMIT")).command !== "COMMIT") throw Error("Unconfirmed commit");
      return r;
    } catch (e) {
      broken = true;
      try {
        await c.query("ROLLBACK");
      } catch {
      }
      throw e;
    } finally {
      c.release(broken);
    }
  }
};

// candidates/base44/runtime/crm-2026-09-17/crm-step.mjs
import { createHash } from "node:crypto";

// candidates/base44/runtime/postgres-2026-09-15/execute-step.mjs
async function executeStep({ ledger, request, effect, validateReceipt, receiptTag: receiptTag2 }) {
  if (typeof effect !== "function" || typeof validateReceipt !== "function" || typeof receiptTag2 !== "function")
    return { status: "closed" };
  let claim;
  try {
    claim = await ledger.beginStep(request);
  } catch {
    return { status: "unavailable" };
  }
  if (!claim || claim.status !== "claimed" || claim.operation !== request.operation || claim.step !== request.step || claim.attempt !== request.attempt)
    return { status: claim?.status === "confirmed" ? "already_confirmed" : "blocked" };
  try {
    const receipt = await effect();
    if (validateReceipt(receipt) !== true) throw Error("Incomplete receipt");
    const tag = receiptTag2(receipt);
    if (typeof tag !== "string" || !/^[a-f0-9]{64}$/.test(tag)) throw Error("Invalid receipt tag");
    const ack = await ledger.confirmStep({ ...request, receiptTag: tag });
    if (ack.status !== "confirmed") throw Error("Confirmation failed");
    return { status: "confirmed" };
  } catch {
    try {
      await ledger.hold(request);
    } catch {
    }
    return { status: "review_required" };
  }
}

// candidates/base44/runtime/crm-2026-09-17/crm-step.mjs
var allowed = { Property: ["filter"], Client: ["filter", "create"], Interaction: ["filter", "create"], CommunicationLog: ["create"], Opportunity: ["filter", "create"], ChatConversation: ["create"] };
var id = (x) => typeof x === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(x);
function prepareCrmStep({ entities, entity, method, args, validateReceipt } = {}) {
  if (!Object.hasOwn(allowed, entity) || !allowed[entity].includes(method) || !Array.isArray(args) || typeof validateReceipt !== "function") throw Error("Unapproved CRM step");
  if (method === "create" && args.length !== 1 || method === "filter" && (args.length < 1 || args.length > 5)) throw Error("Invalid arguments");
  const encoded = JSON.stringify(args);
  if (!encoded || Buffer.byteLength(encoded) > 32768) throw Error("Arguments too large");
  const snapshot = JSON.parse(encoded);
  const handler = entities?.[entity], invoke = handler?.[method];
  if (typeof invoke !== "function") throw Error("Missing SDK method");
  let used = false;
  return async ({ ledger, request }) => {
    if (used) return { status: "blocked" };
    used = true;
    let receipt;
    const result = await executeStep({
      ledger,
      request,
      effect: async () => {
        receipt = await invoke.apply(handler, JSON.parse(JSON.stringify(snapshot)));
        return receipt;
      },
      validateReceipt: (r) => (method === "create" ? r !== null && typeof r === "object" && !Array.isArray(r) && id(r.id) : Array.isArray(r) && r.every((x) => x && id(x.id))) && validateReceipt(r) === true,
      receiptTag: (r) => createHash("sha256").update(JSON.stringify({ entity, method, receipt: r })).digest("hex")
    });
    return result.status === "confirmed" ? { ...result, receipt } : result;
  };
}

// candidates/base44/runtime/commercial-2026-09-19/client-flow.mjs
var id2 = (x) => typeof x === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(x);
var receiptTag = (method, receipt) => createHash2("sha256").update(JSON.stringify({ entity: "Client", method, receipt })).digest("hex");
function clientPlan(kind) {
  const r = ROUTES[kind];
  if (!r) throw Error("Invalid route");
  return ["filter", "create"].map((method, n) => ({
    id: n ? "client-create" : "client-lookup",
    receiptSchema: n ? "client-created-v1" : "client-lookup-v1",
    costs: { base44_sdk_attempt: 1 },
    binding: { app: r.app, channel: r.channel, route: r.route, version: "client-resolution-v1", entity: "Client", method },
    ...n ? { condition: { type: "create_if_no_client", lookupStep: "client-lookup", version: "v1" } } : {}
  }));
}
async function resolveClientStage({ kind, body, operation, dispatch, captureTag, steps, identity, branch, identityKey, entities }) {
  let request, ownsIdentity = false;
  if (!validateCapture(kind, body)) throw Error("Invalid capture");
  try {
    const email2 = body.email.trim().toLowerCase();
    request = { operation, dispatch, identityTag: clientIdentityTag(identityKey, email2) };
    const claim = await identity.call("claim", request);
    if (!["claimed", "resolved"].includes(claim?.status) || claim.status === "resolved" && !id2(claim.clientId)) throw Error("Identity unavailable");
    ownsIdentity = claim.status === "claimed";
    const run = async (method, args, validateReceipt, step) => {
      const r = await prepareCrmStep({ entities, entity: "Client", method, args, validateReceipt })({ ledger: steps, request: { operation, step, attempt: randomUUID(), bodyTag: captureTag } });
      if (r.status !== "confirmed") throw Error("Unconfirmed CRM step");
      return { clientId: method === "filter" ? r.receipt[0]?.id : r.receipt.id, receipt: r.receipt, step, receiptTag: receiptTag(method, r.receipt) };
    };
    const found = await run(
      "filter",
      [{ email: email2 }, "-created_date", 2, 0, ["id", "email"]],
      (rows) => Array.isArray(rows) && rows.length <= 2 && rows.every((r) => id2(r.id) && typeof r.email === "string" && r.email.trim().toLowerCase() === email2),
      "client-lookup"
    );
    if (found.receipt.length > 1) throw Error("Ambiguous lookup");
    if (!ownsIdentity && (found.receipt.length !== 1 || found.clientId !== claim.clientId)) throw Error("Mapping mismatch");
    let resolved = found, origin = "existing";
    if (found.receipt.length === 0) {
      if (!ownsIdentity) throw Error("No ownership");
      const data = {
        full_name: (kind === "form" ? body.full_name : body.name).trim(),
        email: email2,
        ...body.phone ? { phone: body.phone, whatsapp: body.phone } : {},
        source: kind === "form" ? body.source || "web" : "web",
        status: "potential",
        client_type: kind === "form" ? "buyer" : { rent: "tenant", sell: "seller", valuation: "seller", landlord: "landlord", buy: "buyer", invest: "buyer" }[body.qualification?.intent] || "all",
        ...kind === "chat" ? {
          communication_preferences: body.phone ? ["whatsapp", "email"] : ["email"],
          lead_score: Number(body.qualification?.lead_score || 0),
          ...body.qualification?.budget_min != null && body.qualification.budget_min !== "" ? { budget_min: Number(body.qualification.budget_min) } : {},
          ...body.qualification?.budget_max != null && body.qualification.budget_max !== "" ? { budget_max: Number(body.qualification.budget_max) } : {},
          preferred_areas: body.qualification?.preferred_areas || [],
          notes: "Lead del bot web. Identidad pendiente de verificaci\xF3n por un asesor."
        } : {}
      };
      resolved = await run("create", [data], (r) => r && typeof r.email === "string" && r.email.trim().toLowerCase() === email2, "client-create");
      origin = "created";
    }
    if (ownsIdentity) {
      const ack = await identity.call("resolve", { ...request, clientId: resolved.clientId, step: resolved.step, receiptTag: resolved.receiptTag });
      if (ack?.status !== "resolved" || ack.clientId !== resolved.clientId) throw Error("Identity resolution unconfirmed");
    }
    if (origin === "existing") {
      const ack = await branch.skip({ ...request, bodyTag: captureTag, step: "client-create", lookupStep: "client-lookup", clientId: found.clientId, receiptTag: found.receiptTag });
      if (ack?.status !== "skipped" || ack.reason !== "existing_client_no_create") throw Error("Branch unconfirmed");
    }
    return { status: "client_resolved", clientId: resolved.clientId, origin, identityVerified: false, delivered: false };
  } catch (e) {
    if (ownsIdentity && request) {
      try {
        await identity.call("review", request);
      } catch {
      }
    }
    throw e;
  }
}

// candidates/base44/runtime/commercial-2026-09-19/commercial-flow.mjs
var id3 = (x) => typeof x === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(x);
var normalized = (x) => Array.isArray(x) ? x.map(normalized) : x && typeof x === "object" ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, normalized(x[k])])) : x;
var same = (a, b) => JSON.stringify(normalized(a)) === JSON.stringify(normalized(b));
var hash = (entity, method, receipt) => createHash3("sha256").update(JSON.stringify({ entity, method, receipt })).digest("hex");
var stages = ["nuevo", "calificado", "propuesta", "negociacion", "ganado", "perdido"];
function commercialPlan(kind) {
  const r = ROUTES[kind];
  if (!r) throw Error("Invalid kind");
  const step = (id4, entity, method, condition) => ({
    id: id4,
    receiptSchema: id4 + "-v1",
    costs: { base44_sdk_attempt: 1 },
    binding: { app: r.app, channel: r.channel, route: r.route, version: "commercial-v1", entity, method },
    ...condition ? { condition } : {}
  });
  return [
    ...Array.from({ length: kind === "form" ? 1 : 10 }, (_, index) => step("property-" + index, "Property", "filter", { type: "property_slot", index })),
    ...clientPlan(kind),
    step("communication", "CommunicationLog", "create"),
    ...kind === "chat" ? [step("conversation", "ChatConversation", "create")] : [],
    step("opportunity-lookup", "Opportunity", "filter", { type: "opportunity_required" }),
    step("opportunity-create", "Opportunity", "create", { type: "opportunity_create", lookupStep: "opportunity-lookup", version: "v1" }),
    step("interaction", "Interaction", "create")
  ];
}
function createCommercialFlow({ enabled = false, kind, policyId, inbox, steps, identity, branch, commercial, keyring, signingKey, identityKey, entities } = {}) {
  let plan;
  try {
    plan = commercialPlan(kind);
  } catch {
  }
  const configured = plan && id3(policyId) && inbox && typeof inbox.call === "function" && typeof inbox.scope === "string" && [steps, identity, branch, commercial].every((x) => x && x.scope === inbox.scope) && typeof steps.beginStep === "function" && typeof identity.call === "function" && typeof branch.skip === "function" && typeof commercial.call === "function" && keyring && typeof keyring.decrypt === "function" && Buffer.isBuffer(signingKey) && signingKey.length >= 32 && Buffer.isBuffer(identityKey) && identityKey.length >= 32 && !identityKey.equals(signingKey) && plan.every((s) => typeof entities?.[s.binding.entity]?.[s.binding.method] === "function");
  return async (operation) => {
    if (!enabled || !configured) return { status: "closed", delivered: false };
    if (!id3(operation)) return { status: "blocked", delivered: false };
    const dispatch = randomUUID2();
    let capture, request;
    try {
      capture = await inbox.call("dispatch", { operation, dispatch });
    } catch {
      return { status: "unavailable", delivered: false };
    }
    if (capture?.status !== "claimed") return { status: "blocked", delivered: false };
    try {
      if (capture.channel !== ROUTES[kind].channel || capture.policy !== policyId || !same(capture.plan, plan)) throw Error("Binding mismatch");
      const bytes = keyring.decrypt(capture.payload, { scope: inbox.scope, operation, bodyTag: capture.bodyTag });
      if (bodyTag(signingKey, bytes) !== capture.bodyTag) throw Error("Body mismatch");
      const body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
      if (!validateCapture(kind, body)) throw Error("Invalid body");
      const email2 = body.email.trim().toLowerCase(), name = (kind === "form" ? body.full_name : body.name).trim();
      request = { operation, dispatch, bodyTag: capture.bodyTag, identityTag: clientIdentityTag(identityKey, email2) };
      if ((await commercial.call("claim", request))?.status !== "claimed") throw Error("Commercial lock unavailable");
      const run = async (step, args, validateReceipt) => {
        const descriptor = plan.find((s) => s.id === step);
        if (!descriptor) throw Error("Undeclared step");
        const { entity, method } = descriptor.binding;
        const r = await prepareCrmStep({ entities, entity, method, args, validateReceipt })({ ledger: steps, request: { operation, step, attempt: randomUUID2(), bodyTag: capture.bodyTag } });
        if (r.status !== "confirmed") throw Error("Step unconfirmed");
        return { ...r, step, receiptTag: hash(entity, method, r.receipt) };
      };
      const create = async (step, data) => run(step, [data], (r) => Object.entries(data).every(([k, v]) => same(r[k], v)));
      const omit = async (step, reason, evidence = {}) => {
        const r = await commercial.call("omit", { ...request, step, reason, ...evidence });
        if (r?.status !== "skipped" || r.reason !== reason) throw Error("Omission unconfirmed");
      };
      const refs = [...new Set((kind === "form" ? body.property_id ? [body.property_id] : [] : body.qualification?.property_ids || []).map((x) => x.trim()))];
      if (refs.some((x) => !id3(x))) throw Error("Invalid property reference");
      const propertyIds = [], pendingReferences = [];
      for (let n = 0; n < (kind === "form" ? 1 : 10); n++) {
        const ref = refs[n], step = "property-" + n;
        if (!ref) {
          await omit(step, "no_declared_property", { index: n });
          continue;
        }
        const code = /^A[1-9]\d{2,9}$/i.test(ref) ? ref.toUpperCase() : null;
        const q2 = { ...code ? { custom_id: code } : { id: ref }, web_visible: true, status: "available" };
        const r = await run(step, [q2, "-created_date", 2, 0, ["id", "custom_id", "web_visible", "status"]], (rows) => Array.isArray(rows) && rows.length <= 2 && rows.every((x) => id3(x.id) && x.web_visible === true && x.status === "available" && (code ? x.custom_id === code : x.id === ref)));
        if (r.receipt.length === 1) {
          propertyIds.push(r.receipt[0].id);
        } else if (code && kind === "form" && r.receipt.length === 0) pendingReferences.push(code);
        else throw Error("Unverified or ambiguous property");
      }
      const client = await resolveClientStage({ kind, body, operation, dispatch, captureTag: capture.bodyTag, steps, identity, branch, identityKey, entities });
      if (client.status !== "client_resolved" || !id3(client.clientId)) throw Error("Client unresolved");
      const q = kind === "chat" ? body.qualification || {} : body, intent = kind === "chat" ? q.intent || "information" : "information";
      const ids = [...new Set(propertyIds)].sort(), now = (/* @__PURE__ */ new Date()).toISOString(), score = Number(q.lead_score || 0);
      const details = "Solicitud p\xFAblica: identidad y datos pendientes de verificaci\xF3n por un asesor. " + JSON.stringify({
        operation,
        channel: kind,
        name,
        email: email2,
        phone: body.phone || "",
        message: body.message || "",
        intent,
        property_ids: ids,
        property_references_pending: pendingReferences,
        source: body.source || "web",
        lead_type: body.lead_type || "contacto",
        budget_min: q.budget_min,
        budget_max: q.budget_max,
        preferred_areas: q.preferred_areas || []
      });
      const communication = await create("communication", {
        client_id: client.clientId,
        communication_type: body.phone ? "whatsapp" : "email",
        direction: "inbound",
        subject: "Solicitud recibida por " + (kind === "chat" ? "chat web" : "formulario web"),
        message: details,
        status: "delivered",
        sent_at: now,
        ai_generated: false
      });
      let conversation;
      if (kind === "chat") conversation = await create("conversation", {
        visitor_name: name,
        visitor_email: email2,
        visitor_phone: body.phone || "",
        messages: body.messages || [],
        lead_score: score,
        qualification: score >= 75 ? "hot" : score >= 50 ? "warm" : "cold",
        intent: ["buy", "rent", "information"].includes(intent) ? intent : "other",
        budget_range: q.budget_range || "",
        preferred_areas: q.preferred_areas || [],
        status: "converted",
        converted_to_client_id: client.clientId,
        last_interaction: now
      });
      let opportunityId;
      if (kind === "form" && !ids.length) {
        await omit("opportunity-lookup", "no_verified_property");
        await omit("opportunity-create", "no_verified_property");
      } else {
        const interestTag = createHmac3("sha256", identityKey).update(JSON.stringify(["alsasa-interest-v1", client.clientId, ids, ids.length ? "property" : intent])).digest("hex");
        const mapping = await commercial.call("mapping", { ...request, interestTag });
        if (mapping?.status !== "mapping" || mapping.opportunityId !== null && !id3(mapping.opportunityId)) throw Error("Mapping unavailable");
        const known = mapping.opportunityId, marker = "[alsasa-interest:" + interestTag + "]";
        const found = await run(
          "opportunity-lookup",
          [{ client_id: client.clientId }, "-created_date", 21, 0, ["id", "client_id", "property_ids", "stage", "notes"]],
          (rows) => Array.isArray(rows) && rows.length <= 21 && rows.every((x) => id3(x.id) && x.client_id === client.clientId && stages.includes(x.stage) && (x.property_ids == null || Array.isArray(x.property_ids) && x.property_ids.every(id3)) && (x.notes == null || typeof x.notes === "string"))
        );
        if (found.receipt.length >= 21) throw Error("Opportunity search not exhaustive");
        const open = found.receipt.filter((x) => !["ganado", "perdido"].includes(x.stage));
        const candidates = open.filter((x) => ids.length ? (x.property_ids || []).some((v) => ids.includes(v)) : !(x.property_ids || []).length && ((x.notes || "").includes(marker) || (x.notes || "").includes("Intenci\xF3n bot: " + intent + ".")));
        if (candidates.length > 1) throw Error("Ambiguous opportunities");
        if (candidates.length === 1 && !same([...new Set(candidates[0].property_ids || [])].sort(), ids)) throw Error("Overlapping opportunity requires review");
        if (known && (candidates.length !== 1 || candidates[0].id !== known)) throw Error("Known opportunity missing or stale");
        let receipt = found;
        if (candidates.length === 1) {
          opportunityId = candidates[0].id;
        } else {
          if (known) throw Error("Cannot recreate");
          receipt = await create("opportunity-create", {
            name: (kind === "form" ? "Inter\xE9s web \u2014 " : "Bot web \u2014 ") + name,
            client_id: client.clientId,
            property_ids: ids,
            stage: kind === "chat" && score >= 75 ? "calificado" : "nuevo",
            value: Number(q.budget_max || q.budget_min || 0),
            notes: details + "\n" + marker + "\nIntenci\xF3n bot: " + intent + ". Urgencia: " + (q.urgency || "no especificada") + "."
          });
          opportunityId = receipt.receipt.id;
        }
        const ack2 = await commercial.call("remember", { ...request, interestTag, opportunityId, step: receipt.step, receiptTag: receipt.receiptTag });
        if (ack2?.status !== "remembered") throw Error("Mapping unconfirmed");
        if (candidates.length) await omit("opportunity-create", "existing_opportunity", { lookupStep: found.step, receiptTag: found.receiptTag, interestTag, opportunityId });
      }
      await create("interaction", {
        client_id: client.clientId,
        ...ids[0] ? { property_id: ids[0] } : {},
        interaction_type: body.phone ? "whatsapp" : "email",
        date: now,
        outcome: "follow_up_needed",
        notes: details + "\nRegistros confirmados: " + JSON.stringify({ communication_id: communication.receipt.id, conversation_id: conversation?.receipt.id, opportunity_id: opportunityId }) + "\nRegistro comercial completado. Confirmaci\xF3n de entrega controlada por el registro t\xE9cnico."
      });
      const ack = await commercial.call("delivered", request);
      if (ack?.status !== "delivered") throw Error("Delivery unconfirmed");
      return { status: "delivered", delivered: true, identityVerified: false };
    } catch {
      if (request) {
        try {
          await commercial.call("review", request);
        } catch {
        }
      }
      try {
        await inbox.call("review", { operation, dispatch });
      } catch {
      }
      return { status: "review_required", delivered: false };
    }
  };
}

// candidates/base44/runtime/form-integration-2026-09-19/commercial-receiver.mjs
var reply2 = (status, body) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
function composeCommercialReceiver({ enabled = false, receiver: receiver2, worker } = {}) {
  return { async handle(req) {
    if (!enabled || typeof receiver2?.handle !== "function" || typeof worker !== "function")
      return reply2(503, { success: false, code: "paused" });
    const header = req.headers.get("x-alsasa-envelope");
    const admitted = await receiver2.handle(req);
    if (admitted.status !== 202) return admitted;
    const data = await admitted.json();
    let operation;
    try {
      operation = JSON.parse(header).operation;
    } catch {
      return reply2(503, { success: false, code: "temporarily_unavailable" });
    }
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(operation)) return reply2(503, { success: false, code: "temporarily_unavailable" });
    if (data.code !== "stored_pending_delivery") return reply2(202, { ...data, operation });
    let outcome;
    try {
      outcome = await worker(operation);
    } catch {
    }
    if (outcome?.status === "delivered" && outcome.delivered === true)
      return reply2(201, { success: true, code: "delivered", delivered: true, stored: true, operation });
    return reply2(202, { success: false, code: outcome?.status === "review_required" ? "review_required" : "stored_pending_delivery", stored: true, delivered: false, operation });
  }, close() {
    receiver2?.close?.();
  } };
}
function createCommercialReceiver({ enabled = false, kind, policy = {}, receiverConfig = {}, workerConfig = {} } = {}) {
  let plan;
  try {
    plan = commercialPlan(kind);
  } catch {
    return composeCommercialReceiver();
  }
  const receiver2 = createValidatedReceiver({ ...receiverConfig, kind, policy: { ...policy, enabled: enabled === true && policy.enabled === true, plan } });
  const worker = createCommercialFlow({ ...workerConfig, kind, policyId: policy.id, enabled: enabled === true && policy.enabled === true });
  return composeCommercialReceiver({ enabled, receiver: receiver2, worker });
}

// candidates/base44/runtime/form-integration-2026-09-19/bounded-sdk-transport.mjs
import { Agent } from "node:http";
import { Agent as HttpsAgent } from "node:https";
var allowed2 = { Client: ["filter", "create"], Property: ["filter"], CommunicationLog: ["create"], Opportunity: ["filter", "create"], Interaction: ["filter", "create"], ChatConversation: ["create"] };
function createBoundedEntities({ createAxiosClient: createAxiosClient2, createEntitiesModule: createEntitiesModule2, serverUrl, appId, serviceToken, timeoutMs = 5e3, localTest = false } = {}) {
  const url = new URL(serverUrl);
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/" || !(url.protocol === "https:" || localTest === true && url.protocol === "http:" && url.hostname === "127.0.0.1") || !/^[a-zA-Z0-9_-]{1,100}$/.test(appId) || typeof serviceToken !== "string" || !serviceToken || !Number.isInteger(timeoutMs) || timeoutMs < 25 || timeoutMs > 1e4) throw Error("Invalid transport configuration");
  const baseURL = url.origin + "/api", httpAgent = new Agent({ keepAlive: false }), httpsAgent = new HttpsAgent({ keepAlive: false });
  const client = createAxiosClient2({ baseURL, token: serviceToken, headers: { "X-App-Id": appId } });
  client.interceptors.request.use((config) => {
    if (config.baseURL !== baseURL || !Object.entries(allowed2).some(([entity, methods]) => config.url === "/apps/" + appId + "/entities/" + entity && methods.includes(config.method === "get" ? "filter" : config.method === "post" ? "create" : ""))) throw Error("Forbidden SDK route");
    Object.assign(config, {
      adapter: "http",
      timeout: timeoutMs,
      maxRedirects: 0,
      proxy: false,
      httpAgent,
      httpsAgent,
      maxContentLength: 262144,
      maxBodyLength: 32768
    });
    return config;
  });
  const raw = createEntitiesModule2({ axios: client, appId, getSocket: () => {
    throw Error("Realtime forbidden");
  } });
  const entities = Object.freeze(Object.fromEntries(Object.entries(allowed2).map(([entity, methods]) => [entity, Object.freeze(Object.fromEntries(methods.map((method) => [method, (...args) => raw[entity][method](...args)])))])));
  return { entities, close() {
    httpAgent.destroy();
    httpsAgent.destroy();
  } };
}

// candidates/base44/runtime/postgres-2026-09-15/postgres-ledger.mjs
var PostgresLedger = class {
  constructor(pool, scope) {
    if (!pool || typeof pool.connect !== "function" || typeof scope !== "string" || !scope.length)
      throw Error("Pool and fixed scope required");
    this.pool = pool;
    this.scope = scope;
  }
  async call(action, request) {
    const client = await this.pool.connect();
    let failed = false;
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL statement_timeout = '5s'");
      await client.query("SET LOCAL lock_timeout = '3s'");
      await client.query("SET LOCAL synchronous_commit = on");
      const response = await client.query(
        "SELECT alsasa_guard_v1.operate($1,$2,$3::jsonb) AS result",
        [this.scope, action, JSON.stringify(request)]
      );
      const result = response.rows?.[0]?.result;
      if (!result || typeof result.status !== "string") throw Error("Invalid ledger response");
      const commit = await client.query("COMMIT");
      if (commit.command !== "COMMIT") throw Error("Commit unconfirmed");
      return result;
    } catch (error) {
      failed = true;
      try {
        await client.query("ROLLBACK");
      } catch {
      }
      throw error;
    } finally {
      client.release(failed);
    }
  }
  admit(request) {
    return this.call("admit", request);
  }
  beginStep(request) {
    return this.call("begin", request);
  }
  confirmStep(request) {
    return this.call("confirm", request);
  }
  hold(request) {
    return this.call("hold", request);
  }
};

// candidates/base44/runtime/commercial-2026-09-19/client-branch-ledger.mjs
var ClientBranchLedger = class {
  constructor(pool, scope) {
    this.pool = pool;
    this.scope = scope;
  }
  async skip(request) {
    const c = await this.pool.connect();
    let broken = false;
    try {
      await c.query("BEGIN");
      await c.query("SET LOCAL statement_timeout='5s'");
      await c.query("SET LOCAL synchronous_commit=on");
      const r = (await c.query("SELECT alsasa_guard_v1.client_branch($1,$2::jsonb) AS result", [this.scope, JSON.stringify(request)])).rows[0].result;
      if ((await c.query("COMMIT")).command !== "COMMIT") throw Error("Unconfirmed commit");
      return r;
    } catch (e) {
      broken = true;
      try {
        await c.query("ROLLBACK");
      } catch {
      }
      throw e;
    } finally {
      c.release(broken);
    }
  }
};

// candidates/base44/runtime/commercial-2026-09-19/commercial-ledger.mjs
var CommercialLedger = class {
  constructor(pool, scope) {
    this.pool = pool;
    this.scope = scope;
  }
  async call(action, p) {
    const c = await this.pool.connect();
    let failed = false;
    try {
      await c.query("BEGIN");
      await c.query("SET LOCAL statement_timeout='5s'");
      await c.query("SET LOCAL synchronous_commit=on");
      const r = (await c.query("SELECT alsasa_guard_v1.commercial_control($1,$2,$3::jsonb) AS result", [this.scope, action, JSON.stringify(p)])).rows[0].result;
      if ((await c.query("COMMIT")).command !== "COMMIT") throw Error("Commit unconfirmed");
      return r;
    } catch (e) {
      failed = true;
      try {
        await c.query("ROLLBACK");
      } catch {
      }
      throw e;
    } finally {
      c.release(failed);
    }
  }
};

// candidates/base44/receiver-runtime.mjs
var APP2 = "68b1e87f22e7326f9f762688";
var reply3 = (status, code) => Response.json({ success: false, code }, { status, headers: { "Cache-Control": "no-store" } });
function createReceiverRuntime({ kind, env, Pool: Pool2, createAxiosClient: createAxiosClient2, createEntitiesModule: createEntitiesModule2, readPublic } = {}) {
  let ring;
  const pools = [];
  const closed = createCaptureRouter({ kind, readPublic });
  const close = async () => {
    ring?.destroy();
    await Promise.allSettled(pools.map((p) => p.end()));
  };
  try {
    const c = readReceiverConfig(env);
    if (!c || !["form", "chat"].includes(kind)) return { handle: closed, close };
    const admission = new Pool2(c.admission);
    pools.push(admission);
    const execution = new Pool2(c.execution);
    pools.push(execution);
    for (const pool of pools) pool.on("error", () => {
    });
    ring = new InboxKeyring(c.ring);
    const signed = { async handle(request) {
      if (!request.headers.get("x-alsasa-envelope")) return reply3(401, "authorization_required");
      const authorization = request.headers.get("Base44-Service-Authorization");
      if (request.headers.get("Base44-App-Id") !== APP2 || !/^Bearer [^\s]{16,8192}$/.test(authorization || "")) return reply3(503, "platform_configuration_required");
      let transport, receiver2;
      try {
        transport = createBoundedEntities({
          createAxiosClient: createAxiosClient2,
          createEntitiesModule: createEntitiesModule2,
          serverUrl: c.serverUrl,
          appId: APP2,
          serviceToken: authorization.slice(7)
        });
        receiver2 = createCommercialReceiver({
          enabled: true,
          kind,
          policy: c.policy,
          receiverConfig: { ...c.ring, key: c.signingKey, ledger: new InventoryAdmissionLedger(admission, c.scope, c.ring.entries.map((e) => e.id)) },
          workerConfig: {
            signingKey: c.signingKey,
            identityKey: c.identityKey,
            keyring: ring,
            entities: transport.entities,
            inbox: new CaptureLedger(execution, c.scope),
            steps: new PostgresLedger(execution, c.scope),
            identity: new IdentityLedger(execution, c.scope),
            branch: new ClientBranchLedger(execution, c.scope),
            commercial: new CommercialLedger(execution, c.scope)
          }
        });
        return await receiver2.handle(request);
      } catch {
        return reply3(503, "temporarily_unavailable");
      } finally {
        receiver2?.close();
        transport?.close();
      }
    } };
    return { handle: createCaptureRouter({ kind, receiver: signed, readPublic }), close };
  } catch {
    void close();
    return { handle: closed, close };
  }
}

// candidates/base44/entries/captureChatLead.ts
var { Pool } = pg;
var receiver = createReceiverRuntime({ kind: "chat", env: Object.fromEntries(["ALSASA_CAPTURE_ENABLED", "ALSASA_CAPTURE_SCOPE", "ALSASA_CAPTURE_POLICY", "ALSASA_CAPTURE_STARTS_AT", "ALSASA_CAPTURE_ENDS_AT", "ALSASA_CAPTURE_SIGNING_KEY", "ALSASA_CAPTURE_IDENTITY_KEY", "ALSASA_CAPTURE_KEYRING_JSON", "ALSASA_CAPTURE_ADMISSION_DATABASE_URL", "ALSASA_CAPTURE_EXECUTION_DATABASE_URL"].map((name) => [name, Deno.env.get(name)])), Pool, createAxiosClient, createEntitiesModule });
Deno.serve((request) => receiver.handle(request));
