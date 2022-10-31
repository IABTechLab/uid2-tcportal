import crypto from 'crypto';

import { SYSTEM_SALT, SYSTEM_SECRET } from '../utils/process';

const algo = 'aes-128-cbc';

export async function encrypt(input: string): Promise<string> {
  const key: Buffer = await new Promise((resolve, reject) => {
    crypto.scrypt(SYSTEM_SECRET, SYSTEM_SALT, 16, (err, k) => (err ? reject(err) : resolve(k)));
  });

  return new Promise((resolve, reject) => { 
    crypto.randomFill(new Uint8Array(16), (err, iv) => {
      if (err) {
        reject(err);
        return;
      }
      const cipher = crypto.createCipheriv(algo, key, iv);
      let encrypted = '';
      cipher.setEncoding('base64');
      cipher.on('data', ((chunk) => { encrypted += chunk; }));
      cipher.on('end', () => resolve(`${Buffer.from(iv).toString('base64')};${encrypted}`));
      cipher.write(input);
      cipher.end();
    });
  });  
}

export async function decrypt(input: string): Promise<string> {
  const parts = input.split(';');

  if (!parts || parts.length !== 2) {
    throw new Error('Invalid Enrypted payload');
  }

  const iv = Uint8Array.from(Buffer.from(parts[0], 'base64'));
  return new Promise((resolve, reject) => {
    crypto.scrypt(SYSTEM_SECRET, SYSTEM_SALT, 16, (err, key) => {
      if (err) {
        reject(err);
        return;
      }
    
      const decipher = crypto.createDecipheriv(algo, key, iv);
    
      let decrypted = '';
      decipher.on('readable', () => {
        let chunk = decipher.read();
        while (chunk) {
          decrypted += chunk.toString('utf8');
          chunk = decipher.read();
        }
      });
    
      decipher.on('end', () => {
        resolve(decrypted);
      });
    
      decipher.write(parts[1], 'base64');
      decipher.end();
    
    });
  });

   
}
