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

import cookieParser from 'cookie-parser';
import express, { NextFunction, Request, Response } from 'express';
import winstonExpress from 'express-winston';
import Handlebars from 'hbs';
import helmet from 'helmet';
import createError from 'http-errors';
import i18n from 'i18n';
import path from 'path';
import winston from 'winston';

import makeMetricsApiMiddleware from './middleware/metrics';
import adDetailRouter from './routes/adDetail';
import indexRouter from './routes/index';
import usersRouter from './routes/users';
import { ID_TYPE, LOCALE_FOLDER, VIEW_FOLDER, environment } from './utils/process';


enum Languages_UID2 {English = 'en', Japanese = 'ja'};
enum Languages_EUID {English = 'en'};
const locales = ID_TYPE === 'EUID' ? Object.values(Languages_EUID) : Object.values(Languages_UID2);

const app = express();

// view engine setup
console.log(`Using views at ${VIEW_FOLDER}`);
const viewPath = path.join(__dirname, VIEW_FOLDER);
const layoutPath = path.join(viewPath, 'layouts');
app.set('views', viewPath);
app.set('view engine', 'hbs');

app.use(
  makeMetricsApiMiddleware({
    port: 9082,
    isNormalizePathEnabled: true,
    discardUnmatched: false,
  }),
);

app.use(winstonExpress.logger({
  transports: [
    new winston.transports.Console(),
  ],
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.json(),
  ),
  meta: true, // optional: control whether you want to log the meta data about the request (default to true)
  msg: 'HTTP {{req.method}} {{req.url}}', // optional: customize the default logging message. E.g. "{{res.statusCode}} {{req.method}} {{res.responseTime}}ms {{req.url}}"
  expressFormat: true, // Use the default Express/morgan request formatting. Enabling this will override any msg if true. Will only output colors with colorize set to true
  colorize: false, // Color the text and status code, using the Express/morgan color palette (text: gray, status: default green, 3XX cyan, 4XX yellow, 5XX red).
  ignoreRoute: (_req, _res) => false, // optional: allows to skip some log messages based on request and/or response
}));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '/../public')));
app.use(helmet());
app.use(i18n.init);
app.use((req, _res, next) => {
  const locale = req.acceptsLanguages()[0] || Languages_UID2.English;
  i18n.setLocale(locale);
  next();
});
app.use(
  helmet.contentSecurityPolicy({
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'", 'https://www.google.com/recaptcha/', 'https://www.gstatic.com/recaptcha/'],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https://www.google.com/recaptcha/', 'https://www.gstatic.com/recaptcha/', 'https://code.jquery.com/'],
      imgSrc: ["'self'", "data:", 'https://code.jquery.com/'],
      scriptSrcAttr: ["'self'", "'unsafe-inline'"],
    },
  }),
);

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/ad-detail', adDetailRouter);

// catch 404 and forward to error handler
app.use((_req, _res, next) => {
  next(createError(404));
});

// error handler
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

console.log(`Using locales from ${LOCALE_FOLDER}`);
i18n.configure({
  locales,
  directory: path.join(__dirname, LOCALE_FOLDER),
  updateFiles: false,
  missingKeyFn: function (_, value) {
    if (environment === 'development' && locales.length > 1) {
      console.warn(`There are multiple locales, but there's no current locale value for ${value}`);
    }
    return value;
  },
});

Handlebars.registerHelper('__', (s) => {
  return i18n.__(s);
});

Handlebars.registerHelper('__n', (s, count) => {
  return i18n.__n(s, count);
});

Handlebars.registerPartials(layoutPath, () => {
  console.log(`Error registering layouts.`);
});

export default app;
