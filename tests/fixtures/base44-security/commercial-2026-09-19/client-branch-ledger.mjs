// INACTIVE: one committed branch decision, no retries or provider effects.
export class ClientBranchLedger {
 constructor(pool,scope){this.pool=pool;this.scope=scope;}
 async skip(request){
  const c=await this.pool.connect();let broken=false;
  try{
   await c.query('BEGIN');await c.query("SET LOCAL statement_timeout='5s'");
   await c.query('SET LOCAL synchronous_commit=on');
   const r=(await c.query('SELECT alsasa_guard_v1.client_branch($1,$2::jsonb) AS result',[this.scope,JSON.stringify(request)])).rows[0].result;
   if((await c.query('COMMIT')).command!=='COMMIT')throw Error('Unconfirmed commit');
   return r;
  }catch(e){broken=true;try{await c.query('ROLLBACK');}catch{}throw e;}finally{c.release(broken);}
 }
}
