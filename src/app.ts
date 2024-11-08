import cookieParser from 'cookie-parser';
import express, { NextFunction, Request, Response } from 'express';
import Handlebars from 'hbs';
import helmet from 'helmet';
import createError from 'http-errors';
import i18n from 'i18n';
import path from 'path';

import makeMetricsApiMiddleware from './middleware/metrics';
import indexRouter from './routes/index';
import logger, { getLoggingMiddleware } from './utils/logging';
import {
  environment, ID_TYPE, LOCALE_FOLDER, VIEW_FOLDER, 
} from './utils/process';


enum LanguagesUID2 {English = 'en', Japanese = 'ja'}
enum LanguagesEUID {English = 'en'}
const locales = ID_TYPE === 'EUID' ? Object.values(LanguagesEUID) : Object.values(LanguagesUID2);

const app = express();

// view engine setup
logger.log('info', `Using views at ${VIEW_FOLDER}`);
const viewPath = path.join(__dirname, VIEW_FOLDER);
const layoutPath = path.join(viewPath, 'layouts');
app.set('views', viewPath);
app.set('view engine', 'hbs');

app.use(getLoggingMiddleware());

app.use(
  makeMetricsApiMiddleware({
    port: 9082,
    isNormalizePathEnabled: true,
    discardUnmatched: false,
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '/../public')));
app.use(helmet());
app.use(i18n.init);
app.use((req, _res, next) => {
  const locale = req.acceptsLanguages()[0] || LanguagesUID2.English;
  i18n.setLocale(locale);
  next();
});
app.use(
  helmet.contentSecurityPolicy({
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'", 'https://www.google.com/recaptcha/', 'https://www.gstatic.com/recaptcha/'],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https://www.google.com/recaptcha/', 'https://www.gstatic.com/recaptcha/', 'https://code.jquery.com/'],
      imgSrc: ["'self'", 'data:', 'https://code.jquery.com/'],
      scriptSrcAttr: ["'self'", "'unsafe-inline'"],
    },
  }),
);

app.use('/', indexRouter);

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

logger.log('info', `Using locales from ${LOCALE_FOLDER}`);
i18n.configure({
  locales,
  directory: path.join(__dirname, LOCALE_FOLDER),
  updateFiles: false,
  missingKeyFn(_, value) {
    if (environment === 'development' && locales.length > 1) {
      // Warn the developer about this - but it's not actually a problem worth reporting in production
      logger.log('warning', `There are multiple locales, but there's no current locale value for ${value}`);
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

Handlebars.registerPartials(layoutPath);

export default app;
