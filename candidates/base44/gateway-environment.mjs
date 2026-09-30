// Environment consistency check only, not a replacement for SDK credential validation.
// Base44's gateway supplies the service JWT; never log or persist its contents.
export function gatewayDataEnvironment(headers) {
  const authorization = headers.get('Base44-Service-Authorization') || '';
  if (!/^Bearer [^\s]{16,8192}$/.test(authorization)) return null;
  const parts = authorization.slice(7).split('.');
  if (parts.length !== 3 || parts.some(part => !/^[a-zA-Z0-9_-]+$/.test(part))) return null;
  try {
    const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (!claims || typeof claims !== 'object' || Array.isArray(claims)) return null;
    // Observed live gateway credentials omit data_env; test credentials say "dev".
    const environment = claims.data_env === undefined ? 'prod' : claims.data_env;
    if (!['dev', 'prod'].includes(environment)) return null;
    const header = headers.get('X-Data-Env');
    if (environment === 'dev' && header !== 'dev') return null;
    if (environment === 'prod' && header !== null && header !== 'prod') return null;
    return environment;
  } catch {
    return null;
  }
}
