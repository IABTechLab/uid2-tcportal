import { AxiosError } from 'axios';
import express, { RequestHandler } from 'express';
import { PhoneNumberFormat, PhoneNumberUtil } from 'google-libphonenumber';
import Handlebars from 'hbs';
import createError from 'http-errors';
import i18n from 'i18n';
import { z } from 'zod';

import {
  countryDict, countryList, phoneExampleDict, phoneLibSupportedCountries, 
} from '../utils/countries';
import { getLoggers, getTraceId } from '../utils/loggingHelpers';
import { isDevelopment, RECAPTCHA_V3_SITE_KEY, SERVICE_INSTANCE_ID_PREFIX } from '../utils/process';
import { decrypt, encrypt } from './encryption';
import { optout } from './optout';
import createAssessment from './recaptcha'; 

const router = express.Router();
const { localLogger, errorLogger } = getLoggers();

const isValidEmail = (email: string) => {
  // eslint-disable-next-line no-control-regex
  const emailRegex = /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/;
  return emailRegex.test(email);
};

const validateAndNormalizePhone = (countryCode: string, phone: string) => {
  if (phoneLibSupportedCountries.has(countryCode)) {
    try {
      const phoneUtil = PhoneNumberUtil.getInstance();
      const p = phoneUtil.parse(phone, countryCode);
      if (!phoneUtil.isValidNumberForRegion(p, countryCode)) return '';
      return phoneUtil.format(p, PhoneNumberFormat.E164);
    } catch (err) {
      if (isDevelopment && err instanceof Error) localLogger.error(`Phone lib error: ${err.message}`);
      return '';
    }
  }

  const country = countryDict.get(countryCode);
  if (country === undefined) {
    return '';
  }

  const e164Phone = `+${country.callingCode}${phone}`;
  const phoneRegex = /^\+[0-9]{10,15}$/;
  if (phoneRegex.test(e164Phone)) return e164Phone;
  return '';
};

const EmailPromptRequest = z.object({
  email: z.string(),
  countryCode: z.string().optional(),
  phone: z.string().optional(),
  recaptcha: z.string(),
  idType: z.string().optional(),
});

const handleEmailPromptSubmission: RequestHandler<{}, z.infer<typeof EmailPromptRequest>> = async (req, res, _next) => {
  const traceId = getTraceId(req);
  try {
    EmailPromptRequest.parse(req.body);
  } catch (e) {
    errorLogger.error('error while parsing the request', traceId);
    _next(createError(400));
    return;
  }
  const {
    email, countryCode, phone, recaptcha, idType,
  } = EmailPromptRequest.parse(req.body);


  let idInput = '';
  if (idType === 'email') {
    if (!isValidEmail(email)) {
      res.render('index', { email, countryList, error: i18n.__('Please enter a valid email address') });
      return;
    }
    idInput = email;
  } else {
    if (!countryCode || !phone) {
      res.render('index', {
        countryList, error: i18n.__('Please enter a phone number'),
      });
      return;
    }
    idInput = validateAndNormalizePhone(countryCode, phone);
    if (idInput === '') {
      const phoneExample = phoneExampleDict.get(countryCode);
      res.render('index', {
        countryCode, phone, countryList, phoneExample, error: i18n.__('Please enter a valid phone number'), 
      });
      return;
    }
  }

  const success = await createAssessment(recaptcha, 'email_prompt', traceId);
  if (!success) {
    res.render('index', {
      email, countryCode, phone, countryList, error : i18n.__('Blocked-a-potentially-automated-request'), 
    });
    return;
  }

  const encrypted = await encrypt(idInput);
  res.render('email_verified', { email: idInput, encrypted });
};

const OptoutSubmitRequest = z.object({
  encrypted: z.string(),
});

const handleOptoutSubmit: RequestHandler<{}, { message: string } | { error: string }, z.infer<typeof OptoutSubmitRequest>> = async (req, res, _next) => {
  const { encrypted } = OptoutSubmitRequest.parse(req.body);
  const traceId = getTraceId(req);
  const instanceId = SERVICE_INSTANCE_ID_PREFIX;
  try {
    const payload = await decrypt(encrypted);
    await optout(payload, traceId, instanceId);

  } catch (e) {
    errorLogger.error(`optout error: ${e instanceof AxiosError && e.response?.data}`, traceId);
    res.render('index', { countryList, error : i18n.__('Sorry, we could not process your request.') });
    return;
  }

  res.render('confirmation', { message : '' });
};

/* GET home page. */
router.get('/', (_req, res, _next) => {
  res.render('index', {
    countryList,
    title: 'Transparent Advertising',
  });
});

enum Step {
  'email_prompt' = 'email_prompt',
  'optout_submit' = 'optout_submit',
}

const stepHandlers: Record<Step, RequestHandler> = {
  [Step.email_prompt]: handleEmailPromptSubmission,
  [Step.optout_submit]: handleOptoutSubmit,
};

const DefaultRouteRequest = z.object({
  step: z.nativeEnum(Step).optional(),
});

const defaultRouteHandler: RequestHandler<{}, {}, z.infer<typeof DefaultRouteRequest>> = async (req, res, next) => {
  let requestStep: Step | undefined;
  const traceId = getTraceId(req);
  try {
    requestStep = DefaultRouteRequest.parse(req.body).step; 
  } catch (e) {
    errorLogger.error('error while parsing step', traceId);
    next(createError(400));
    return;
  }
  
  if (requestStep) {
    const handler = stepHandlers[requestStep];
    await handler(req, res, next);
  } else {
    errorLogger.error('no step', traceId);
    next(createError(400));
  }
};

router.post('/', defaultRouteHandler);

router.get('/privacy', (req, res, _next) => {
  const language = req.acceptsLanguages()[0] ?? '';
  if (language === 'ja') {
    res.render('privacy_ja');
  } else {
    res.render('privacy');
  }
});

router.get('/ops/healthcheck', (req, res, _next) => {
  res.send('OK');
});

Handlebars.registerHelper('siteKeyInput', () => {
  return `<input type="hidden" name="recpatchaSiteKey" id="recpatchaSiteKey" value="${RECAPTCHA_V3_SITE_KEY}">`;
});

Handlebars.registerHelper('recaptchaScript', () => {
  return `<script src="https://www.google.com/recaptcha/enterprise.js?render=${RECAPTCHA_V3_SITE_KEY}"></script>`;
});

export default router;
