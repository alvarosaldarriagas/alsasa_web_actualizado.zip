// INACTIVE technical adapter. Confirmed COMMIT is required; no retries.
export class IngressRateLedger {
 constructor(pool,scope){if(!pool||typeof pool.connect!=='function'||typeof scope!=='string'||!scope)throw Error('Invalid config');this.pool=pool;this.scope=scope;}
 async consume({subject,kind,operation}={}){
  const c=await this.pool.connect();let failed=false;
  try{
   await c.query('BEGIN');await c.query("SET LOCAL statement_timeout='5s'");await c.query('SET LOCAL synchronous_commit=on');
   const r=(await c.query('SELECT alsasa_guard_v1.consume_ingress($1,$2::jsonb) AS result',[this.scope,JSON.stringify({subject,kind,operation})])).rows[0].result;
   if((await c.query('COMMIT')).command!=='COMMIT')throw Error('Commit unconfirmed');
   return r;
  }catch(e){failed=true;try{await c.query('ROLLBACK');}catch{}throw e;}finally{c.release(failed);}
 }
}
