declare global {
  namespace NodeJS {
    interface ProcessEnv {
      // Express
      PORT: string | undefined;

      // Recaptcha
      RECAPTCHA_SITE_KEY: string;
      RECAPTCHA_SECRET: string;

      OPTOUT_ENDPOINT_URL: string;
      OPTOUT_API_KEY: string;

      SYSTEM_SECRET: string;
      SYSTEM_SALT: string;
      SYSTEM_CODE_SECRET:string;
    }
  }
}

/**
 * Normalize a port into a number, string, or false.
 */
export function normalizePort(val: any): string | number | boolean {
  const port = parseInt(val, 10);
  
  if (isNaN(port)) {
    // named pipe
    return val;
  }
  
  if (port >= 0) {
    // port number
    return port;
  }
  
  return false;
}

export const PORT = (process.env.PORT && normalizePort(process.env.PORT)) || '3000';

export const RECAPTCHA_SITE_KEY = process.env.RECAPTCHA_SITE_KEY || '6Lctdo4aAAAAAMVYJ8bs_7VbYskEyBq3hDX2m6eQ';
export const { RECAPTCHA_SECRET } = process.env;

export const { OPTOUT_API_KEY } = process.env;
export const OPTOUT_ENDPOINT_URL = process.env.OPTOUT_ENDPOINT_URL || 'https://prod.uidapi.com/token/logout';

export const SYSTEM_SECRET = process.env.TCP_SYSTEM_SECRET as string || 'dev';
export const SYSTEM_SALT = process.env.TCP_SYSTEM_SALT as string || 'dev';
export const SYSTEM_CODE_SECRET = process.env.TCP_SYSTEM_CODE_SECRET as string || 'dev';

export const environment = ((): 'production' | 'development' => {
  const env = process.env.NODE_ENV as unknown as string[] | undefined;
  return (env || []).indexOf('development') > -1 ? 'development' : 'production';
})();

export const isDevelopment = environment === 'development';
export const isProduction = environment === 'production';
