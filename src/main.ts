import * as Sentry from '@sentry/node';
import { Integrations } from '@sentry/tracing';
import { Router } from 'express';
import { IncomingMessage, ServerResponse } from 'http';

const {
  NODE_ENV,
  RELEASE_GIT_SHORT_SHA,
  SENTRY_DSN,
  SENTRY_LOG_LEVEL,
  SENTRY_TRACES_SAMPLE_RATE,
} = process.env;

function filterMetricsRequests(tracingHandler: Function): any {
  return (
    req: IncomingMessage,
    res: ServerResponse,
    next: (error?: any) => void,
  ) => {
    // skipping requests to /metrics
    if (req.url == '/metrics') {
      next();
    } else {
      tracingHandler(req, res, next);
    }
  };
}

export function generateOptions(app?: Router) {
  return {
    dsn: SENTRY_DSN,
    environment: NODE_ENV,
    release: RELEASE_GIT_SHORT_SHA,
    logLevel: parseInt(SENTRY_LOG_LEVEL),
    integrations: integrateWithRouter(app),
    // Be sure to lower this in production
    tracesSampleRate: parseFloat(SENTRY_TRACES_SAMPLE_RATE),
  };
}

export function init(app?: Router) {
  Sentry.init(generateOptions(app));
}

function integrateWithRouter(app: Router) {
  const integrations = [];
  if (app) {
    // RequestHandler creates a separate execution context using domains, so that every
    // transaction/span/breadcrumb is attached to its own Hub instance
    app.use(Sentry.Handlers.requestHandler({ ip: true }));
    // TracingHandler creates a trace for every incoming request
    app.use(filterMetricsRequests(Sentry.Handlers.tracingHandler()));
    // the rest of your app
    app.use(Sentry.Handlers.errorHandler());
    integrations.push(
      // enable HTTP calls tracing
      new Sentry.Integrations.Http({ tracing: true }),
      // enable Express.js middleware tracing
      new Integrations.Express({ app }),
    );
  }
  return integrations;
}

export function getConfigs() {
  return {
    NODE_ENV,
    RELEASE_GIT_SHORT_SHA,
    SENTRY_DSN,
    SENTRY_LOG_LEVEL,
    SENTRY_TRACES_SAMPLE_RATE,
  };
}
