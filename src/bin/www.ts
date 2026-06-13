import http from 'http';

import app from '../app';
import { getLoggers } from '../utils/loggingHelpers';
import { PORT } from '../utils/process';

const server = http.createServer(app);
const { localLogger, errorLogger } = getLoggers();
const processTraceId = { traceId: 'process', uidTraceId: 'process' };

function isHttpError(error: Error): error is Error & { syscall: string; code: string } {
  return Object.prototype.hasOwnProperty.call(error, 'syscall') && Object.prototype.hasOwnProperty.call(error, 'code');
}

process.on('SIGINT', () => {
  process.exit();
});

// Diagnostic only: per-handler try/catch is the real defence. This listener exists
// so any rejection that still escapes gets logged to the monitoring pipeline before
// Node's default behaviour takes over. We deliberately do NOT add an uncaughtException
// handler — Node's docs are explicit that resuming after one leaves the process in
// an undefined state; the pod supervisor will restart us cleanly instead.
process.on('unhandledRejection', (reason) => {
  errorLogger.error(`Unhandled rejection: ${reason instanceof Error ? (reason.stack ?? reason.message) : String(reason)}`, processTraceId);
});

/**
 * Event listener for HTTP server "error" event.
 */
function onError(error: Error) {
  if (!isHttpError(error)) {
    throw error;
  }

  if (error.syscall !== 'listen') {
    throw error;
  }

  const bind = typeof PORT === 'string'
    ? `Pipe ${PORT}`
    : `Port ${PORT}`;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      localLogger.log('error', `${bind} requires elevated privileges`);
      process.exit(1);
      break;
    case 'EADDRINUSE':
      localLogger.log('error', `${bind} is already in use`);
      process.exit(1);
      break;
    default:
      throw error;
  }
}

/**
 * Event listener for HTTP server "listening" event.
 */
function onListening() {
  const addr = server.address();
  if (!addr) {
    localLogger.log('error', 'No address available');
    return;
  }

  const bind = typeof addr === 'string'
    ? `pipe ${addr}`
    : `port ${addr.port}`;
  localLogger.log('info', `Listening on ${bind}`);
}

app.set('port', PORT);

server.listen(PORT);
server.on('error', onError);
server.on('listening', onListening);
