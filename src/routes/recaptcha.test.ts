import createAssessment from './recaptcha';

const mockCreateAssessment = jest.fn();
jest.mock('@google-cloud/recaptcha-enterprise', () => ({
  RecaptchaEnterpriseServiceClient: jest.fn().mockImplementation(() => ({
    projectPath: (projectId: string) => `projects/${projectId}`,
    createAssessment: (...args: unknown[]) => mockCreateAssessment(...args),
  })),
}));

const traceId = { traceId: 'trace-1', uidTraceId: 'uid-trace-1' };

const assessment = (tokenProperties: object, riskAnalysis?: object) => [{ tokenProperties, riskAnalysis }];

describe('createAssessment', () => {
  beforeEach(() => {
    mockCreateAssessment.mockReset();
  });

  it.each(['', '   '])('rejects an empty token (%p) without calling reCAPTCHA', async (token) => {
    await expect(createAssessment(token, 'email_prompt', traceId)).resolves.toBeNull();
    expect(mockCreateAssessment).not.toHaveBeenCalled();
  });

  it('sends the token, site key and client IP to the configured project', async () => {
    mockCreateAssessment.mockResolvedValue(assessment({ valid: true, action: 'email_prompt' }, { score: 0.9 }));

    await createAssessment('token-1', 'email_prompt', traceId, '203.0.113.7');

    expect(mockCreateAssessment).toHaveBeenCalledWith({
      assessment: { event: { token: 'token-1', siteKey: 'test-site-key', userIpAddress: '203.0.113.7' } },
      parent: 'projects/test-project',
    });
  });

  it.each([
    ['a high score', assessment({ valid: true, action: 'email_prompt' }, { score: 0.9 }), true],
    ['a score at the threshold', assessment({ valid: true, action: 'email_prompt' }, { score: 0.5 }), true],
    ['a score just below the threshold', assessment({ valid: true, action: 'email_prompt' }, { score: 0.49 }), false],
    ['a missing score', assessment({ valid: true, action: 'email_prompt' }, { score: null }), false],
    ['an invalid token', assessment({ valid: false, invalidReason: 'EXPIRED' }, { score: 0.9 }), null],
    ['a mismatched action', assessment({ valid: true, action: 'other_action' }, { score: 0.9 }), null],
    ['no risk analysis', assessment({ valid: true, action: 'email_prompt' }), null],
  ])('returns the expected result for %s', async (_description, response, expected) => {
    mockCreateAssessment.mockResolvedValue(response);
    await expect(createAssessment('token-1', 'email_prompt', traceId)).resolves.toBe(expected);
  });
});
