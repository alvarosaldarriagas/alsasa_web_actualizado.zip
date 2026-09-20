// Explicit isolated branch only. No CRM calls; temporary roles always closed.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { randomUUID, randomBytes } from 'node:crypto';
import pg from 'pg';
import { InventoryAdmissionLedger } from '../candidates/base44/inventory-ledger.mjs';
import { CaptureLedger } from '../tests/fixtures/base44-security/inbox-2026-09-15/capture-ledger.mjs';
import { InboxKeyring } from '../tests/fixtures/base44-security/inbox-2026-09-15/keyring.mjs';
import { commercialPlan } from '../tests/fixtures/base44-security/commercial-2026-09-19/commercial-flow.mjs';
import { bodyTag } from '../lib/guard-protocol.mjs';
const path='/tmp/alsasa-receiver-inventory-connection.txt',url=new URL(readFileSync(path,'utf8'));
assert.equal(url.hostname,'ep-gentle-haze-ausjg9f8.c-10.us-east-1.aws.neon.tech');assert.equal(url.pathname,'/alsasa_guard_test');
const cfg={host:url.hostname,database:'alsasa_guard_test',ssl:{rejectUnauthorized:true,servername:url.hostname},connectionTimeoutMillis:15000,statement_timeout:10000,max:4};
const admin=new pg.Pool({...cfg,user:decodeURIComponent(url.username),password:decodeURIComponent(url.password)}),pw=randomBytes(32).toString('hex');
const admit=new pg.Pool({...cfg,user:'alsasa_capture_admit',password:pw});
const scope='inventory-'+randomUUID(),results=[],signing=randomBytes(32),old=randomBytes(32),current=randomBytes(32);
const ring=new InboxKeyring({activeId:'old',entries:[{id:'old',key:old}],requiredKeyIds:[],signingKey:signing});
const nextRing=new InboxKeyring({activeId:'new',entries:[{id:'old',key:old},{id:'new',key:current}],requiredKeyIds:['old'],signingKey:signing});
let installed=false,closed=false;
const check=async(name,fn)=>{await fn();results.push({name,passed:true});console.log('PASS '+name);};
const bytes=Buffer.from(JSON.stringify({full_name:'Persona ficticia',email:'test@example.invalid',consent:true}));
const request=()=>({operation:randomUUID(),channel:'web-contact',policy:'w',subject:'a'.repeat(64),bodyTag:bodyTag(signing,bytes),expiresAt:Date.now()+240000,plan:commercialPlan('form')});
try{
 assert.equal((await admin.query('SELECT count(*) n FROM alsasa_guard_v1.gate WHERE enabled')).rows[0].n,'0');
 await admin.query(readFileSync(new URL('../migrations/20260920-receiver-key-inventory.sql',import.meta.url),'utf8'));installed=true;
 await admin.query("ALTER ROLE alsasa_capture_admit LOGIN PASSWORD '"+pw+"'");
 await admin.query("INSERT INTO alsasa_guard_v1.gate VALUES($1,true,'w','alsasa_capture_admit','alsasa_capture_exec')",[scope]);
 await admin.query("INSERT INTO alsasa_guard_v1.windows VALUES($1,'w',now()-interval '1 minute',now()+interval '15 minutes',100)",[scope]);
 await admin.query("INSERT INTO alsasa_guard_v1.channels VALUES($1,'w','web-contact',$2)",[scope,JSON.stringify(commercialPlan('form'))]);
 await admin.query("INSERT INTO alsasa_guard_v1.buckets(scope,window_id,dimension,bucket,cap) VALUES($1,'w','channel','web-contact',100),($1,'w','resource','base44_sdk_attempt',1000)",[scope]);
 await check('Empty inventory returns no keys and no ciphertext',async()=>{
  const r=await admit.query('SELECT alsasa_guard_v1.required_capture_keys($1) AS keys',[scope]);assert.deepEqual(r.rows[0].keys,[]);
 });
 const initial=request();assert.equal((await ring.bind(new CaptureLedger(admit,scope),bytes).admit(initial)).status,'admitted');
 await check('Persisted older encryption key is detected',async()=>{
  assert.deepEqual((await admit.query('SELECT alsasa_guard_v1.required_capture_keys($1) AS keys',[scope])).rows[0].keys,['old']);
 });
 await check('Missing old key rejects before creating a new operation',async()=>{
  const r=request();await assert.rejects(nextRing.bind(new InventoryAdmissionLedger(admit,scope,['new']),bytes).admit(r));
  assert.equal((await admin.query('SELECT count(*) n FROM alsasa_guard_v1.operations WHERE scope=$1 AND operation_id=$2',[scope,r.operation])).rows[0].n,'0');
 });
 await check('Complete keyring authorizes encrypted admission and retains both key IDs',async()=>{
  assert.equal((await nextRing.bind(new InventoryAdmissionLedger(admit,scope,['old','new']),bytes).admit(request())).status,'admitted');
  assert.deepEqual((await admit.query('SELECT alsasa_guard_v1.required_capture_keys($1) AS keys',[scope])).rows[0].keys.sort(),['new','old']);
 });
 await check('Inventory holds the same gate row lock until admission transaction ends',async()=>{
  const a=await admit.connect(),b=await admin.connect();
  try{
   await a.query('BEGIN');await a.query('SELECT alsasa_guard_v1.required_capture_keys($1)',[scope]);
   await b.query('BEGIN');await b.query("SET LOCAL lock_timeout='100ms'");
   await assert.rejects(b.query('UPDATE alsasa_guard_v1.gate SET enabled=false WHERE scope=$1',[scope]),e=>e.code==='55P03');
  }finally{await a.query('ROLLBACK');await b.query('ROLLBACK');a.release();b.release();}
 });
 await check('Scope isolation and least-privilege inventory access are enforced',async()=>{
  const other=(await admin.query('SELECT scope FROM alsasa_guard_v1.gate WHERE scope<>$1 LIMIT 1',[scope])).rows[0].scope;
  await assert.rejects(admit.query('SELECT alsasa_guard_v1.required_capture_keys($1)',[other]),e=>e.code==='42501');
  await assert.rejects(admit.query('SELECT * FROM alsasa_guard_v1.inbox'),e=>e.code==='42501');
  for(const role of ['alsasa_web_ingress','alsasa_capture_exec'])assert.equal((await admin.query("SELECT has_function_privilege($1,'alsasa_guard_v1.required_capture_keys(text)','EXECUTE') AS allowed",[role])).rows[0].allowed,false);
 });
 await check('Corrupted inventory cannot authorize new storage',async()=>{
  await admin.query("UPDATE alsasa_guard_v1.inbox SET payload=payload-'keyId' WHERE scope=$1 AND operation_id=$2",[scope,initial.operation]);
  await assert.rejects(nextRing.bind(new InventoryAdmissionLedger(admit,scope,['old','new']),bytes).admit(request()));
 });
}finally{
 ring.destroy();nextRing.destroy();
 if(installed){
  await admin.query('UPDATE alsasa_guard_v1.gate SET enabled=false WHERE scope=$1',[scope]);
  await admin.query('ALTER ROLE alsasa_capture_admit NOLOGIN PASSWORD NULL');await admin.query('ALTER ROLE alsasa_capture_exec NOLOGIN PASSWORD NULL');
  closed=(await admin.query('SELECT count(*) n FROM alsasa_guard_v1.gate WHERE enabled')).rows[0].n==='0';assert.ok(closed);
 }
 await admit.end();await admin.end();unlinkSync(path);
 writeFileSync(new URL('../docs/receiver-inventory-evidence.json',import.meta.url),JSON.stringify({date:new Date().toISOString(),branch:'br-fragrant-frog-aun1tbvl',passed:results.length,results,installed,closed,realCrmCalls:0},null,2)+'\n');
}
console.log(JSON.stringify({passed:results.length,closed}));
