// INACTIVE, server-internal customer stage. No HTTP handler; never reports a delivered lead.
import {randomUUID,createHash} from 'node:crypto';
import {clientIdentityTag} from './identity-guard.mjs';
import {prepareCrmStep} from '../crm-2026-09-17/crm-step.mjs';
import {validateCapture} from '../validation-2026-09-17/capture-validator.mjs';
import {bodyTag} from '../redesign-2026-09-15/protocol-reference.mjs';
import {ROUTES} from '../http-2026-09-15/internal-receiver.mjs';
const id=x=>typeof x==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(x);
const normalize=x=>Array.isArray(x)?x.map(normalize):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,normalize(x[k])])):x;
const same=(a,b)=>JSON.stringify(normalize(a))===JSON.stringify(normalize(b));
const receiptTag=(method,receipt)=>createHash('sha256').update(JSON.stringify({entity:'Client',method,receipt})).digest('hex');
export function clientPlan(kind){
 const r=ROUTES[kind];if(!r)throw Error('Invalid route');
 return ['filter','create'].map((method,n)=>({
  id:n?'client-create':'client-lookup',receiptSchema:n?'client-created-v1':'client-lookup-v1',
  costs:{base44_sdk_attempt:1},
  binding:{app:r.app,channel:r.channel,route:r.route,version:'client-resolution-v1',entity:'Client',method},
  ...(n?{condition:{type:'create_if_no_client',lookupStep:'client-lookup',version:'v1'}}:{})
 }));
}
export function createClientFlow({enabled=false,kind,policyId,inbox,steps,identity,branch,keyring,signingKey,identityKey,entities}={}){
 let plan;try{plan=clientPlan(kind);}catch{}
 const configured=plan&&id(policyId)&&inbox&&typeof inbox.call==='function'&&typeof inbox.scope==='string'&&
 steps&&typeof steps.beginStep==='function'&&identity&&typeof identity.call==='function'&&branch&&typeof branch.skip==='function'&&
 [steps,identity,branch].every(x=>x.scope===inbox.scope)&&keyring&&typeof keyring.decrypt==='function'&&
 Buffer.isBuffer(signingKey)&&signingKey.length>=32&&Buffer.isBuffer(identityKey)&&identityKey.length>=32&&
 !signingKey.equals(identityKey)&&entities?.Client&&typeof entities.Client.filter==='function'&&typeof entities.Client.create==='function';
 return async operation=>{
  if(!enabled||!configured)return {status:'closed',delivered:false};
  if(!id(operation))return {status:'blocked',delivered:false};
  const dispatch=randomUUID();let capture;
  try{capture=await inbox.call('dispatch',{operation,dispatch});}catch{return {status:'unavailable',delivered:false};}
  if(capture?.status!=='claimed')return {status:'blocked',delivered:false};
  try{
   if(capture.channel!==ROUTES[kind].channel||capture.policy!==policyId||!same(capture.plan,plan))throw Error('Binding mismatch');
   const bytes=keyring.decrypt(capture.payload,{scope:inbox.scope,operation,bodyTag:capture.bodyTag});
   if(bodyTag(signingKey,bytes)!==capture.bodyTag)throw Error('Body mismatch');
   const body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
   if(!validateCapture(kind,body))throw Error('Invalid body');
   return await resolveClientStage({kind,body,operation,dispatch,captureTag:capture.bodyTag,steps,identity,branch,identityKey,entities});
  }catch{
   try{await inbox.call('review',{operation,dispatch});}catch{}
   return {status:'review_required',delivered:false};
  }
 };
}

// Trusted server composition after dispatch/binding validation; does not claim or finish the inbox.
export async function resolveClientStage({kind,body,operation,dispatch,captureTag,steps,identity,branch,identityKey,entities}){
 let request,ownsIdentity=false;
 if(!validateCapture(kind,body))throw Error('Invalid capture');
 try{
   const email=body.email.trim().toLowerCase();
   request={operation,dispatch,identityTag:clientIdentityTag(identityKey,email)};
   const claim=await identity.call('claim',request);
   if(!['claimed','resolved'].includes(claim?.status)||claim.status==='resolved'&&!id(claim.clientId))throw Error('Identity unavailable');
   ownsIdentity=claim.status==='claimed';
   const run=async(method,args,validateReceipt,step)=>{
    const r=await prepareCrmStep({entities,entity:'Client',method,args,validateReceipt})({ledger:steps,request:{operation,step,attempt:randomUUID(),bodyTag:captureTag}});
    if(r.status!=='confirmed')throw Error('Unconfirmed CRM step');
    return {clientId:method==='filter'?r.receipt[0]?.id:r.receipt.id,receipt:r.receipt,step,receiptTag:receiptTag(method,r.receipt)};
   };
   const found=await run('filter',[{email},'-created_date',2,0,['id','email']],
    rows=>Array.isArray(rows)&&rows.length<=2&&rows.every(r=>id(r.id)&&typeof r.email==='string'&&r.email.trim().toLowerCase()===email),'client-lookup');
   if(found.receipt.length>1)throw Error('Ambiguous lookup');
   // A prior mapping requires an exact fresh match. A missing/stale mapping NEVER grants creation.
   if(!ownsIdentity&&(found.receipt.length!==1||found.clientId!==claim.clientId))throw Error('Mapping mismatch');
   let resolved=found,origin='existing';
   if(found.receipt.length===0){
    if(!ownsIdentity)throw Error('No ownership');
    const data={full_name:(kind==='form'?body.full_name:body.name).trim(),email,
     ...(body.phone?{phone:body.phone,whatsapp:body.phone}:{}),source:kind==='form'?(body.source||'web'):'web',
     status:'potential',client_type:kind==='form'?'buyer':({rent:'tenant',sell:'seller',valuation:'seller',landlord:'landlord',buy:'buyer',invest:'buyer'}[body.qualification?.intent]||'all'),
     ...(kind==='chat'?{communication_preferences:body.phone?['whatsapp','email']:['email'],
      lead_score:Number(body.qualification?.lead_score||0),
      ...(body.qualification?.budget_min!=null&&body.qualification.budget_min!==''?{budget_min:Number(body.qualification.budget_min)}:{}),
      ...(body.qualification?.budget_max!=null&&body.qualification.budget_max!==''?{budget_max:Number(body.qualification.budget_max)}:{}),
      preferred_areas:body.qualification?.preferred_areas||[],
      notes:'Lead del bot web. Identidad pendiente de verificación por un asesor.'}:{})};
    resolved=await run('create',[data],r=>r&&typeof r.email==='string'&&r.email.trim().toLowerCase()===email,'client-create');
    origin='created';
   }
   if(ownsIdentity){
    const ack=await identity.call('resolve',{...request,clientId:resolved.clientId,step:resolved.step,receiptTag:resolved.receiptTag});
    if(ack?.status!=='resolved'||ack.clientId!==resolved.clientId)throw Error('Identity resolution unconfirmed');
   }
   if(origin==='existing'){
    const ack=await branch.skip({...request,bodyTag:captureTag,step:'client-create',lookupStep:'client-lookup',clientId:found.clientId,receiptTag:found.receiptTag});
    if(ack?.status!=='skipped'||ack.reason!=='existing_client_no_create')throw Error('Branch unconfirmed');
   }
   // Internal result only. Do not expose clientId or use it as authentication.
   return {status:'client_resolved',clientId:resolved.clientId,origin,identityVerified:false,delivered:false};
 }catch(e){
  if(ownsIdentity&&request){try{await identity.call('review',request);}catch{}}
  throw e;
 }
}
