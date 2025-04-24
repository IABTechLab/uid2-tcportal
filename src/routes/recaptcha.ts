import { RecaptchaEnterpriseServiceClient } from '@google-cloud/recaptcha-enterprise';

import logger from '../utils/logging';

const { RECAPTCHA_PROJECT_ID, RECAPTCHA_V3_SITE_KEY } = process.env;
const SCORE_THRESHOLD = 0.5;

export default async function createAssessment(token: string, recaptchaAction: string) {
  const projectId = RECAPTCHA_PROJECT_ID;
  const client = new RecaptchaEnterpriseServiceClient();
  const projectPath = client.projectPath(projectId);

  // Build the assessment request.
  const request = ({
    assessment: {
      event: {
        token,
        siteKey: RECAPTCHA_V3_SITE_KEY,
        // ** available but currently unused
        //userIpAddress: userIpAddress,
        //userAgent: userAgent,
      },
    },
    parent: projectPath,
  });

  const [response] = await client.createAssessment(request);

  // Check if the token is valid.
  if (!response.tokenProperties?.valid) {
    logger.error(`The CreateAssessment call failed because the token was: ${response.tokenProperties?.invalidReason}`);
    return null;
  }

  if (response.tokenProperties.action !== recaptchaAction) {
    logger.error('recaptcha action does not match expected value');
    return null;
  }

  if (response.riskAnalysis) {
    return (response.riskAnalysis.score ?? 0) >= SCORE_THRESHOLD;
  } 
  
  logger.error('unknown recaptcha error');
  return null;
}
