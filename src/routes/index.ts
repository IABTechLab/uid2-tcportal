// Copyright (c) 2021 The Trade Desk, Inc
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are met:
//
// 1. Redistributions of source code must retain the above copyright notice,
//    this list of conditions and the following disclaimer.
// 2. Redistributions in binary form must reproduce the above copyright notice,
//    this list of conditions and the following disclaimer in the documentation
//    and/or other materials provided with the distribution.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
// AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
// IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
// ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
// LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
// CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
// SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
// INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
// CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
// ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
// POSSIBILITY OF SUCH DAMAGE.

import express, { RequestHandler } from 'express';
import Handlebars from 'hbs';
import i18n from 'i18n';
import { z } from 'zod';

import { RECAPTCHA_SITE_KEY } from '../utils/process';
import { sendVerificationCode } from './email';
import { createCode, decrypt, encrypt } from './encryption';
import { optout } from './optout';
import { validate } from './recaptcha';

const router = express.Router();

async function generateEmailChallenge(email: string): Promise<{ encrypted: string, code: number }> {
  // This is Epoch Ms
  const ts = Math.floor(new Date().getTime());
  const payload = {
    email,
    timestamp : ts,
  };

  const code = await createCode(email, ts);
  const encrypted = await encrypt(JSON.stringify(payload));
  return {
    code,
    encrypted,
  };
}

const isValidEmail = (email: string) => {
  // eslint-disable-next-line no-control-regex
  const emailRegex = /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/;
  return emailRegex.test(email);
};

const CodeVerificationRequest = z.object({
  email: z.string(),
  code: z.string(),
  encrypted: z.string(),
  recaptcha: z.string(),
});

const handleCodeVerification: RequestHandler<{}, { email: string, encrypted: string }, z.infer<typeof CodeVerificationRequest>> = async (req, res, _next) => {
  const {
    email: submittedEmail, code: submittedCode, encrypted: encryptedPayload, recaptcha, 
  } = CodeVerificationRequest.parse(req.body);

  let decrypted = '';
  try {
    decrypted = await decrypt(encryptedPayload);
  } catch {
    res.redirect('/');
    return;
  }

  const wasSuccessful = await validate(recaptcha);

  if (!wasSuccessful) {
    res.render('index', { email : submittedEmail, error : i18n.__('Blocked a potentially automated request. Please try again later.') });
    return;
  }

  const { email, timestamp } = JSON.parse(decrypted);

  const code = await createCode(email, timestamp);

  if (code.toString() !== submittedCode) {
    res.render('email_submit', {
      encrypted : encryptedPayload, code : submittedCode, email, error : i18n.__('Code does not match'), 
    });
  }

  const encrypted = await encrypt(email);
  res.render('email_verified', { email, encrypted });
};

const EmailPromptRequest = z.object({
  email: z.string(),
  recaptcha: z.string(),
});

const handleEmailPromptSubmission: RequestHandler<{}, z.infer<typeof EmailPromptRequest>, { email: string, encrypted: string, error?: string }> = async (req, res, _next) => {
  const { email, recaptcha } = EmailPromptRequest.parse(req.body);
  if (!isValidEmail(email)) {
    res.render('index', { email, error : i18n.__('Please enter a valid email address') });
    return;
  }

  const success = await validate(recaptcha);
  if (!success) {
    res.render('index', { email, error : i18n.__('Blocked a potentially automated request. Please try again later.') });
    return;
  }

  const { code, encrypted } = await generateEmailChallenge(email);
  try {
    await sendVerificationCode(email, code);
    res.render('email_submit', { encrypted, email });
  } catch {
    res.render('index', { email, error : i18n.__('Trouble sending verification email') });
  }
};

const OptoutSubmitRequest = z.object({
  encrypted: z.string(),
});

const handleOptoutSubmit: RequestHandler<{}, { message: string } | { error: string }, z.infer<typeof OptoutSubmitRequest>> = async (req, res, _next) => {
  const { encrypted } = OptoutSubmitRequest.parse(req.body);
  try {
    const payload = await decrypt(encrypted);
    await optout(payload);

  } catch (e) {
    res.render('index', { error : i18n.__('Sorry, we could not process your request.') });
    return;
  }

  res.render('confirmation', { message : '' });
};

const steps: Record<string, RequestHandler> = {
  /* eslint-disable quote-props */
  'email_prompt': handleEmailPromptSubmission,
  'code_submit' : handleCodeVerification,
  'optout_submit' : handleOptoutSubmit,
  /* eslint-enable quote-props */
} as const;

/* GET home page. */
router.get('/', (_req, res, _next) => {
  res.render('index', {
    title: 'Transparent Advertising',
  });
});

const DefaultRouteRequest = z.object({
  step: z.string(),
});

const defaultRouteHandler: RequestHandler<{}, {}, z.infer<typeof DefaultRouteRequest>> = async (req, res, next) => {
  const { step } = DefaultRouteRequest.parse(req.body);
  if (!step) {
    throw new Error('no step');
  }

  const handler = Object.prototype.hasOwnProperty.call(steps, step) && steps[step];
  if (!handler) {
    throw new Error(`invalid step ${step}`);
  }

  await handler(req, res, next);
};

router.post('/', defaultRouteHandler);

router.get('/ops/healthcheck', (req, res, _next) => {
  res.send('OK');
});

Handlebars.registerHelper('siteKeyInput', () => {
  return `<input type="hidden" name="recpatchaSiteKey" id="recpatchaSiteKey" value="${RECAPTCHA_SITE_KEY}">`;
});

Handlebars.registerHelper('recaptchaScript', () => {
  return `<script src="https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}"></script>`;
});
            
export default router;
