import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createPilotRuntime } from '../candidates/base44/pilot-runtime.mjs';
import { signEnvelope } from '../lib/guard-protocol.mjs';
import { CAPTURE_ROUTES, PILOT_CAPTURE_ROUTES } from '../lib/capture-contract.mjs';
const key = randomBytes(32);
const env = { ALSASA_CAPTURE_ENABLED:'true', ALSASA_CAPTURE_DATA_ENV:'dev', ALSASA_CAPTURE_SCOPE:'pilot', ALSASA_CAPTURE_POLICY:'pilot',
  ALSASA_CAPTURE_STARTS_AT:new Date(Date.now()-60000).toISOString(), ALSASA_CAPTURE_ENDS_AT:new Date(Date.now()+600000).toISOString(),
  ALSASA_CAPTURE_SIGNING_KEY:key.toString('hex'), ALSASA_CAPTURE_IDENTITY_KEY:randomBytes(32).toString('hex'),
  ALSASA_CAPTURE_KEYRING_JSON:JSON.stringify({activeId:'pilot',entries:[{id:'pilot',key:randomBytes(32).toString('hex')}]}),
  ALSASA_CAPTURE_ADMISSION_DATABASE_URL:'postgres://alsasa_capture_admit:synthetic@ep-test-pooler.us-east-1.aws.neon.tech/db',
  ALSASA_CAPTURE_EXECUTION_DATABASE_URL:'postgres://alsasa_capture_exec:synthetic@ep-test-pooler.us-east-1.aws.neon.tech/db' };
const token = claims => 'Bearer e30.'+Buffer.from(JSON.stringify(claims)).toString('base64url')+'.synthetic_signature_only';
function fixture(kind, config=JSON.stringify(env)) {
  const calls={sql:0,crm:0,transport:0,pools:0};
  class Pool { constructor(){calls.pools++;} on(){} async end(){} async connect(){calls.sql++;throw Error('Synthetic SQL stop');} }
  const runtime=createPilotRuntime({kind,config,Pool,
    createAxiosClient:()=>{calls.transport++;return {interceptors:{request:{use(){}}}};},
    createEntitiesModule:()=>new Proxy({}, {get:()=>new Proxy({}, {get:()=>()=>{calls.crm++;throw Error('Unexpected CRM');}})}) });
  return {runtime,calls};
}
for (const kind of ['form','chat']) {
  const name=PILOT_CAPTURE_ROUTES[kind], binding=CAPTURE_ROUTES[kind];
  const body=Buffer.from(JSON.stringify(kind==='form'?{full_name:'Persona ficticia',email:'pilot@example.invalid',consent:true}:{name:'Persona ficticia',email:'pilot@example.invalid',consent:true,messages:[],qualification:{intent:'information',property_ids:[]}}));
  const request=(claims={data_env:'dev'}, header='dev', data=body, alias=false)=>new Request('https://example.invalid'+(alias?`/api/apps/${binding.app}`:'')+'/functions/'+name,{method:'POST',headers:{
    'content-type':'application/json','Base44-App-Id':binding.app,'Base44-Service-Authorization':token(claims),...(header?{'X-Data-Env':header}:{}),
    'x-alsasa-envelope':JSON.stringify(signEnvelope(key,{...binding,operation:randomUUID(),subject:'a'.repeat(64),policy:'pilot',expiresAt:Date.now()+30000},body))},body:data});
  test(name+' rejects absent or production configuration without pools',async()=>{
    for(const config of [undefined,'{}','[]','invalid',JSON.stringify({...env,ALSASA_CAPTURE_DATA_ENV:'prod'})]){
      const f=fixture(kind,config===undefined?'':config);assert.equal((await f.runtime.handle(request())).status,503);assert.equal(f.calls.pools,0);await f.runtime.close();
    }
  });
  test(name+' blocks live and ambiguous gateway context before SQL and SDK',async()=>{
    const f=fixture(kind);
    for(const [claims,header] of [[{},null],[{},'dev'],[{data_env:'dev'},null],[{data_env:'prod'},'prod']])assert.equal((await f.runtime.handle(request(claims,header))).status,503);
    assert.deepEqual([f.calls.sql,f.calls.crm,f.calls.transport],[0,0,0]);await f.runtime.close();
  });
  test(name+' preserves signature bytes and reaches admission through both fixed aliases',async()=>{
    const f=fixture(kind);
    for(const alias of [false,true])assert.equal((await f.runtime.handle(request({data_env:'dev'},'dev',body,alias))).status,503);
    assert.equal(f.calls.sql,2);assert.equal(f.calls.crm,0);await f.runtime.close();
  });
  test(name+' altered body or wrong path cannot reach SQL',async()=>{
    const f=fixture(kind);
    assert.equal((await f.runtime.handle(request({data_env:'dev'},'dev',Buffer.from('{}')))).status,401);
    assert.equal((await f.runtime.handle(new Request('https://example.invalid/functions/'+binding.route,request()))).status,404);
    assert.equal(f.calls.sql,0);assert.equal(f.calls.crm,0);await f.runtime.close();
  });
}
