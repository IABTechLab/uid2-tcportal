import crypto from 'crypto';

import { SYSTEM_SALT, SYSTEM_SECRET } from '../utils/process';

const algo = 'aes-128-gcm';
const ivLength = 12;
const authTagLength = 16;

const key = Buffer.from(crypto.hkdfSync('sha256', SYSTEM_SECRET, SYSTEM_SALT, '', 16));

export function encrypt(input: string): string {
  const iv = crypto.randomBytes(ivLength);
  const cipher = crypto.createCipheriv(algo, key, iv);
  const encrypted = cipher.update(input, 'utf8', 'base64') + cipher.final('base64');

  return `${iv.toString('base64')};${encrypted};${cipher.getAuthTag().toString('base64')}`;
}

export function decrypt(input: string): string {
  const parts = input.split(';');

  if (!parts || parts.length !== 3) {
    throw new Error('Invalid Enrypted payload');
  }

  const iv = Buffer.from(parts[0], 'base64');
  const authTag = Buffer.from(parts[2], 'base64');
  // Reject bad lengths up front: the IV has to match what encrypt produced, and
  // setAuthTag would otherwise accept a truncated tag, weakening the integrity check.
  if (iv.length !== ivLength || authTag.length !== authTagLength) {
    throw new Error('Invalid Enrypted payload');
  }

  const decipher = crypto.createDecipheriv(algo, key, iv);
  decipher.setAuthTag(authTag);

  // final() throws if the payload fails authentication.
  return decipher.update(parts[1], 'base64', 'utf8') + decipher.final('utf8');
}
