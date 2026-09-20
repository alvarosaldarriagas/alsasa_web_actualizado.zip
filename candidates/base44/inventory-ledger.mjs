// Inventory and admission share a gate lock and a confirmed transaction.
export class InventoryAdmissionLedger {
  constructor(pool, scope, keyIds) { this.pool = pool; this.scope = scope; this.keys = new Set(keyIds); }
  async call(action, request) {
    if (action !== 'admit' || !this.keys.has(request?.payload?.keyId)) throw Error('Invalid admission');
    const c = await this.pool.connect(); let broken = false;
    try {
      await c.query('BEGIN');
      await c.query("SET LOCAL statement_timeout='5s'");
      await c.query("SET LOCAL lock_timeout='3s'");
      await c.query('SET LOCAL synchronous_commit=on');
      const inventory = (await c.query('SELECT alsasa_guard_v1.required_capture_keys($1) AS keys', [this.scope])).rows[0]?.keys;
      if (!Array.isArray(inventory) || inventory.length > 32 || inventory.some(id => !this.keys.has(id))) throw Error('Required key unavailable');
      const result = (await c.query('SELECT alsasa_guard_v1.capture($1,$2,$3::jsonb) AS r', [this.scope, action, JSON.stringify(request)])).rows[0]?.r;
      if (!result || typeof result.status !== 'string') throw Error('Invalid admission receipt');
      if ((await c.query('COMMIT')).command !== 'COMMIT') throw Error('Unconfirmed admission');
      return result;
    } catch (error) {
      broken = true; try { await c.query('ROLLBACK'); } catch {}
      throw error;
    } finally { c.release(broken); }
  }
}
