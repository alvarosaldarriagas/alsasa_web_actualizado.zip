// Fixed destinations and logical bindings shared with the Base44 signed receiver.
export const CAPTURE_ROUTES = Object.freeze({
  form: Object.freeze({ app: '68b1e87f22e7326f9f762688', channel: 'web-contact', route: 'publicApi' }),
  chat: Object.freeze({ app: '68b1e87f22e7326f9f762688', channel: 'chat-capture', route: 'captureChatLead' }),
});
export const CAPTURE_ORIGIN = 'https://alsasa-crm-9f762688.base44.app';

export const TEST_CAPTURE_ORIGIN = 'https://share--alsasa-crm-9f762688.base44.app';
export const PILOT_CAPTURE_ROUTES = Object.freeze({ form: 'alsasaPilotForm', chat: 'alsasaPilotChat' });

// The pilot uses additive endpoints; live catalog/capture functions stay intact.
export function captureDestinationFor(kind, env) {
  const origin = captureOriginFor(env);
  if (!CAPTURE_ROUTES[kind]) throw Error('Unknown capture kind');
  const route = env.ALSASA_CAPTURE_DATA_ENV === 'dev' ? PILOT_CAPTURE_ROUTES[kind] : CAPTURE_ROUTES[kind].route;
  return `${origin}/functions/${route}`;
}

// This server configuration is mandatory. A Preview must never default to live CRM.
export function captureOriginFor(env) {
  const dataEnv = env.ALSASA_CAPTURE_DATA_ENV;
  const platform = env.VERCEL_ENV;
  if (!['dev', 'prod'].includes(dataEnv)) throw Error('Capture environment required');
  if (platform === 'production') {
    if (dataEnv !== 'prod') throw Error('Capture environment mismatch');
  } else if (platform === undefined || platform === 'preview' || platform === 'development') {
    if (dataEnv !== 'dev') throw Error('Capture environment mismatch');
  } else {
    throw Error('Unknown deployment environment');
  }
  return dataEnv === 'dev' ? TEST_CAPTURE_ORIGIN : CAPTURE_ORIGIN;
}
