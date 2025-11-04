import axios from 'axios';
import { Buffer } from 'buffer';
import crypto from 'crypto';

import { TraceId } from '../utils/loggingHelpers';
import { OPTOUT_API_KEY, OPTOUT_API_SECRET, OPTOUT_ENDPOINT_URL } from '../utils/process';


interface Optout {
  phone?: string;
  email?: string;
  clientIp: string;
  instanceId: string;
}

export async function optout(identityInput: string, traceId: TraceId, instanceId: string, clientIp: string): Promise<any> {
  const optoutInfo: Optout = {
    clientIp,
    instanceId,
  };
  if (identityInput[0] === '+') {
    optoutInfo.phone = identityInput;
  } else {
    optoutInfo.email = identityInput;
  }

  const dataBuf = Buffer.from(JSON.stringify(optoutInfo), 'utf8');

  const tmBuf = Buffer.alloc(8);
  const now = new Date();
  tmBuf.writeBigUInt64BE(BigInt(now.getTime()), 0);

  const nonceBuf = crypto.randomBytes(8);

  const envelopBuf = Buffer.concat([tmBuf, nonceBuf, dataBuf]);

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', OPTOUT_API_SECRET, iv);

  const versionBuf = Buffer.alloc(1);
  versionBuf[0] = 1;

  const body = Buffer.concat([versionBuf, iv, cipher.update(envelopBuf), cipher.final(), cipher.getAuthTag()]).toString('base64');

  return axios.post(OPTOUT_ENDPOINT_URL, body,
    {
      headers: {
        Authorization: `Bearer ${OPTOUT_API_KEY}`,
        'Content-Type': 'text/plain',
        'uid-trace-id': traceId.uidTraceId,
        'uid-instance-id': instanceId,
      },
    });
}

export default optout;
