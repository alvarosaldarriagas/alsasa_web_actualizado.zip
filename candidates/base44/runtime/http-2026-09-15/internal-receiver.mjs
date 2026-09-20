// INACTIVE internal HTTP boundary. No network/SDK imports or production listener.
// Trusted upstream must perform anti-bot checks before signing. Direct public use is prohibited.
import {verifyEnvelope,admit} from '../redesign-2026-09-15/protocol-reference.mjs';
export const INACTIVE=true;
const APP='68b1e87f22e7326f9f762688';
export const ROUTES=Object.freeze({
 form:{app:APP,channel:'web-contact',route:'publicApi',paths:['/functions/publicApi','/api/apps/'+APP+'/functions/publicApi']},
 chat:{app:APP,channel:'chat-capture',route:'captureChatLead',paths:['/functions/captureChatLead','/api/apps/'+APP+'/functions/captureChatLead']}
});
const reply=(status,code)=>Response.json({success:false,code},{status,headers:{'Cache-Control':'no-store'}});
export async function boundedBody(req,maximum=16384,deadline=2000){
 if(req.headers.get('content-encoding') && req.headers.get('content-encoding')!=='identity')throw Error('encoding');
 const length=req.headers.get('content-length');
 if(length!==null && (!/^[0-9]+$/.test(length)||Number(length)>maximum))throw Error('size');
 if(!req.body)throw Error('empty');
 const reader=req.body.getReader();let timer,total=0;const parts=[];
 const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('deadline')),deadline);});
 try{
  for(;;){
   const {done,value}=await Promise.race([reader.read(),timeout]);
   if(done)break;
   total+=value.byteLength;if(total>maximum)throw Error('size');parts.push(Buffer.from(value));
  }
  return Buffer.concat(parts);
 }finally{clearTimeout(timer);void reader.cancel().catch(()=>{});}
}
// policy, ledger, key, validator are trusted dependency injection, never request JSON.
// Validator must validate ALL fields and return true. No effects are invoked here.
export function createInternalReceiver({kind,policy={enabled:false},ledger,ledgerForBytes,key,validate,now=Date.now}={}){
 const binding=ROUTES[kind];
 return async req=>{
  if(!binding || policy.enabled!==true)return reply(503,'paused');
  if(typeof validate!=='function'||(!ledger&&typeof ledgerForBytes!=='function')||!Buffer.isBuffer(key)||key.length<32)return reply(503,'unconfigured');
  if(req.method!=='POST')return reply(405,'method_not_allowed');
  if(!binding.paths.includes(new URL(req.url).pathname))return reply(404,'route_not_found');
  if(req.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')return reply(415,'json_required');
  const header=req.headers.get('x-alsasa-envelope');
  if(!header||header.length>2048)return reply(401,'authorization_required');
  let envelope,bytes,body;
  try{envelope=JSON.parse(header);bytes=await boundedBody(req);}catch{return reply(400,'invalid_request');}
  const timestamp=now();
  // Logical route binding covers both verified Base44 path aliases.
  if(!verifyEnvelope(key,envelope,bytes,binding,timestamp))return reply(401,'invalid_authorization');
  if(!/^[a-f0-9]{64}$/.test(envelope.subject))return reply(401,'invalid_authorization');
  try{
   body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
   if(!body || typeof body!=='object'||Array.isArray(body)||body.consent!==true)return reply(400,'consent_required');
   if(await validate(body)!==true)return reply(400,'invalid_fields');
  }catch{return reply(400,'invalid_fields');}
  let requestLedger;
  try{requestLedger=ledgerForBytes?await ledgerForBytes(Buffer.from(bytes)):ledger;}catch{return reply(503,'temporarily_unavailable');}
  const result=await admit({policy:{...policy,...binding},plan:policy.plan,ledger:requestLedger,key,envelope,bytes,now:timestamp});
  // Base boundary reports reservation only. Durable wrapper supplies capture adapter and receipt wording.
  const statuses={admitted:[202,'reserved_not_delivered'],duplicate:[202,'already_reserved_not_confirmed'],
   conflict:[409,'operation_conflict'],limited:[429,'limit_reached'],closed:[503,'paused'],
   unauthorized:[401,'invalid_authorization'],unavailable:[503,'temporarily_unavailable']};
  return reply(...(statuses[result.status]??[503,'temporarily_unavailable']));
 };
}
