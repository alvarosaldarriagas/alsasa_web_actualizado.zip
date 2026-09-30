// INACTIVE. Trusted worker supplies spec, SDK entities and SQL request.
// Public JSON must never choose an entity, method, quota, or receipt validator.
import {createHash} from 'node:crypto';
import {executeStep} from '../postgres-2026-09-15/execute-step.mjs';
const allowed={Property:['filter'],Client:['filter','create'],Interaction:['filter','create'],CommunicationLog:['create'],Opportunity:['filter','create'],ChatConversation:['create']};
const id=x=>typeof x==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(x);
export function prepareCrmStep({entities,entity,method,args,validateReceipt}={}){
 if(!Object.hasOwn(allowed,entity)||!allowed[entity].includes(method)||!Array.isArray(args)||typeof validateReceipt!=='function')throw Error('Unapproved CRM step');
 if(method==='create'&&args.length!==1||method==='filter'&&(args.length<1||args.length>5))throw Error('Invalid arguments');
 // Fixed snapshot: later mutation of caller data cannot alter a prepared request.
 const encoded=JSON.stringify(args);
 if(!encoded||Buffer.byteLength(encoded)>32768)throw Error('Arguments too large');
 const snapshot=JSON.parse(encoded);
 const handler=entities?.[entity],invoke=handler?.[method];
 if(typeof invoke!=='function')throw Error('Missing SDK method');
 let used=false;
 return async ({ledger,request})=>{
  if(used)return {status:'blocked'};
  used=true; // even ambiguous admission cannot reuse this closure
  let receipt;
  const result=await executeStep({ledger,request,
   effect:async()=>{receipt=await invoke.apply(handler,JSON.parse(JSON.stringify(snapshot)));return receipt;},
   validateReceipt:r=>(method==='create'?r!==null&&typeof r==='object'&&!Array.isArray(r)&&id(r.id):Array.isArray(r)&&r.every(x=>x&&id(x.id)))&&validateReceipt(r)===true,
   receiptTag:r=>createHash('sha256').update(JSON.stringify({entity,method,receipt:r})).digest('hex')});
  // Only a SQL-confirmed step exposes data to the next worker step. Never delivered=true.
  return result.status==='confirmed'?{...result,receipt}:result;
 };
}
