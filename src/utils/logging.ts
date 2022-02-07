import winston, { createLogger } from 'winston';

import { isProduction } from './process';

const logger = createLogger({
  transports: [
    new winston.transports.Console({
      level: isProduction ? 'info' : 'debug',
    }),
  ],
});

export default logger;
