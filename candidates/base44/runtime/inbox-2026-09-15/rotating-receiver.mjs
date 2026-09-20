// INACTIVE. One immutable keyring snapshot per handler; no key management HTTP endpoint.
import {createInternalReceiver} from '../http-2026-09-15/internal-receiver.mjs';
import {InboxKeyring} from './keyring.mjs';
export function createRotatingReceiver({kind,policy,key,validate,now,ledger,activeId,entries,requiredKeyIds}={}){
 let ring;
 try{
  if(!ledger||typeof ledger.call!=='function'||typeof ledger.scope!=='string'||!ledger.scope)throw Error('configuration');
  ring=new InboxKeyring({activeId,entries,requiredKeyIds,signingKey:key});
 }catch{
  return {handle:async()=>Response.json({success:false,code:'unconfigured'},{status:503,headers:{'Cache-Control':'no-store'}}),close(){}};
 }
 const handle=createInternalReceiver({kind,policy,key,validate,now,ledgerForBytes:bytes=>ring.bind(ledger,bytes)});
 return {
  async handle(req){
   const r=await handle(req),body=await r.json();
   if(r.status===202){body.code=body.code==='reserved_not_delivered'?'stored_pending_delivery':'already_stored_pending_confirmation';body.stored=true;body.delivered=false;}
   return Response.json(body,{status:r.status,headers:{'Cache-Control':'no-store'}});
  },
  close(){ring.destroy();}
 };
}
