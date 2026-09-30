// Inactive successor to runStep: SQL confirmation now requires a receipt fingerprint.
export async function executeStep({ ledger, request, effect, validateReceipt, receiptTag }) {
  if (typeof effect !== 'function' || typeof validateReceipt !== 'function' || typeof receiptTag !== 'function')
    return {status:'closed'};
  let claim;
  try { claim = await ledger.beginStep(request); } catch { return {status:'unavailable'}; }
  if (!claim || claim.status !== 'claimed' || claim.operation !== request.operation ||
      claim.step !== request.step || claim.attempt !== request.attempt)
    return {status:claim?.status === 'confirmed' ? 'already_confirmed' : 'blocked'};
  try {
    const receipt = await effect(); // exactly ONE request; concrete SDK retry audit still required
    if (validateReceipt(receipt) !== true) throw Error('Incomplete receipt');
    const tag = receiptTag(receipt);
    if (typeof tag !== 'string' || !/^[a-f0-9]{64}$/.test(tag)) throw Error('Invalid receipt tag');
    const ack = await ledger.confirmStep({...request,receiptTag:tag});
    if (ack.status !== 'confirmed') throw Error('Confirmation failed');
    return {status:'confirmed'};
  } catch {
    try { await ledger.hold(request); } catch {}
    return {status:'review_required'};
  }
}
