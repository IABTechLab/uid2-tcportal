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


const url = require("url");
const http = require("http");
const express = require("express");
const promBundle = require("express-prom-bundle");
const listEndpoints = require("express-list-endpoints");
const promClient = require("prom-client");
const UrlPattern = require("url-pattern");
const debug = require('debug')('tc-portal:server');

const setupMetricService = option => {
  // Setup server on a second port to display metrics
  const metricApp = express();
  const metricServer = http.createServer(metricApp);

  metricApp.get("/metrics", async (req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end(await promClient.register.metrics());
  });

  const port = option.port || 9082;

  metricServer.listen(port, () => {
    debug(`Metrics server listening on ${port}`);
  });
};

const captureAllRoutes = (option, app) => {
  let allRoutes = listEndpoints(app);
  allRoutes = allRoutes.filter(
    route => route.path !== "/*" && route.path !== "*"
  );

  allRoutes.forEach(route => {
    if (route.path.endsWith("/")) {
      // Remove trailing slash
      route.path = route.path.replace(/\/$/, "");
    }

    debug(`Route found: ${route.path} - ${JSON.stringify(route)}`);
    route.pattern = route.path;

    // NOTE: urlPatternMaker has to create an UrlPattern compatible object.
    if (option.urlPatternMaker) {
      route.path = option.urlPatternMaker(route.path);
    } else if (route.path) {
      route.path = new UrlPattern(route.path, {
        segmentNameCharset: "a-zA-Z0-9_-"
      });
    } else {
      debug("   ^^^ skipping route due to empty path")
    }
  });

  return allRoutes;
};

const makeMetricsApiMiddleware = (option = {}) => {
  const allRoutes = [];

  const normalizePath = (req, opts) => {
    if (option.normalizePath === undefined || option.normalizePath === false) {
      return req.url;
    }

    let pattern = null;
    let path = url.parse(req.originalUrl || req.url).pathname;
    if (path.endsWith("/")) {
      // Remove trailing slash
      path = path.replace(/\/$/, "");
    }

    allRoutes.some(route => {
      if (route.methods.indexOf(req.method) === -1) {
        return false;
      }

      if (route.path.match(path)) {
        pattern = route.pattern;
        return true;
      }

      return false;
    });

    if (option.discardUnmatched && pattern === null) {
      return false;
    }

    return pattern || path;
  };

  const metricsMiddleware = promBundle({
    includeMethod: true,
    includePath: true,
    autoregister: false,
    customLabels: {
        application: 'uid2-tcportal'
    },
    buckets: [0.03, 0.3, 1, 1.5, 3, 5, 10],
    normalizePath
  });

  if (option.createServer === undefined || option.createServer) {
    setupMetricService(option);
  }

  return (req, res, next) => {
    if (allRoutes.length === 0) {
      try {
        captureAllRoutes(option, req.app).forEach(route => {
          allRoutes.push(route);
        });
      }
      catch (e) {
        console.error("unable to capture route for prom-metrics: %o", e)
      }
    }
    metricsMiddleware(req, res, next);
  };
};

module.exports = makeMetricsApiMiddleware;
