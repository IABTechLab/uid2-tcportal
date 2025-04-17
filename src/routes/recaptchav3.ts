import { RecaptchaEnterpriseServiceClient } from '@google-cloud/recaptcha-enterprise';

const { RECAPTCHA_PROJECT_ID, RECAPTCHA_V3_SITE_KEY, GOOGLE_APPLICATION_CREDENTIALS_JSON } = process.env;


/**
* Create an assessment to analyze the risk of a UI action. Note that
* this example does set error boundaries and returns `null` for
* exceptions.
*
* projectID: Google Cloud project ID
* recaptchaKey: reCAPTCHA key obtained by registering a domain or an app to use the services of reCAPTCHA Enterprise.
* token: The token obtained from the client on passing the recaptchaKey.
* recaptchaAction: Action name corresponding to the token.
* userIpAddress: The IP address of the user sending a request to your backend is available in the HTTP request.
* userAgent: The user agent is included in the HTTP request in the request header.
* ja4: JA4 fingerprint associated with the request.
* ja3: JA3 fingerprint associated with the request.
*/
export default async function createAssessment(token: string, recaptchaAction: string) {
  const projectId = RECAPTCHA_PROJECT_ID;
  const serviceAccount = JSON.parse(GOOGLE_APPLICATION_CREDENTIALS_JSON);
  const client = new RecaptchaEnterpriseServiceClient({ credentials: serviceAccount });
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

  // client.createAssessment() can return a Promise or take a Callback
  const [response] = await client.createAssessment(request);

  // Check if the token is valid.
  if (!response.tokenProperties?.valid) {
    console.log(`The CreateAssessment call failed because the token was: ${response.tokenProperties?.invalidReason}`);

    return null;
  }

  // Check if the expected action was executed.
  // The `action` property is set by user client in the
  // grecaptcha.enterprise.execute() method.
  if (response.tokenProperties.action === recaptchaAction && response.riskAnalysis) {

    // Get the risk score and the reason(s).
    // For more information on interpreting the assessment,
    // see: https://cloud.google.com/recaptcha/docs/interpret-assessment
    console.log(`The reCAPTCHA score is: ${response.riskAnalysis.score}`);

    response.riskAnalysis.reasons?.forEach((reason: any) => {
      console.log(reason);
    });
    return response.riskAnalysis.score ?? 0 >= 0.5;
  } 
  console.log('The action attribute in your reCAPTCHA tag does not match the action you are expecting to score');
  return null;
  
}
