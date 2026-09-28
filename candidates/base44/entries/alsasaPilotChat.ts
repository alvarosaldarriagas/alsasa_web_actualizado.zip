import pg from 'npm:pg@8.23.0';
import { createAxiosClient } from 'npm:@base44/sdk@0.8.25/dist/utils/axios-client.js';
import { createEntitiesModule } from 'npm:@base44/sdk@0.8.25/dist/modules/entities.js';
import { createPilotRuntime } from '../pilot-runtime.mjs';
const receiver = createPilotRuntime({ kind: 'chat', config: Deno.env.get('ALSASA_PILOT_CAPTURE_CONFIG'), Pool: pg.Pool, createAxiosClient, createEntitiesModule });
Deno.serve(request => receiver.handle(request));
