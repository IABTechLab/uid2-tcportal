// Env that src/utils/process.ts reads at import time; without the TCP_SYSTEM_* values it exits the process.
process.env.TCP_SYSTEM_SECRET = 'test-system-secret';
process.env.TCP_SYSTEM_SALT = 'test-system-salt';
process.env.OPTOUT_API_KEY = 'test-optout-api-key';
process.env.OPTOUT_API_SECRET = Buffer.alloc(32, 7).toString('base64');
process.env.OPTOUT_ENDPOINT_URL = 'https://optout.test/v2/token/logout';
process.env.RECAPTCHA_PROJECT_ID = 'test-project';
process.env.RECAPTCHA_V3_SITE_KEY = 'test-site-key';
process.env.SERVICE_INSTANCE_ID_PREFIX = 'test-instance';
process.env.ID_TYPE = 'UID2';
process.env.VIEW_FOLDER = '../views_uid2/';
process.env.LOCALE_FOLDER = '../public/locales_uid2';
