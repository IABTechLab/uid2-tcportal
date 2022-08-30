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
import express from 'express';
import { z } from 'zod';

// TODO: Remove test data
const TEST_DATA = {
  advertiserName: 'Ralph\'s',
  privacyPolicy: 'https://transparentadvertising.org',
  interests: ['Healthy Living', 'Food & Drink', 'Food & Beverage Services'],
  targetingCategories: {
    history: true,
    interest: true,
    geography: false,
    contextual: true,
    model: true,
  },
  companies: ['Criteo', 'The Trade Desk', 'Google'],
};

const router = express.Router();

const AdDetailResponse = z.object({
  advertiserName: z.string(),
  privacyPolicy: z.string().url(),
  interests: z.array(z.string()),
  targetingCategories: z.object({
    history: z.boolean(),
    interest: z.boolean(),
    geography: z.boolean(),
    contextual: z.boolean(),
    model: z.boolean(),
  }),
  companies: z.array(z.string()),
});

async function getAdDetail(url: string) {
  const response = await axios.get(url);
  const result = AdDetailResponse.safeParse(response.data);
  if (result.success) {
    return result.data;
  }
  // TODO: Remove test data. Possibly do something with the error?
  return TEST_DATA;
}

router.get('/', (req, res, _next) => {
  if (req.query.apiUrl) {
    getAdDetail(req.query.apiUrl.toString()).then((adDetail) => {
      res.render('ad_detail', { adDetail });
    });
  } else {
    // TODO: Remove this and redirect to transparentadvertising.org if no apiurl
    res.render('ad_detail', {
      adDetail : TEST_DATA,
    });
  }
});

export default router;
