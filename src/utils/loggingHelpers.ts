import crypto from 'crypto';
import { Request } from 'express';
import expressWinston from 'express-winston';
import winston from 'winston';

import { isDevelopment } from './process';

export const traceFormat = winston.format.printf(({ 
  timestamp, 
  label, 
  level,
  message, 
  meta, 
}) => {
  const basicString = `${timestamp} [${label}] ${level}: ${message}`;
  const metaWithTypes = meta as {
    req?: {
      headers?: {
        traceId?: string;
        [key: string]: unknown;
      };
    };
    [key: string]: unknown;
  };

  const requestDetails = meta
    ? ` [traceId=${metaWithTypes?.req?.headers?.traceId ?? ''}] metadata=${JSON.stringify(meta)}`
    : '';
  return basicString + requestDetails;
});

// prevents very large junk messages from being logged
function truncateMessage(message: string, maxChars: number): string {
  return message.length > maxChars ? message.substring(0, maxChars) : message;
}

const formatInfo = winston.format((info) => {
  if (info.private) { return false; }
  const shortenedMessage = truncateMessage(info.message as string, 250);
  return { ...info, message: shortenedMessage };
});

const loggerFormat = () => {
  return winston.format.combine(
    winston.format.label({ label: 'uid2-tcportal' }),
    winston.format.timestamp(),
    winston.format.json(),
    traceFormat,
  );
};

const getTransports = () => {
  return [new winston.transports.Console()];
};

// logger without trace info
const localLogger = winston.createLogger({
  transports: getTransports(),
  format: winston.format.combine(
    winston.format.errors({ stack: isDevelopment }), // only show stack in development
    winston.format.timestamp(),
    formatInfo(),
    winston.format.json(),
  ),
});

const logger = winston.createLogger({
  transports: getTransports(),
  format: loggerFormat(),
});

const errorLogger = winston.createLogger({
  transports: getTransports(),
  level: 'error',
  format: winston.format.combine(
    winston.format.errors({ stack: isDevelopment }), // only show stack in development
    winston.format.label({ label: 'uid2-tcportal' }),
    winston.format.timestamp(),
    formatInfo(),
    winston.format.json(),
    traceFormat,
  ),
});

const infoLoggerWrapper = {
  info: (message: string, traceId: TraceId) => logger.info(`${message}, [traceId=${traceId}]`),
};

const errorLoggerWrapper = {
  error: (message: string, traceId: TraceId) => errorLogger.error(`${message}, [traceId=${traceId.traceId}]`),
};

export const getLoggers = () => {
  return {
    logger,
    localLogger,
    infoLogger: infoLoggerWrapper,
    errorLogger: errorLoggerWrapper,
  };
};

const headersToRedact = ['authorization'];

export const getErrorLoggingMiddleware = () => expressWinston.logger({ winstonInstance: errorLogger, headerBlacklist: headersToRedact });

export interface TraceId {
  traceId: string;
  uidTraceId: string;
}

export const getTraceId = (request: Request): TraceId => {
  const headerTraceId = request?.headers?.traceId?.toString() || '';
  const amznTraceId = request?.headers['x-amzn-trace-id']?.toString() || '';
  
  // local development trace id
  const generatedTraceId = crypto.randomUUID();
  
  const traceId = headerTraceId || generatedTraceId;
  const uidTraceId = amznTraceId || headerTraceId || generatedTraceId;
  
  return {
    traceId,
    uidTraceId,
  };
};
