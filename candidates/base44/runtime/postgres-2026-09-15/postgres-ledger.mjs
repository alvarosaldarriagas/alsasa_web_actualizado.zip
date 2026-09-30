// Inactive SQL adapter. Inject a configured pg Pool using a least-privilege DB login.
// No URL, credentials, provider connection or deployment is included in this file.
export class PostgresLedger {
  constructor(pool, scope) {
    if (!pool || typeof pool.connect !== 'function' || typeof scope !== 'string' || !scope.length)
      throw Error('Pool and fixed scope required');
    this.pool = pool; this.scope = scope;
  }
  async call(action, request) {
    const client = await this.pool.connect();
    let failed = false;
    try {
      await client.query('BEGIN');
      await client.query("SET LOCAL statement_timeout = '5s'");
      await client.query("SET LOCAL lock_timeout = '3s'");
      await client.query("SET LOCAL synchronous_commit = on");
      const response = await client.query(
        'SELECT alsasa_guard_v1.operate($1,$2,$3::jsonb) AS result',
        [this.scope, action, JSON.stringify(request)]);
      const result = response.rows?.[0]?.result;
      if (!result || typeof result.status !== 'string') throw Error('Invalid ledger response');
      const commit = await client.query('COMMIT');
      if (commit.command !== 'COMMIT') throw Error('Commit unconfirmed');
      return result;
    } catch (error) {
      failed = true;
      try { await client.query('ROLLBACK'); } catch {}
      // There are deliberately no retries, refunds or fallback storage here.
      throw error;
    } finally { client.release(failed); }
  }
  admit(request) { return this.call('admit', request); }
  beginStep(request) { return this.call('begin', request); }
  confirmStep(request) { return this.call('confirm', request); }
  hold(request) { return this.call('hold', request); }
}
