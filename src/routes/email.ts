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

import logger from '../utils/logging';
import {
  isDevelopment, SENDGRID_API_KEY, SENDGRID_SENDER, SENDGRID_TEMPLATE_ID, 
} from '../utils/process';
import { encrypt } from './encryption';

export type VerificationResponse = { email: string, encrypted: string, code: string };
export async function sendVerificationCode(email: string, code: number): Promise<VerificationResponse> {

  if (isDevelopment) {
    logger.log('debug', `in development mode, code is ${code}`);
    return {
      email,
      code: code.toString(),
      encrypted: await encrypt(email),
    };
  }

  const response = await axios.post<VerificationResponse>('https://api.sendgrid.com/v3/mail/send',
    /* eslint-disable quote-props */
    {
      'from' : {
        'email' : SENDGRID_SENDER,
      },
      'personalizations' : [
        {
          'to' : [{ email }],
          'dynamic_template_data' : {
            code,
          },
        },
      ],
      'template_id' : SENDGRID_TEMPLATE_ID,
    },
    {
      'headers' : {
        'Authorization' : `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type' : 'application/json', 
      },
      /* eslint-enable quote-props */
    });

  return response.data;
}
