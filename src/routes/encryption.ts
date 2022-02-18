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

import crypto from 'crypto';

import { SYSTEM_CODE_SECRET, SYSTEM_SALT, SYSTEM_SECRET } from '../utils/process';

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
