// Offline preparation only. This script neither logs in nor changes a database.
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { commercialPlan } from '../candidates/base44/runtime/commercial-2026-09-19/commercial-flow.mjs';
import { readReceiverConfig } from '../candidates/base44/runtime-config.mjs';
const directory = process.argv[2];
if (!/^\/tmp\/alsasa-pilot-private-[a-zA-Z0-9_-]+$/.test(directory || '') || existsSync(directory)) throw Error('Provide a fresh private /tmp/alsasa-pilot-private-* directory');
const key = () => randomBytes(32).toString('hex');
const suffix = randomUUID().replaceAll('-', '').slice(0, 12), scope = 'pilot_crm_' + suffix, ingress = 'pilot_web_' + suffix;
const policy = 'pilot_' + suffix, now = Date.now(), startsAt = new Date(now - 60000).toISOString(), endsAt = new Date(now + 7200000).toISOString();
const host = 'ep-gentle-haze-ausjg9f8-pooler.c-10.us-east-1.aws.neon.tech';
const passwords = Object.fromEntries(['alsasa_web_ingress','alsasa_capture_admit','alsasa_capture_exec'].map(role => [role,key()]));
const url = role => `postgresql://${role}:${passwords[role]}@${host}/alsasa_guard_test?sslmode=verify-full`;
const signing = key(), identity = key(), encryption = key(), subject = key();
const base44 = {
  ALSASA_CAPTURE_ENABLED:'true', ALSASA_CAPTURE_DATA_ENV:'dev', ALSASA_CAPTURE_SCOPE:scope, ALSASA_CAPTURE_POLICY:policy,
  ALSASA_CAPTURE_STARTS_AT:startsAt, ALSASA_CAPTURE_ENDS_AT:endsAt, ALSASA_CAPTURE_SIGNING_KEY:signing,
  ALSASA_CAPTURE_IDENTITY_KEY:identity, ALSASA_CAPTURE_KEYRING_JSON:JSON.stringify({activeId:policy,entries:[{id:policy,key:encryption}]}),
  ALSASA_CAPTURE_ADMISSION_DATABASE_URL:url('alsasa_capture_admit'), ALSASA_CAPTURE_EXECUTION_DATABASE_URL:url('alsasa_capture_exec'),
};
readReceiverConfig(base44);
const vercel = { ALSASA_WEB_PROTECTION_ENABLED:'true', ALSASA_CAPTURE_DATA_ENV:'dev', ALSASA_GUARD_DATABASE_URL:url('alsasa_web_ingress'),
  ALSASA_INGRESS_SCOPE:ingress, ALSASA_INGRESS_SUBJECT_KEY:subject, ALSASA_CAPTURE_SIGNING_KEY:signing, ALSASA_CAPTURE_POLICY:policy };
const plan = commercialPlan('form');
const sdkCap = plan.reduce((sum, step) => sum + step.costs.base44_sdk_attempt, 0);
const quote = value => "'" + String(value).replaceAll("'", "''") + "'";
const roles = Object.keys(passwords);
const sql = [
  'BEGIN;',
  `DO $check$ BEGIN IF current_database()<>'alsasa_guard_test' OR EXISTS(SELECT FROM alsasa_guard_v1.gate WHERE enabled) OR EXISTS(SELECT FROM pg_roles WHERE rolname IN (${roles.map(quote).join(',')}) AND rolcanlogin) THEN RAISE EXCEPTION 'Pilot requires closed isolated database'; END IF; END $check$;`,
  ...roles.map(role => `ALTER ROLE ${role} LOGIN PASSWORD ${quote(passwords[role])} VALID UNTIL ${quote(endsAt)};`),
  `INSERT INTO alsasa_guard_v1.gate(scope,enabled,current_window,admission_role,execution_role) VALUES(${quote(scope)},false,${quote(policy)},'alsasa_capture_admit','alsasa_capture_exec'),(${quote(ingress)},false,${quote(policy)},'alsasa_web_ingress','alsasa_capture_exec');`,
  `INSERT INTO alsasa_guard_v1.windows(scope,window_id,starts_at,ends_at,subject_limit) VALUES(${quote(scope)},${quote(policy)},${quote(startsAt)},${quote(endsAt)},1),(${quote(ingress)},${quote(policy)},${quote(startsAt)},${quote(endsAt)},3);`,
  `INSERT INTO alsasa_guard_v1.channels(scope,window_id,channel,plan) VALUES(${quote(scope)},${quote(policy)},'web-contact',${quote(JSON.stringify(plan))}::jsonb);`,
  `INSERT INTO alsasa_guard_v1.buckets(scope,window_id,dimension,bucket,cap) VALUES(${quote(scope)},${quote(policy)},'channel','web-contact',1),(${quote(scope)},${quote(policy)},'resource','base44_sdk_attempt',${sdkCap});`,
  `INSERT INTO alsasa_guard_v1.ingress_limits(scope,window_id,kind,interval_seconds,cap,global_cap,window_cap) VALUES(${quote(ingress)},${quote(policy)},'form',60,3,3,3),(${quote(ingress)},${quote(policy)},'chat',60,0,0,0);`,
  'COMMIT;',
].join('\n');
const enableSql = `UPDATE alsasa_guard_v1.gate SET enabled=true WHERE scope IN (${quote(scope)},${quote(ingress)}) AND current_window=${quote(policy)};\n`;
const closeSql = ['BEGIN;', `UPDATE alsasa_guard_v1.gate SET enabled=false WHERE scope IN (${quote(scope)},${quote(ingress)});`,
  ...roles.map(role => `ALTER ROLE ${role} NOLOGIN PASSWORD NULL VALID UNTIL 'infinity';`), 'COMMIT;'].join('\n');
const metadata = { preparedAt:new Date(now).toISOString(), expiresAt:endsAt, project:'green-recipe-32463242', branch:'br-fragrant-frog-aun1tbvl', database:'alsasa_guard_test',
  scope, ingress, policy, dataEnvironment:'dev', maxFormDeliveries:1, maxWebAttempts:3, maxSdkReservations:sdkCap, chatAdmissions:0,
  base44Secret:'ALSASA_PILOT_CAPTURE_CONFIG', vercelNames:Object.keys(vercel), vercelBranch:'security/turnstile-web-2026-09-19',
  fingerprints:Object.fromEntries(Object.entries({signing,identity,encryption,subject}).map(([name,value])=>[name,createHash('sha256').update(value).digest('hex')])),
  testLead:{full_name:'ALSASA PRUEBA TECNICA 20260928',email:`alsasa-pilot-${suffix}@example.invalid`,phone:'',message:'Prueba técnica aislada; no contactar.',consent:true} };
mkdirSync(directory,{mode:0o700});
for(const [name,content] of Object.entries({'base44-secret.json':JSON.stringify(base44),'vercel-env.json':JSON.stringify(vercel),'vercel.env':Object.entries(vercel).map(([k,v])=>`${k}=${v}`).join('\n'),
  'provision.sql':sql,'enable.sql':enableSql,'close.sql':closeSql,'metadata.json':JSON.stringify(metadata,null,2)}))writeFileSync(directory+'/'+name,content+'\n',{mode:0o600,flag:'wx'});
console.log(JSON.stringify({directory,...metadata}));
