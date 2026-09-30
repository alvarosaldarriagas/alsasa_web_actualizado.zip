// INACTIVE complete commercial worker: all SDK methods injected, no public listener.
import {randomUUID,createHash,createHmac} from 'node:crypto';
import {resolveClientStage,clientPlan} from './client-flow.mjs';
import {clientIdentityTag} from './identity-guard.mjs';
import {prepareCrmStep} from '../crm-2026-09-17/crm-step.mjs';
import {validateCapture} from '../validation-2026-09-17/capture-validator.mjs';
import {bodyTag} from '../redesign-2026-09-15/protocol-reference.mjs';
import {ROUTES} from '../http-2026-09-15/internal-receiver.mjs';
const id=x=>typeof x==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(x);
const normalized=x=>Array.isArray(x)?x.map(normalized):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,normalized(x[k])])):x;
const same=(a,b)=>JSON.stringify(normalized(a))===JSON.stringify(normalized(b));
const hash=(entity,method,receipt)=>createHash('sha256').update(JSON.stringify({entity,method,receipt})).digest('hex');
const stages=['nuevo','calificado','propuesta','negociacion','ganado','perdido'];
export function commercialPlan(kind){
 const r=ROUTES[kind];if(!r)throw Error('Invalid kind');
 const step=(id,entity,method,condition)=>({id,receiptSchema:id+'-v1',costs:{base44_sdk_attempt:1},
  binding:{app:r.app,channel:r.channel,route:r.route,version:'commercial-v1',entity,method},...(condition?{condition}:{})});
 return [
  ...Array.from({length:kind==='form'?1:10},(_,index)=>step('property-'+index,'Property','filter',{type:'property_slot',index})),
  ...clientPlan(kind),
  step('communication','CommunicationLog','create'),
  ...(kind==='chat'?[step('conversation','ChatConversation','create')]:[]),
  step('opportunity-lookup','Opportunity','filter',{type:'opportunity_required'}),
  step('opportunity-create','Opportunity','create',{type:'opportunity_create',lookupStep:'opportunity-lookup',version:'v1'}),
  step('interaction','Interaction','create')
 ];
}
export function createCommercialFlow({enabled=false,kind,policyId,inbox,steps,identity,branch,commercial,keyring,signingKey,identityKey,entities}={}){
 let plan;try{plan=commercialPlan(kind);}catch{}
 const configured=plan&&id(policyId)&&inbox&&typeof inbox.call==='function'&&typeof inbox.scope==='string'&&
 [steps,identity,branch,commercial].every(x=>x&&x.scope===inbox.scope)&&typeof steps.beginStep==='function'&&
 typeof identity.call==='function'&&typeof branch.skip==='function'&&typeof commercial.call==='function'&&
 keyring&&typeof keyring.decrypt==='function'&&Buffer.isBuffer(signingKey)&&signingKey.length>=32&&
 Buffer.isBuffer(identityKey)&&identityKey.length>=32&&!identityKey.equals(signingKey)&&
 plan.every(s=>typeof entities?.[s.binding.entity]?.[s.binding.method]==='function');
 return async operation=>{
  if(!enabled||!configured)return {status:'closed',delivered:false};
  if(!id(operation))return {status:'blocked',delivered:false};
  const dispatch=randomUUID();let capture,request;
  try{capture=await inbox.call('dispatch',{operation,dispatch});}catch{return {status:'unavailable',delivered:false};}
  if(capture?.status!=='claimed')return {status:'blocked',delivered:false};
  try{
   if(capture.channel!==ROUTES[kind].channel||capture.policy!==policyId||!same(capture.plan,plan))throw Error('Binding mismatch');
   const bytes=keyring.decrypt(capture.payload,{scope:inbox.scope,operation,bodyTag:capture.bodyTag});
   if(bodyTag(signingKey,bytes)!==capture.bodyTag)throw Error('Body mismatch');
   const body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
   if(!validateCapture(kind,body))throw Error('Invalid body');
   const email=body.email.trim().toLowerCase(),name=(kind==='form'?body.full_name:body.name).trim();
   request={operation,dispatch,bodyTag:capture.bodyTag,identityTag:clientIdentityTag(identityKey,email)};
   if((await commercial.call('claim',request))?.status!=='claimed')throw Error('Commercial lock unavailable');
   const run=async(step,args,validateReceipt)=>{
    const descriptor=plan.find(s=>s.id===step);if(!descriptor)throw Error('Undeclared step');
    const {entity,method}=descriptor.binding;
    const r=await prepareCrmStep({entities,entity,method,args,validateReceipt})({ledger:steps,request:{operation,step,attempt:randomUUID(),bodyTag:capture.bodyTag}});
    if(r.status!=='confirmed')throw Error('Step unconfirmed');
    return {...r,step,receiptTag:hash(entity,method,r.receipt)};
   };
   const create=async(step,data)=>run(step,[data],r=>Object.entries(data).every(([k,v])=>same(r[k],v)));
   const omit=async(step,reason,evidence={})=>{
    const r=await commercial.call('omit',{...request,step,reason,...evidence});
    if(r?.status!=='skipped'||r.reason!==reason)throw Error('Omission unconfirmed');
   };
   // All property references are checked before any customer or commercial write.
   const refs=[...new Set((kind==='form'?(body.property_id?[body.property_id]:[]):body.qualification?.property_ids||[]).map(x=>x.trim()))];
   if(refs.some(x=>!id(x)))throw Error('Invalid property reference');
   const propertyIds=[],pendingReferences=[];
   for(let n=0;n<(kind==='form'?1:10);n++){
    const ref=refs[n],step='property-'+n;
    if(!ref){await omit(step,'no_declared_property',{index:n});continue;}
    const code=/^A[1-9]\d{2,9}$/i.test(ref)?ref.toUpperCase():null;
    const q={...(code?{custom_id:code}:{id:ref}),web_visible:true,status:'available'};
    const r=await run(step,[q,'-created_date',2,0,['id','custom_id','web_visible','status']],rows=>
     Array.isArray(rows)&&rows.length<=2&&rows.every(x=>id(x.id)&&x.web_visible===true&&x.status==='available'&&(code?x.custom_id===code:x.id===ref)));
    if(r.receipt.length===1){propertyIds.push(r.receipt[0].id);}
    else if(code&&kind==='form'&&r.receipt.length===0)pendingReferences.push(code);
    else throw Error('Unverified or ambiguous property');
   }
   const client=await resolveClientStage({kind,body,operation,dispatch,captureTag:capture.bodyTag,steps,identity,branch,identityKey,entities});
   if(client.status!=='client_resolved'||!id(client.clientId))throw Error('Client unresolved');
   const q=kind==='chat'?body.qualification||{}:body,intent=kind==='chat'?(q.intent||'information'):'information';
   const ids=[...new Set(propertyIds)].sort(),now=new Date().toISOString(),score=Number(q.lead_score||0);
   const details='Solicitud pública: identidad y datos pendientes de verificación por un asesor. '+JSON.stringify({
    operation,channel:kind,name,email,phone:body.phone||'',message:body.message||'',intent,
    property_ids:ids,property_references_pending:pendingReferences,
    source:body.source||'web',lead_type:body.lead_type||'contacto',budget_min:q.budget_min,budget_max:q.budget_max,preferred_areas:q.preferred_areas||[]
   });
   const communication=await create('communication',{client_id:client.clientId,communication_type:body.phone?'whatsapp':'email',
    direction:'inbound',subject:'Solicitud recibida por '+(kind==='chat'?'chat web':'formulario web'),message:details,status:'delivered',sent_at:now,ai_generated:false});
   let conversation;
   if(kind==='chat')conversation=await create('conversation',{
    visitor_name:name,visitor_email:email,visitor_phone:body.phone||'',messages:body.messages||[],lead_score:score,
    qualification:score>=75?'hot':score>=50?'warm':'cold',intent:['buy','rent','information'].includes(intent)?intent:'other',
    budget_range:q.budget_range||'',preferred_areas:q.preferred_areas||[],status:'converted',converted_to_client_id:client.clientId,last_interaction:now
   });
   let opportunityId;
   if(kind==='form'&&!ids.length){
    await omit('opportunity-lookup','no_verified_property');await omit('opportunity-create','no_verified_property');
   }else{
    const interestTag=createHmac('sha256',identityKey).update(JSON.stringify(['alsasa-interest-v1',client.clientId,ids,ids.length?'property':intent])).digest('hex');
    const mapping=await commercial.call('mapping',{...request,interestTag});
    if(mapping?.status!=='mapping'||mapping.opportunityId!==null&&!id(mapping.opportunityId))throw Error('Mapping unavailable');
    const known=mapping.opportunityId,marker='[alsasa-interest:'+interestTag+']';
    // If the result reaches the limit, do not infer absence from a truncated page.
    const found=await run('opportunity-lookup',[{client_id:client.clientId},'-created_date',21,0,['id','client_id','property_ids','stage','notes']],
     rows=>Array.isArray(rows)&&rows.length<=21&&rows.every(x=>id(x.id)&&x.client_id===client.clientId&&stages.includes(x.stage)&&
       (x.property_ids==null||Array.isArray(x.property_ids)&&x.property_ids.every(id))&&(x.notes==null||typeof x.notes==='string')));
    if(found.receipt.length>=21)throw Error('Opportunity search not exhaustive');
    const open=found.receipt.filter(x=>!['ganado','perdido'].includes(x.stage));
    const candidates=open.filter(x=>ids.length?(x.property_ids||[]).some(v=>ids.includes(v)):
      !(x.property_ids||[]).length&&((x.notes||'').includes(marker)||(x.notes||'').includes('Intención bot: '+intent+'.')));
    if(candidates.length>1)throw Error('Ambiguous opportunities');
    if(candidates.length===1&&!same([...(new Set(candidates[0].property_ids||[]))].sort(),ids))throw Error('Overlapping opportunity requires review');
    if(known&&(candidates.length!==1||candidates[0].id!==known))throw Error('Known opportunity missing or stale');
    let receipt=found;
    if(candidates.length===1){
     opportunityId=candidates[0].id;
    }else{
     if(known)throw Error('Cannot recreate');
     receipt=await create('opportunity-create',{
      name:(kind==='form'?'Interés web — ':'Bot web — ')+name,client_id:client.clientId,property_ids:ids,
      stage:kind==='chat'&&score>=75?'calificado':'nuevo',value:Number(q.budget_max||q.budget_min||0),
      notes:details+'\n'+marker+'\nIntención bot: '+intent+'. Urgencia: '+(q.urgency||'no especificada')+'.'
     });
     opportunityId=receipt.receipt.id;
    }
    const ack=await commercial.call('remember',{...request,interestTag,opportunityId,step:receipt.step,receiptTag:receipt.receiptTag});
    if(ack?.status!=='remembered')throw Error('Mapping unconfirmed');
    if(candidates.length)await omit('opportunity-create','existing_opportunity',{lookupStep:found.step,receiptTag:found.receiptTag,interestTag,opportunityId});
   }
   // Final CRM write references only confirmed prior receipts. It is not the SQL delivery acknowledgment.
   await create('interaction',{client_id:client.clientId,...(ids[0]?{property_id:ids[0]}:{}),
    interaction_type:body.phone?'whatsapp':'email',date:now,outcome:'follow_up_needed',
    notes:details+'\nRegistros confirmados: '+JSON.stringify({communication_id:communication.receipt.id,conversation_id:conversation?.receipt.id,opportunity_id:opportunityId})+
     '\nRegistro comercial completado. Confirmación de entrega controlada por el registro técnico.'
   });
   const ack=await commercial.call('delivered',request);
   if(ack?.status!=='delivered')throw Error('Delivery unconfirmed');
   return {status:'delivered',delivered:true,identityVerified:false};
  }catch{
   if(request){try{await commercial.call('review',request);}catch{}}
   try{await inbox.call('review',{operation,dispatch});}catch{}
   return {status:'review_required',delivered:false};
  }
 };
}
