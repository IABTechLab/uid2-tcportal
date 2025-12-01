import { RecaptchaEnterpriseServiceClient } from '@google-cloud/recaptcha-enterprise';

import { getLoggers, TraceId } from '../utils/loggingHelpers';

const { RECAPTCHA_PROJECT_ID, RECAPTCHA_V3_SITE_KEY } = process.env;
const SCORE_THRESHOLD = 0.5;

export default async function createAssessment(token: string, recaptchaAction: string, traceId: TraceId, userIpAddress?: string) {
  const { errorLogger } = getLoggers();
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
        //userAgent: userAgent,
        ...(userIpAddress && { userIpAddress }),
      },
    },
    parent: projectPath,
  });

  const [response] = await client.createAssessment(request);

  // Check if the token is valid.
  if (!response.tokenProperties?.valid) {
    errorLogger.error(`The CreateAssessment call failed because the token was: ${response.tokenProperties?.invalidReason}`, traceId);
    return null;
  }

  if (response.tokenProperties.action !== recaptchaAction) {
    errorLogger.error('recaptcha action does not match expected value', traceId);
    return null;
  }

  if (response.riskAnalysis) {
    return (response.riskAnalysis.score ?? 0) >= SCORE_THRESHOLD;
  } 
  
  errorLogger.error('unknown recaptcha error', traceId);
  return null;
}
