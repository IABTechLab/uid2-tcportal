// Copyright (c) 2021 The Trade Desk, Inc
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are met:
//
// 1. Redistributions of source code must retain the above copyright notice,
//    this list of conditions and the following disclaimer.
// 2. Redistributions in binary form must reproduce the above copyright notice,
//    this list of conditions and the following disclaimer in the documentation
//    and/or other materials provided with the distribution.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
// AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
// IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
// ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
// LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
// CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
// SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
// INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
// CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
// ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
// POSSIBILITY OF SUCH DAMAGE.


import express, { RequestHandler } from 'express';
import listEndpoints from 'express-list-endpoints';
import promBundle, { NormalizePathFn } from 'express-prom-bundle';
import http from 'http';
import promClient from 'prom-client';
import url from 'url';
import UrlPattern from 'url-pattern';

import logger from '../utils/logging';

type Options = {
  port?: number,
  isNormalizePathEnabled?: boolean,
  discardUnmatched?: boolean,
  urlPatternMaker?: (path: string) => string,
  createServer?: boolean
};

const setupMetricService = ({ port }: Options = { port: 9082 }) => {
  // Setup server on a second port to display metrics
  const metricApp = express();
  const metricServer = http.createServer(metricApp);

  metricApp.get('/metrics', async (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(await promClient.register.metrics());
  });


  metricServer.listen(port, () => {
    logger.log('info', `Metrics server listening on ${port}`);
  });
};

const captureAllRoutes = ({ urlPatternMaker }: Options, app: express.Express) => {
  const allRoutes = listEndpoints(app).filter(
    (route) => route.path !== '/*' && route.path !== '*',
  );

  return allRoutes.map((route) => {
    const path = route.path.endsWith('/') ? route.path.replace(/\/$/, '') : route.path;

    logger.log('debug', `Route found: ${route.path} - ${JSON.stringify(route)}`);
    // route.pattern = route.path; // TODO remove?

    // NOTE: urlPatternMaker has to create an UrlPattern compatible object.
    const pattern = urlPatternMaker ? urlPatternMaker(route.path) : new UrlPattern(route.path, {
      segmentNameCharset: 'a-zA-Z0-9_-',
    }).toString();

    if (!pattern) {
      logger.log('debug', 'skipping route due to empty path');
    }

    return { ...route, path: pattern || path };
  });
};

const makeMetricsApiMiddleware = (options: Options = {}) => {
  const { isNormalizePathEnabled, discardUnmatched, createServer } = options;
  const allRoutes = [] as { methods: string[], path: string, pattern?: UrlPattern }[];

  const normalizePath: NormalizePathFn = (req, _opts) => {
    if (!isNormalizePathEnabled) {
      return req.url;
    }

    const path = (() => {
      const parsedPath = url.parse(req.originalUrl || req.url).pathname || req.url;
      if (parsedPath.endsWith('/')) {
        // Remove trailing slash
        return parsedPath.replace(/\/$/, '');
      }
      return parsedPath;
    })();
  
    const pattern = allRoutes.filter((route) => {
      if (route.methods.indexOf(req.method) === -1) {
        return false;
      }

      if (route.path.match(path)) {
        return true;
      }

      return false;
    })[0]?.pattern;

    if (discardUnmatched && !pattern) {
      return '';
    }

    return pattern?.stringify() || path || '';
  };

  const metricsMiddleware = promBundle({
    includeMethod: true,
    includePath: true,
    autoregister: false,
    customLabels: {
      application: 'uid2-tcportal',
    },
    buckets: [0.03, 0.3, 1, 1.5, 3, 5, 10],
    normalizePath,
  });

  if (createServer === undefined || createServer) {
    setupMetricService(options);
  }

  const handler: RequestHandler = (req, res, next) => {
    if (allRoutes.length === 0) {
      try {
        captureAllRoutes(options, req.app as express.Express).forEach((route) => {
          allRoutes.push(route);
        });
      } catch (e) {
        logger.log('error', `unable to capture route for prom-metrics: ${e}`);
      }
    }
    metricsMiddleware(req, res, next);
  };

  return handler;
};

export default makeMetricsApiMiddleware;
