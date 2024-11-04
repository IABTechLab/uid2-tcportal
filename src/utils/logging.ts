import expressWinston from 'express-winston';
import winston, { createLogger } from 'winston';

import { isProduction } from './process';

const logger = createLogger({
  transports: [
    new winston.transports.Console({
      level: isProduction ? 'info' : 'debug',
    }),
  ],
});

const headersToRedact = ['authorization', 'authentication'];

export const getLoggingMiddleware = () => expressWinston.logger({
  winstonInstance: logger,
  headerBlacklist: headersToRedact,
});

export default logger;
