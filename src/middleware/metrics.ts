import express, { RequestHandler } from 'express';
import listEndpoints from 'express-list-endpoints';
import promBundle, { NormalizePathFn } from 'express-prom-bundle';
import http from 'http';
import promClient from 'prom-client';
import url from 'url';
import UrlPattern from 'url-pattern';

import { getLoggers, getTraceId } from '../utils/loggingHelpers';

const { localLogger, errorLogger } = getLoggers();
const withoutTrailingSlash = (path: string) => {
  // Express routes don't include a trailing slash unless it's actually just `/` path, then it stays
  if (path !== '/' && path.endsWith('/')) {
    return path.slice(0, -1);
  }
  return path;
};

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
    localLogger.log('info', `Metrics server listening on ${port}`);
  });
};

type Route = {
  methods: string[],
  path: string,
  pattern: UrlPattern
};
const makeMetricsApiMiddleware = (options: Options = {}) => {
  const { isNormalizePathEnabled, discardUnmatched, createServer } = options;
  let allRoutes: Route[];

  // This function takes a path request and returns a path that should go into the `path` label of the metric
  // The goal here is to not have an infinite number of paths so get rid of path variables and unknown paths
  const normalizePath: NormalizePathFn = (req, _opts) => {
    if (!isNormalizePathEnabled) {
      return req.url;
    }

    const parsedPath = url.parse(req.originalUrl || req.url).pathname || req.url;
    const path = withoutTrailingSlash(parsedPath);

    const matchingRoute = allRoutes.find((route) => {
      if (!route.methods.includes(req.method)) {
        return false;
      }

      // match will be null if it doesn't fit the pattern and will be some object depending on path params if it does
      // eg path /abc/123 will match route /abc/:id with object {id: 123} but will return null for route /xyz/:id
      try {
        const match: null | object = route.pattern.match(path);
        return match !== null;
      } catch (e: unknown) {
        localLogger.error('Error: something went wrong.');
        return false;
      }
    });

    if (discardUnmatched && !matchingRoute) {
      return 'unmatched-url';
    }

    return matchingRoute?.path ?? 'no-path';
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
    const traceId = getTraceId(req);
    if (!allRoutes) {
      // Scrape all the paths registered with express on the first recording of metrics. These paths will later be used
      // to ensure we don't use unknown paths (ie spam calls) in metric labels and don't overwhelm Prometheus.
      // Unfortunately, this doesn't include static paths since they are not registered with Express. If desired,
      // we could add them by recursively listing /public.
      try {
        allRoutes = listEndpoints(req.app as express.Express)
          .filter((route) => route.path !== '/*' && route.path !== '*')
          .map((route) => ({
            ...route,
            pattern: new UrlPattern(route.path),
          }));
      } catch (e) {
        errorLogger.error(`unable to capture route for prom-metrics: ${e}`, traceId);
      }
    }
    metricsMiddleware(req, res, next);
  };

  return handler;
};

export default makeMetricsApiMiddleware;
