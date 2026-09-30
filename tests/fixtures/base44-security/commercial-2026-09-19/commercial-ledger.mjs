// INACTIVE technical adapter. No automatic retries.
export class CommercialLedger {
 constructor(pool,scope){this.pool=pool;this.scope=scope;}
 async call(action,p){
  const c=await this.pool.connect();let failed=false;
  try{
   await c.query('BEGIN');await c.query("SET LOCAL statement_timeout='5s'");await c.query('SET LOCAL synchronous_commit=on');
   const r=(await c.query('SELECT alsasa_guard_v1.commercial_control($1,$2,$3::jsonb) AS result',[this.scope,action,JSON.stringify(p)])).rows[0].result;
   if((await c.query('COMMIT')).command!=='COMMIT')throw Error('Commit unconfirmed');return r;
  }catch(e){failed=true;try{await c.query('ROLLBACK');}catch{}throw e;}finally{c.release(failed);}
 }
}
