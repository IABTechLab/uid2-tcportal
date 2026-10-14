import axios from 'axios';
import crypto from 'crypto';

import { OPTOUT_API_KEY, OPTOUT_API_SECRET, OPTOUT_ENDPOINT_URL } from '../utils/process';
import { optout } from './optout';

jest.mock('axios');
const mockedPost = axios.post as jest.Mock;

// Mirrors the v1 envelope the optout service decrypts: version(1) | iv(12) | AES-256-GCM(timestamp(8) | nonce(8) | JSON) | tag(16).
const decryptRequestBody = (body: string) => {
  const bytes = Buffer.from(body, 'base64');
  const iv = bytes.subarray(1, 13);
  const decipher = crypto.createDecipheriv('aes-256-gcm', OPTOUT_API_SECRET, iv);
  decipher.setAuthTag(bytes.subarray(bytes.length - 16));
  const envelope = Buffer.concat([decipher.update(bytes.subarray(13, bytes.length - 16)), decipher.final()]);
  return {
    version: bytes[0],
    timestamp: Number(envelope.readBigUInt64BE(0)),
    payload: JSON.parse(envelope.subarray(16).toString('utf8')),
  };
};

describe('optout', () => {
  const traceId = { traceId: 'trace-1', uidTraceId: 'uid-trace-1' };
  const clientIp = '203.0.113.7';

  beforeEach(() => {
    mockedPost.mockReset();
    mockedPost.mockResolvedValue({ status: 200 });
  });

  it.each([
    ['an email', 'user@example.com', { clientIp, email: 'user@example.com' }],
    ['a phone number', '+12015550123', { clientIp, phone: '+12015550123' }],
  ])('posts %s as an encrypted v1 envelope', async (_description, identity, expectedPayload) => {
    const before = Date.now();
    await optout(identity, traceId, 'instance-1', clientIp);
    const after = Date.now();

    expect(mockedPost).toHaveBeenCalledTimes(1);
    const [url, body, config] = mockedPost.mock.calls[0];
    expect(url).toBe(OPTOUT_ENDPOINT_URL);
    expect(config).toEqual({
      headers: {
        Authorization: `Bearer ${OPTOUT_API_KEY}`,
        'Content-Type': 'text/plain',
        'uid-trace-id': 'uid-trace-1',
        'uid-instance-id': 'instance-1',
      },
    });

    const { version, timestamp, payload } = decryptRequestBody(body);
    expect(version).toBe(1);
    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(after);
    expect(payload).toStrictEqual(expectedPayload);
  });

  it('propagates optout service failures', async () => {
    mockedPost.mockRejectedValue(new Error('service unavailable'));
    await expect(optout('user@example.com', traceId, 'instance-1', clientIp)).rejects.toThrow('service unavailable');
  });
});
