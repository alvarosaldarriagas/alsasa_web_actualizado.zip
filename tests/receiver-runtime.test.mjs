import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readReceiverConfig } from '../candidates/base44/runtime-config.mjs';
import { createReceiverRuntime } from '../candidates/base44/receiver-runtime.mjs';
import { InventoryAdmissionLedger } from '../candidates/base44/inventory-ledger.mjs';
const signing = randomBytes(32).toString('hex'), identity = randomBytes(32).toString('hex'), encryption = randomBytes(32).toString('hex');
const env = {
 ALSASA_CAPTURE_ENABLED:'true', ALSASA_CAPTURE_SCOPE:'pilot', ALSASA_CAPTURE_POLICY:'window',
 ALSASA_CAPTURE_STARTS_AT:'2026-09-20T00:00:00Z',ALSASA_CAPTURE_ENDS_AT:'2026-09-20T01:00:00Z',
 ALSASA_CAPTURE_SIGNING_KEY:signing, ALSASA_CAPTURE_IDENTITY_KEY:identity,
 ALSASA_CAPTURE_KEYRING_JSON:JSON.stringify({activeId:'test',entries:[{id:'test',key:encryption}]}),
 ALSASA_CAPTURE_ADMISSION_DATABASE_URL:'postgres://alsasa_capture_admit:test@ep-test-pooler.us-east-1.aws.neon.tech/db',
 ALSASA_CAPTURE_EXECUTION_DATABASE_URL:'postgres://alsasa_capture_exec:test@ep-test-pooler.us-east-1.aws.neon.tech/db',
 ALSASA_BASE44_SERVICE_TOKEN:'synthetic-test-only-service-token',
};
test('configuration fixes CRM origin, TLS and least privilege roles',()=>{
 const c=readReceiverConfig(env);assert.equal(c.serverUrl,'https://base44.app');
 assert.equal(c.admission.user,'alsasa_capture_admit');assert.equal(c.execution.user,'alsasa_capture_exec');assert.equal(c.admission.ssl.rejectUnauthorized,true);
});
for(const [name,change]of [
 ['key reuse',{ALSASA_CAPTURE_IDENTITY_KEY:signing}],['missing old key material',{ALSASA_CAPTURE_KEYRING_JSON:'{}'}],
 ['owner credentials',{ALSASA_CAPTURE_ADMISSION_DATABASE_URL:env.ALSASA_CAPTURE_ADMISSION_DATABASE_URL.replace('alsasa_capture_admit','neondb_owner')}],
 ['different database',{ALSASA_CAPTURE_EXECUTION_DATABASE_URL:env.ALSASA_CAPTURE_EXECUTION_DATABASE_URL.replace('/db','/other')}],
 ['unbounded pilot',{ALSASA_CAPTURE_ENDS_AT:'2027-01-01T00:00:00Z'}],
])test(name+' fails before any pool or CRM construction',async()=>{
 let calls=0;class Pool{constructor(){calls++;}}
 const r=createReceiverRuntime({kind:'form',env:{...env,...change},Pool});
 assert.equal((await r.handle(new Request('https://example.test/functions/publicApi',{method:'POST'}))).status,503);assert.equal(calls,0);await r.close();
});
test('paused receiver preserves public GET and OPTIONS but no write fallback',async()=>{
 let reads=0;const r=createReceiverRuntime({kind:'form',env:{},readPublic:()=>{reads++;return Response.json({properties:[]});}});
 for(const method of ['GET','OPTIONS'])assert.equal((await r.handle(new Request('https://example.test/functions/publicApi',{method}))).status,200);
 for(const method of ['POST','PUT','PATCH','DELETE'])assert.ok([503,405].includes((await r.handle(new Request('https://example.test/functions/publicApi',{method}))).status));
 assert.equal(reads,2);await r.close();
});
function ledger(inventory,commit='COMMIT'){
 const calls=[];let destroyed;
 return { calls, get destroyed(){return destroyed;}, instance:new InventoryAdmissionLedger({connect:async()=>({
  query:async sql=>{calls.push(sql);if(sql.includes('required_capture_keys'))return {rows:[{keys:inventory}]};if(sql.includes('.capture('))return {rows:[{r:{status:'admitted'}}]};return {command:sql==='COMMIT'?commit:sql};},
  release:flag=>{destroyed=flag;},
 })},'pilot',['old','new'])};
}
test('required old keys are checked in the same transaction before admission',async()=>{
 const l=ledger(['old']);assert.equal((await l.instance.call('admit',{payload:{keyId:'new'}})).status,'admitted');
 assert.ok(l.calls.findIndex(x=>x.includes('required_capture_keys'))<l.calls.findIndex(x=>x.includes('.capture(')));assert.equal(l.calls.at(-1),'COMMIT');
});
test('missing historical key blocks admission even when active key is present',async()=>{
 const l=ledger(['unavailable']);await assert.rejects(l.instance.call('admit',{payload:{keyId:'new'}}));
 assert.equal(l.calls.some(x=>x.includes('.capture(')),false);assert.equal(l.destroyed,true);
});
test('inventory or commit ambiguity cannot produce success or automatic retry',async()=>{
 for(const inventory of [null,{},['old']]){
  const l=ledger(inventory,'UNKNOWN');await assert.rejects(l.instance.call('admit',{payload:{keyId:'new'}}));
  assert.ok(l.calls.filter(x=>x.includes('.capture(')).length<=1);assert.equal(l.destroyed,true);
 }
});
