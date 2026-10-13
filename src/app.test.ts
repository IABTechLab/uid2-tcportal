import request from 'supertest';

import app from './app';
import { decrypt, encrypt } from './routes/encryption';
import { optout } from './routes/optout';
import createAssessment from './routes/recaptcha';

// The real metrics middleware starts a second HTTP server on import.
jest.mock('./middleware/metrics', () => ({
  __esModule: true,
  default: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));
jest.mock('./routes/optout', () => ({ optout: jest.fn() }));
jest.mock('./routes/recaptcha', () => ({ __esModule: true, default: jest.fn() }));

const mockedOptout = optout as jest.Mock;
const mockedCreateAssessment = createAssessment as jest.Mock;

const CLIENT_IP = '203.0.113.7';

const submit = (form: Record<string, string>) => request(app)
  .post('/')
  .set('X-Forwarded-For', `${CLIENT_IP}, 10.0.0.1`)
  .type('form')
  .send(form);

const encryptedFieldOf = (html: string) => {
  const match = html.match(/name='encrypted' value='([^']*)'/);
  // Handlebars HTML-escapes '=' in the base64 payload.
  return match?.[1].replace(/&#x3D;/g, '=');
};

describe('tcportal app', () => {
  beforeEach(() => {
    mockedOptout.mockReset();
    mockedCreateAssessment.mockReset();
  });

  describe('GET', () => {
    it('serves the healthcheck', async () => {
      const res = await request(app).get('/ops/healthcheck');
      expect(res.status).toBe(200);
      expect(res.text).toBe('OK');
    });

    it.each(['/', '/privacy'])('renders %s', async (path) => {
      const res = await request(app).get(path);
      expect(res.status).toBe(200);
      expect(res.type).toBe('text/html');
    });

    it('renders the Japanese privacy policy for Japanese browsers', async () => {
      const res = await request(app).get('/privacy').set('Accept-Language', 'ja');
      expect(res.text).toContain('プライバシーポリシー');
    });

    it('returns 404 for unknown paths', async () => {
      const res = await request(app).get('/does-not-exist');
      expect(res.status).toBe(404);
      expect(res.text).toContain('Page Not Found');
    });
  });

  it.each([
    ['no step', {}],
    ['an unknown step', { step: 'not_a_step' }],
  ])('rejects a POST with %s', async (_description, form) => {
    const res = await submit(form);
    expect(res.status).toBe(400);
  });

  describe('email_prompt step', () => {
    it.each([
      ['an email', { idType: 'email', email: 'user@example.com' }, 'user@example.com'],
      ['a phone number', { idType: 'phone', countryCode: 'US', phone: '(201) 555-0123' }, '+12015550123'],
    ])('verifies %s and returns it encrypted for the opt-out step', async (_description, form, expectedIdentity) => {
      mockedCreateAssessment.mockResolvedValue(true);

      const res = await submit({
        step: 'email_prompt', email: '', recaptcha: 'token-1', ...form,
      });

      expect(res.status).toBe(200);
      expect(mockedCreateAssessment).toHaveBeenCalledWith('token-1', 'email_prompt', expect.anything(), CLIENT_IP);
      const encrypted = encryptedFieldOf(res.text);
      expect(encrypted).toBeDefined();
      expect(decrypt(encrypted!)).toBe(expectedIdentity);
    });

    it.each([
      ['an invalid email', { idType: 'email', email: 'not-an-email' }, 'Please enter a valid email address.'],
      ['a missing phone number', { idType: 'phone', email: '' }, 'Please enter a phone number.'],
      ['an invalid phone number', {
        idType: 'phone', email: '', countryCode: 'US', phone: '123',
      }, 'Please enter a valid phone number.'],
    ])('rejects %s before calling reCAPTCHA', async (_description, form, expectedError) => {
      const res = await submit({ step: 'email_prompt', recaptcha: 'token-1', ...form });

      expect(res.status).toBe(200);
      expect(res.text).toContain(expectedError);
      expect(mockedCreateAssessment).not.toHaveBeenCalled();
      expect(encryptedFieldOf(res.text)).toBeUndefined();
    });

    it.each([false, null])('blocks the request when reCAPTCHA returns %p', async (result) => {
      mockedCreateAssessment.mockResolvedValue(result);

      const res = await submit({
        step: 'email_prompt', idType: 'email', email: 'user@example.com', recaptcha: 'token-1',
      });

      expect(res.text).toContain('Blocked a potentially automated request.');
      expect(encryptedFieldOf(res.text)).toBeUndefined();
    });

    it('returns 400 when the reCAPTCHA token is missing', async () => {
      const res = await submit({ step: 'email_prompt', idType: 'email', email: 'user@example.com' });
      expect(res.status).toBe(400);
      expect(mockedCreateAssessment).not.toHaveBeenCalled();
    });
  });

  describe('optout_submit step', () => {
    it('submits the decrypted identity to the optout service', async () => {
      mockedOptout.mockResolvedValue({ status: 200 });

      const res = await submit({ step: 'optout_submit', encrypted: encrypt('user@example.com') });

      expect(res.status).toBe(200);
      expect(res.text).toContain('We have received your request to opt out');
      expect(mockedOptout).toHaveBeenCalledWith('user@example.com', expect.anything(), 'test-instance', CLIENT_IP);
    });

    it('does not submit a tampered payload', async () => {
      const [iv, , authTag] = encrypt('user@example.com').split(';');
      const tampered = `${iv};${Buffer.from('attacker@example.com').toString('base64')};${authTag}`;

      const res = await submit({ step: 'optout_submit', encrypted: tampered });

      expect(res.text).toContain('Sorry, we could not process your request.');
      expect(mockedOptout).not.toHaveBeenCalled();
    });

    it('shows an error when the optout service fails', async () => {
      mockedOptout.mockRejectedValue(new Error('service unavailable'));

      const res = await submit({ step: 'optout_submit', encrypted: encrypt('user@example.com') });

      expect(res.text).toContain('Sorry, we could not process your request.');
      expect(res.text).not.toContain('We have received your request to opt out');
    });

    it('returns 400 for a non-string payload', async () => {
      const res = await request(app).post('/').send({ step: 'optout_submit', encrypted: 123 });
      expect(res.status).toBe(400);
      expect(mockedOptout).not.toHaveBeenCalled();
    });
  });
});
