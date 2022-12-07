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
  targetingCatergories: z.object({
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
