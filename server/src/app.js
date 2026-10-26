import cors from 'cors';
import cookieParser from 'cookie-parser';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';
import healthRoutes from './routes/health.routes.js';
import { createAuthRouter } from './routes/auth.routes.js';
import { createMysteryRouter } from './routes/mystery.routes.js';
import { createInvestigationRouter } from './routes/investigation.routes.js';
import { MongoInvestigationRepository } from './repositories/investigation.repository.js';
import { createMediaRouter } from './routes/media.routes.js';

export function createApp({
  UserModel,
  secret = env.JWT_SECRET,
  cookieName = env.COOKIE_NAME,
  authLimiter,
  generationLimiter,
  mediaGenerationLimiter,
  textProvider,
  mysteryRepository,
  databaseReady,
  generationRetries,
  generationSleep,
  logger,
  investigationRepository,
  investigationService,
  investigationDatabaseReady,
} = {}) {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use((req, _res, next) => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
    const origin = req.get('origin');
    if (!origin) return next();
    try {
      if (new URL(origin).origin === new URL(env.CLIENT_URL).origin) return next();
    } catch {
      // Reject malformed Origin headers below.
    }
    const error = new Error('Request origin is not allowed.');
    error.status = 403;
    error.code = 'ORIGIN_NOT_ALLOWED';
    return next(error);
  });
  app.use('/api/v1', rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: 'draft-8', legacyHeaders: false }));
  const sensitiveLimiter = authLimiter ?? rateLimit({ windowMs: 15 * 60 * 1000, limit: 12, standardHeaders: 'draft-8', legacyHeaders: false });
  const generationRequestLimiter = generationLimiter ?? rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false });
  const mediaRequestLimiter = mediaGenerationLimiter ?? rateLimit({ windowMs: 60 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false });
  const defaultInvestigationRepository = new MongoInvestigationRepository();
  const caseInvestigationRepository = investigationRepository
    ?? (mysteryRepository ? { listOwnedForMysteries: async () => [] } : defaultInvestigationRepository);
  const progressInvestigationRepository = investigationRepository ?? defaultInvestigationRepository;
  app.use('/api/v1/health', healthRoutes);
  app.use('/api/v1/auth', createAuthRouter({ UserModel, secret, cookieName, limiter: sensitiveLimiter }));
  app.use('/api/v1/mysteries', createMysteryRouter({
    UserModel,
    secret,
    cookieName,
    generationLimiter: generationRequestLimiter,
    provider: textProvider,
    repository: mysteryRepository,
    databaseReady,
    maxRetries: generationRetries,
    sleep: generationSleep,
    logger,
    investigationRepository: caseInvestigationRepository,
  }));
  app.use('/api/v1', createMediaRouter({
    UserModel,
    secret,
    cookieName,
    repository: mysteryRepository,
    databaseReady,
    generationLimiter: mediaRequestLimiter,
  }));
  app.use('/api/v1', createInvestigationRouter({
    UserModel,
    secret,
    cookieName,
    repository: progressInvestigationRepository,
    service: investigationService,
    databaseReady: investigationDatabaseReady ?? databaseReady,
  }));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

export const app = createApp();
