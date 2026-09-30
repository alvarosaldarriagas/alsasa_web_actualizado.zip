// INACTIVE trusted receiver/worker composition; not a public listener.
import {createValidatedReceiver} from '../validation-2026-09-17/validated-receiver.mjs';
import {commercialPlan,createCommercialFlow} from '../commercial-2026-09-19/commercial-flow.mjs';
const reply=(status,body)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
// worker injection exists for transport tests only; deployment factory below constructs the real worker.
export function composeCommercialReceiver({enabled=false,receiver,worker}={}){
 return {async handle(req){
  if(!enabled||typeof receiver?.handle!=='function'||typeof worker!=='function')
   return reply(503,{success:false,code:'paused'});
  const header=req.headers.get('x-alsasa-envelope');
  const admitted=await receiver.handle(req);
  if(admitted.status!==202)return admitted;
  const data=await admitted.json();
  let operation;try{operation=JSON.parse(header).operation;}catch{return reply(503,{success:false,code:'temporarily_unavailable'});}
  // Only read the header after the real receiver has authenticated and committed admission.
  if(!/^[a-zA-Z0-9_-]{1,100}$/.test(operation))return reply(503,{success:false,code:'temporarily_unavailable'});
  if(data.code!=='stored_pending_delivery')return reply(202,{...data,operation});
  let outcome;try{outcome=await worker(operation);}catch{}
  if(outcome?.status==='delivered'&&outcome.delivered===true)
   return reply(201,{success:true,code:'delivered',delivered:true,stored:true,operation});
  return reply(202,{success:false,code:outcome?.status==='review_required'?'review_required':'stored_pending_delivery',stored:true,delivered:false,operation});
 },close(){receiver?.close?.();}};
}
export function createCommercialReceiver({enabled=false,kind,policy={},receiverConfig={},workerConfig={}}={}){
 let plan;try{plan=commercialPlan(kind);}catch{return composeCommercialReceiver();}
 const receiver=createValidatedReceiver({...receiverConfig,kind,policy:{...policy,enabled:enabled===true&&policy.enabled===true,plan}});
 const worker=createCommercialFlow({...workerConfig,kind,policyId:policy.id,enabled:enabled===true&&policy.enabled===true});
 return composeCommercialReceiver({enabled,receiver,worker});
}
