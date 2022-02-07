#!/usr/bin/env node

import http from 'http';

import app from '../app';
import logger from '../utils/logging';
import { PORT } from '../utils/process';

const server = http.createServer(app);

function isHttpError(error: Error): error is Error & { syscall: string; code: string } {
  return Object.prototype.hasOwnProperty.call(error, 'syscall') && Object.prototype.hasOwnProperty.call(error, 'code');
}

process.on('SIGINT', () => {
  process.exit();
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
      logger.log('error', `${bind} requires elevated privileges`);
      process.exit(1);
      break;
    case 'EADDRINUSE':
      logger.log('error', `${bind} is already in use`);
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
    logger.log('error', 'No address available');
    return;
  }

  const bind = typeof addr === 'string'
    ? `pipe ${addr}`
    : `port ${addr.port}`;
  logger.log('info', `Listening on ${bind}`);
}

app.set('port', PORT);

server.listen(PORT);
server.on('error', onError);
server.on('listening', onListening);
