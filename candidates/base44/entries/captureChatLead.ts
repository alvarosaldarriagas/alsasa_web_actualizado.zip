import pg from 'npm:pg@8.23.0';
const { Pool } = pg;
import { createAxiosClient } from 'npm:@base44/sdk@0.8.25/dist/utils/axios-client.js';
import { createEntitiesModule } from 'npm:@base44/sdk@0.8.25/dist/modules/entities.js';
import { createReceiverRuntime } from '../receiver-runtime.mjs';
const receiver = createReceiverRuntime({ kind: 'chat', env: Object.fromEntries(['ALSASA_CAPTURE_ENABLED','ALSASA_CAPTURE_SCOPE','ALSASA_CAPTURE_POLICY','ALSASA_CAPTURE_STARTS_AT','ALSASA_CAPTURE_ENDS_AT','ALSASA_CAPTURE_SIGNING_KEY','ALSASA_CAPTURE_IDENTITY_KEY','ALSASA_CAPTURE_KEYRING_JSON','ALSASA_CAPTURE_ADMISSION_DATABASE_URL','ALSASA_CAPTURE_EXECUTION_DATABASE_URL'].map(name => [name, Deno.env.get(name)])), Pool, createAxiosClient, createEntitiesModule });
Deno.serve(request => receiver.handle(request));
