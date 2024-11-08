import expressWinston from 'express-winston';
import winston, { createLogger, format } from 'winston';

import { isProduction } from './process';

function truncateMessage(message: string, maxChars: number): string {
  return message.length > maxChars ? message.substring(0, maxChars) : message;
}

const formatInfo = format((info) => {
  if (info.private) { return false; }
  info.message = truncateMessage(info.message, 250);
  if (info.meta) {
    const {meta, ...rest} = info;
   return rest;
  }
  return info;
});

const logger = createLogger({
  transports: [
    new winston.transports.Console({
      level: isProduction ? 'info' : 'debug',
    }),
  ],
  format: format.combine(
    formatInfo(),
    format.json(),
  ),
});

logger.exceptions.handle(new winston.transports.Console({
  level: isProduction ? 'info' : 'debug',
}));
logger.exitOnError = false;

const headersToRedact = ['authorization', 'authentication'];

export const getLoggingMiddleware = () => expressWinston.logger({
  winstonInstance: logger,
  headerBlacklist: headersToRedact,
});

export default logger;