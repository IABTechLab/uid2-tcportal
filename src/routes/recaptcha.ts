import axios from 'axios';

const { RECAPTCHA_SECRET } = process.env;
const API_ENDPOINT = 'https://www.google.com/recaptcha/api/siteverify';

export async function validate(recaptchaData: string): Promise<boolean> {
  const url = `${API_ENDPOINT}?response=${recaptchaData}&secret=${RECAPTCHA_SECRET}`;

  const response = await axios.post<{ score: number }>(url);
  return response.data.score >= 0.5;
}

export default validate;
