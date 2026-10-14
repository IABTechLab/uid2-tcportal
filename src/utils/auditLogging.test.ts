/* eslint-disable camelcase */
import { auditTraceFormat } from './auditLogging';

const formatAuditLine = (req: object, statusCode = 200) => {
  const info = auditTraceFormat.transform({ level: 'info', message: '', meta: { req, res: { statusCode } } }) as { message: string };
  return JSON.parse(info.message);
};

describe('audit logging', () => {
  const formSubmission = {
    step: 'email_prompt',
    idType: 'email',
    context: 'email_prompt',
    email: 'user@example.com',
    countryCode: 'US',
    phone: '2015550123',
    recaptcha: 'recaptcha-token',
    encrypted: 'iv;ciphertext;tag',
  };

  it('records request metadata and only the allow-listed body fields', () => {
    const line = formatAuditLine({
      method: 'POST',
      path: '/',
      ip: '203.0.113.7',
      headers: { 'x-amzn-trace-id': 'Root=1-abc' },
      query: {},
      body: formSubmission,
    });

    expect(line).toMatchObject({
      log_type: 'audit',
      source: 'uid2-tcportal',
      status: 200,
      method: 'POST',
      endpoint: '/',
      trace_id: 'Root=1-abc',
      actor: JSON.stringify({ ip: '203.0.113.7', user_agent: '' }),
    });
    expect(line.request_body).toEqual({ idType: 'email', context: 'email_prompt' });
  });

  it.each(['user@example.com', '2015550123', 'recaptcha-token', 'iv;ciphertext;tag'])('never logs the submitted value %p', (value) => {
    const line = formatAuditLine({
      method: 'POST', path: '/', headers: {}, query: {}, body: formSubmission,
    });
    expect(JSON.stringify(line)).not.toContain(value);
  });

  it('logs no body or query fields for paths without an audit config', () => {
    const line = formatAuditLine({
      method: 'GET', path: '/privacy', headers: {}, query: { email: 'user@example.com' }, body: formSubmission,
    });
    expect(line.request_body).toEqual({});
    expect(line.query_params).toEqual({});
  });
});
