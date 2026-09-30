// Inactive durable capture adapter. No default key, URL, retries or network effect.
import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
const aad=c=>Buffer.from(JSON.stringify(['alsasa-capture-v1',c.scope,c.operation,c.bodyTag]));
export function seal(key,keyId,bytes,context){
 if(!Buffer.isBuffer(key)||key.length!==32||!Buffer.isBuffer(bytes)||!bytes.length||bytes.length>16384||
 !/^[a-zA-Z0-9_-]{1,80}$/.test(keyId)||!context.scope||!context.operation||!/^[a-f0-9]{64}$/.test(context.bodyTag))throw Error('Invalid encryption input');
 const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',key,iv);c.setAAD(aad(context));
 const ciphertext=Buffer.concat([c.update(bytes),c.final()]);
 return {alg:'AES-256-GCM',keyId,iv:iv.toString('hex'),tag:c.getAuthTag().toString('hex'),ciphertext:ciphertext.toString('hex')};
}
export function unseal(key,p,context){
 if(!Buffer.isBuffer(key)||key.length!==32||p.alg!=='AES-256-GCM')throw Error('Invalid decryption input');
 const d=createDecipheriv('aes-256-gcm',key,Buffer.from(p.iv,'hex'));d.setAAD(aad(context));d.setAuthTag(Buffer.from(p.tag,'hex'));
 return Buffer.concat([d.update(Buffer.from(p.ciphertext,'hex')),d.final()]);
}
export class CaptureLedger{
 constructor(pool,scope){this.pool=pool;this.scope=scope;}
 async call(action,p){
  const c=await this.pool.connect();let broken=false;
  try{
   await c.query('BEGIN');await c.query("SET LOCAL statement_timeout='5s'");await c.query('SET LOCAL synchronous_commit=on');
   const result=(await c.query('SELECT alsasa_guard_v1.capture($1,$2,$3::jsonb) AS r',[this.scope,action,JSON.stringify(p)])).rows[0].r;
   if((await c.query('COMMIT')).command!=='COMMIT')throw Error('Unconfirmed commit');
   return result;
  }catch(e){broken=true;try{await c.query('ROLLBACK');}catch{}throw e;}finally{c.release(broken);}
 }
}
// Adapts the HTTP boundary's ledger dependency; exact validated bytes are captured in the closure.
// Bind one instance per request. A shared mutable request buffer is forbidden.
export function bindDurableAdmission({ledger,key,keyId,bytes}){
 const copy=Buffer.from(bytes);
 return {admit:request=>ledger.call('admit',{...request,payload:seal(key,keyId,copy,{scope:ledger.scope,operation:request.operation,bodyTag:request.bodyTag})})};
}
