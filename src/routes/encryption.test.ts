import { decrypt, encrypt } from './encryption';

const toBase64 = (bytes: Buffer) => bytes.toString('base64');
const fromBase64 = (value: string) => Buffer.from(value, 'base64');

const replaceFirstByte = (value: string) => {
  const bytes = fromBase64(value);
  bytes[0] = (bytes[0] + 1) % 256;
  return toBase64(bytes);
};

describe('encryption', () => {
  it.each(['user@example.com', '+12015550123'])('round-trips %s', (input) => {
    expect(decrypt(encrypt(input))).toBe(input);
  });

  it('uses a fresh IV for every payload', () => {
    expect(encrypt('user@example.com')).not.toBe(encrypt('user@example.com'));
  });

  const [iv, ciphertext, authTag] = encrypt('user@example.com').split(';');

  it.each([
    ['a payload without three parts', `${iv};${ciphertext}`],
    ['a tampered ciphertext', `${iv};${replaceFirstByte(ciphertext)};${authTag}`],
    ['a tampered auth tag', `${iv};${ciphertext};${replaceFirstByte(authTag)}`],
    ['an IV of the wrong length', `${toBase64(fromBase64(iv).subarray(0, 8))};${ciphertext};${authTag}`],
    ['a truncated auth tag', `${iv};${ciphertext};${toBase64(fromBase64(authTag).subarray(0, 4))}`],
  ])('rejects %s', (_description, payload) => {
    expect(() => decrypt(payload)).toThrow();
  });
});
