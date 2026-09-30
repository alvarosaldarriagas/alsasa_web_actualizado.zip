// INACTIVE. Dedicated stable HMAC key must be shared by all capture channels in a fixed CRM scope.
import {createHmac} from 'node:crypto';
export function clientIdentityTag(key,email){
 if(!Buffer.isBuffer(key)||key.length<32||typeof email!=='string'||email.length>160||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))throw Error('Invalid identity');
 return createHmac('sha256',key).update(JSON.stringify(['alsasa-client-email-v1',email.trim().toLowerCase()])).digest('hex');
}
export class IdentityLedger{
 constructor(pool,scope){this.pool=pool;this.scope=scope;}
 async call(action,request){
  const c=await this.pool.connect();let broken=false;
  try{
   await c.query('BEGIN');await c.query("SET LOCAL statement_timeout='5s'");await c.query('SET LOCAL synchronous_commit=on');
   const r=(await c.query('SELECT alsasa_guard_v1.identity_guard($1,$2,$3::jsonb) AS result',[this.scope,action,JSON.stringify(request)])).rows[0].result;
   if((await c.query('COMMIT')).command!=='COMMIT')throw Error('Unconfirmed commit');return r;
  }catch(e){broken=true;try{await c.query('ROLLBACK');}catch{}throw e;}finally{c.release(broken);}
 }
}
export async function guardClientIdentity({ledger,request,effect}){
 if(typeof effect!=='function')return {status:'closed'};
 let claim;try{claim=await ledger.call('claim',request);}catch{return {status:'unavailable'};}
 if(claim?.status==='resolved')return {status:'existing_mapping_requires_verification',clientId:claim.clientId};
 if(claim?.status!=='claimed')return {status:'blocked'};
 try{
  // Trusted callback must use quota-controlled SDK steps, not direct unmetered writes.
  const result=await effect();
  if(!result||!result.clientId||!result.step||!result.receiptTag)throw Error('Missing receipt');
  const ack=await ledger.call('resolve',{...request,clientId:result.clientId,step:result.step,receiptTag:result.receiptTag});
  if(ack?.status!=='resolved'||ack.clientId!==result.clientId)throw Error('Resolution unconfirmed');
  return {status:'client_resolved',clientId:ack.clientId,identityVerified:false};
 }catch{
  try{await ledger.call('review',request);}catch{}
  return {status:'review_required'};
 }
}
