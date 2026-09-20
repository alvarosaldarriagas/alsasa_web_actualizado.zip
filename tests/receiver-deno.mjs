// Runs bundled cutover entries with real pinned SDKs and localhost-only networking.
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { randomBytes } from 'node:crypto';
import { signEnvelope } from '../lib/guard-protocol.mjs';
import { CAPTURE_ROUTES } from '../lib/capture-contract.mjs';
const nativeServe = Deno.serve, stop = new AbortController();
let sdkCalls = 0, handler;
const server = nativeServe({ hostname: '127.0.0.1', port: 0, signal: stop.signal, onListen(){} }, () => {
 sdkCalls++;
 return Response.json([{ id:'synthetic-property',custom_id:'A1166',title:'Propiedad ficticia',web_visible:true,status:'available',description:'Descripción pública',owner_email:'private@example.invalid',internal_notes:'private' }]);
});
Deno.serve = callback => { handler=callback; return {}; };
const results=[];const check=async(name,fn)=>{await fn();results.push({name,passed:true});console.log('PASS '+name);};
const signing=randomBytes(32),identity=randomBytes(32),encryption=randomBytes(32);
const config={ALSASA_CAPTURE_ENABLED:'true',ALSASA_CAPTURE_SCOPE:'pilot',ALSASA_CAPTURE_POLICY:'window',
 ALSASA_CAPTURE_STARTS_AT:new Date(Date.now()-60000).toISOString(),ALSASA_CAPTURE_ENDS_AT:new Date(Date.now()+60000).toISOString(),
 ALSASA_CAPTURE_SIGNING_KEY:signing.toString('hex'),ALSASA_CAPTURE_IDENTITY_KEY:identity.toString('hex'),
 ALSASA_CAPTURE_KEYRING_JSON:JSON.stringify({activeId:'test',entries:[{id:'test',key:encryption.toString('hex')}]}),
 ALSASA_CAPTURE_ADMISSION_DATABASE_URL:'postgres://alsasa_capture_admit:synthetic@ep-test-pooler.us-east-1.aws.neon.tech/db',
 ALSASA_CAPTURE_EXECUTION_DATABASE_URL:'postgres://alsasa_capture_exec:synthetic@ep-test-pooler.us-east-1.aws.neon.tech/db',
 ALSASA_BASE44_SERVICE_TOKEN:'synthetic-not-a-real-service-token'};
try {
 for(const [name,kind]of [['publicApi','form'],['captureChatLead','chat']]){
  for(const k of Object.keys(config))Deno.env.delete(k);
  await import(new URL('../candidates/base44/generated/'+name+'.ts?paused',import.meta.url));
  await check(name+' missing configuration rejects writes',async()=>assert.equal((await handler(new Request('https://example.invalid/functions/'+name,{method:'POST'}))).status,503));
  if(kind==='form'){
   await check('Catalog OPTIONS still works while capture is paused',async()=>assert.equal((await handler(new Request('https://example.invalid/functions/publicApi',{method:'OPTIONS'}))).status,204));
   await check('Catalog GET uses pinned SDK and retains public projection',async()=>{
    const r=await handler(new Request('https://example.invalid/functions/publicApi',{headers:{'Base44-App-Id':CAPTURE_ROUTES.form.app,'Base44-Api-Url':'http://127.0.0.1:'+server.addr.port,'Base44-Service-Authorization':'Bearer synthetic-only'}}));
    assert.equal(r.status,200);const body=await r.json();assert.equal(body.properties[0].title,'Propiedad ficticia');assert.equal(body.properties[0].owner_email,undefined);assert.equal(body.properties[0].internal_notes,undefined);assert.equal(sdkCalls,1);
   });
  }
  for(const [k,v]of Object.entries(config))Deno.env.set(k,v);
  await import(new URL('../candidates/base44/generated/'+name+'.ts?configured',import.meta.url));
  await check(name+' unsigned POST is rejected before SQL or CRM',async()=>{
   const r=await handler(new Request('https://example.invalid/functions/'+name,{method:'POST',headers:{'content-type':'application/json'},body:'{}'}));assert.equal(r.status,401);
  });
  await check(name+' alternate method cannot reach a legacy write path',async()=>{
   assert.equal((await handler(new Request('https://example.invalid/functions/'+name,{method:'PUT'}))).status,405);
  });
  await check(name+' altered signature is rejected before SQL or CRM',async()=>{
   const bytes=Buffer.from(JSON.stringify({email:'test@example.invalid',consent:true}));
   const envelope=signEnvelope(signing,{...CAPTURE_ROUTES[kind],operation:'806c3f81-8d64-4f9c-82a8-b948094f32ab',subject:'a'.repeat(64),policy:'window',expiresAt:Date.now()+30000},bytes);
   const r=await handler(new Request('https://example.invalid/functions/'+name,{method:'POST',headers:{'content-type':'application/json','x-alsasa-envelope':JSON.stringify(envelope),'Base44-App-Id':CAPTURE_ROUTES[kind].app,'Base44-Service-Authorization':'Bearer synthetic-gateway-token','Base44-Api-Url':'https://ignored-header.invalid'},body:'{}'}));assert.equal(r.status,401);
  });
 }
 assert.equal(sdkCalls,1);
 console.log(JSON.stringify({passed:results.length,runtime:Deno.version,realCrmCalls:0,localCatalogReads:sdkCalls,results}));
} finally {stop.abort();await server.finished;Deno.serve=nativeServe;}
Deno.exit(0);
