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

import axios from 'axios';

import { Buffer } from 'buffer'
import crypto from 'crypto'

import { OPTOUT_API_KEY, OPTOUT_API_SECRET, OPTOUT_ENDPOINT_URL } from '../utils/process';

interface Optout {
  phone?: string;
  email?: string;
};

export async function optout(identityInput: string): Promise<any> {
  let optout: Optout = {}
  if (identityInput[0] == '+') {
    optout.phone = identityInput
  } else {
    optout.email = identityInput
  }

  let dataBuf = Buffer.from(JSON.stringify(optout), "utf8")

  let tmBuf = Buffer.alloc(8)
  let now = new Date()
  tmBuf.writeBigUInt64BE(BigInt(now.getTime()), 0)

  let nonceBuf = crypto.randomBytes(8)

  let envelopBuf = Buffer.concat([tmBuf, nonceBuf, dataBuf])

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", OPTOUT_API_SECRET, iv);

  let versionBuf = Buffer.alloc(1)
  versionBuf[0] = 1

  let body = Buffer.concat([versionBuf, iv, cipher.update(envelopBuf), cipher.final(), cipher.getAuthTag()]).toString("base64")

  return axios.post(OPTOUT_ENDPOINT_URL, body,
    {
      headers: {
        Authorization: `Bearer ${OPTOUT_API_KEY}`,
        'Content-Type': 'text/plain'
      },
    })
}

export default optout;
