import winston, { createLogger } from 'winston';
import expressWinston from 'express-winston';

import { isProduction } from './process';

const logger = createLogger({
  transports: [
    new winston.transports.Console({
      level: isProduction ? 'info' : 'debug',
    }),
  ],
});

const headersToRedact = ['authorization'];

export const getLoggingMiddleware = () =>
  expressWinston.logger({
    winstonInstance: logger,
    headerBlacklist: headersToRedact,
  });

export default logger;
