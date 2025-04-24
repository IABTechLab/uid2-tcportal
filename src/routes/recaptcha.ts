import { RecaptchaEnterpriseServiceClient } from '@google-cloud/recaptcha-enterprise';

import logger from '../utils/logging';

const { RECAPTCHA_PROJECT_ID, RECAPTCHA_V3_SITE_KEY, GOOGLE_APPLICATION_CREDENTIALS } = process.env;
const SCORE_THRESHOLD = 0.5;

export default async function createAssessment(token: string, recaptchaAction: string) {
  console.log(`RECAPTCHA_PROJECT_ID: ${RECAPTCHA_PROJECT_ID}`);
  console.log(`RECAPTCHA_V3_SITE_KEY: ${RECAPTCHA_V3_SITE_KEY}`);
  console.log(`GOOGLE_APPLICATION_CREDENTIALS: ${GOOGLE_APPLICATION_CREDENTIALS}`);
  
  console.log('##########1##########');
  const projectId = RECAPTCHA_PROJECT_ID;
  // RecaptchaEnterpriseServiceClient() automatically looks for a credentials file path in GOOGLE_APPLICATION_CREDENTIALS
  // logger.info(GOOGLE_APPLICATION_CREDENTIALS);
  // // eslint-disable-next-line global-require
  // const fs = require('fs');
  // fs.readFile(GOOGLE_APPLICATION_CREDENTIALS, 'utf8', (err: any, data: string) => {
  //   if (err) {
  //     logger.info(`Error reading file: ${err}`);
  //     return;
  //   }
  //   try {
  //     console.log(`raw data: ${data}`);
  //     const jsonData = JSON.parse(data);
  //     console.log(`json data: ${jsonData.private_key}`);
  //   } catch (parseError) {
  //     logger.info(`Error parsing json: ${parseError}`);
  //   }
  // });
  console.log('##########2##########');
  const client = new RecaptchaEnterpriseServiceClient();
  console.log(`client: ${client}`);
  console.log('##########3##########');
  const projectPath = client.projectPath(projectId);
  console.log(`projectPath: ${projectPath}`);
  console.log('##########4##########');

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
  console.log(`request: ${JSON.stringify(request)}`);
  console.log('##########5##########');
  
  const [response] = await client.createAssessment(request);
  console.log(`response: ${JSON.stringify(response)}`);
  console.log('##########6##########');

  // Check if the token is valid.
  if (!response.tokenProperties?.valid) {
    console.log(`response.tokenProperties: ${JSON.stringify(response.tokenProperties)}`);
    logger.error('error', `The CreateAssessment call failed because the token was: ${response.tokenProperties?.invalidReason}`);
    return null;
  }
  console.log('##########7##########');

  if (response.tokenProperties.action !== recaptchaAction) {
    logger.error('error', 'recaptcha action does not match expected value');
    return null;
  }

  console.log('##########8##########');

  if (response.riskAnalysis) {
    return (response.riskAnalysis.score ?? 0) >= SCORE_THRESHOLD;
  } 

  console.log('##########9##########');
  
  logger.error('error', 'unknown recaptcha error');
  return null;
}
