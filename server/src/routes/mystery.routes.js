import { Router } from 'express';
import { getDatabaseStatus } from '../config/database.js';
import { toPublicMystery } from '../models/Mystery.js';
import { createRequireAuth } from '../middleware/auth.middleware.js';
import { MongoMysteryRepository } from '../repositories/mystery.repository.js';
import { createMysteryGenerationService } from '../services/mysteryGeneration.service.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { mysteryBriefSchema } from '../validators/mystery.schema.js';

function serviceUnavailable(message, code, retryable = false) {
  const error = new Error(message);
  error.status = 503;
  error.code = code;
  error.retryable = retryable;
  return error;
}

export function createMysteryRouter({
  UserModel,
  secret,
  cookieName,
  generationLimiter,
  provider,
  repository = new MongoMysteryRepository(),
  investigationRepository,
  databaseReady = () => getDatabaseStatus() === 'connected',
  maxRetries,
  sleep,
  logger,
} = {}) {
  const router = Router();
  const requireAuth = createRequireAuth({ UserModel, secret, cookieName });
  const generationService = createMysteryGenerationService({ provider, repository, maxRetries, sleep, logger });
  const limiter = generationLimiter ?? ((_req, _res, next) => next());

  router.post('/', limiter, requireAuth, validateBody(mysteryBriefSchema), async (req, res, next) => {
    if (!databaseReady()) return next(serviceUnavailable('Database is unavailable. No case was generated or saved.', 'DATABASE_UNAVAILABLE', true));
    try {
      const mystery = await generationService.generateAndSave({ brief: req.validatedBody, ownerId: req.user._id });
      return res.status(201).json({ success: true, data: { mystery: toPublicMystery(mystery) } });
    } catch (error) {
      return next(error);
    }
  });

  router.get('/', requireAuth, async (req, res, next) => {
    if (!databaseReady()) return next(serviceUnavailable('Database is unavailable.', 'DATABASE_UNAVAILABLE', true));
    try {
      const mysteries = await repository.listOwnedPlayableMysteries({ ownerId: req.user._id, limit: 50 });
      const investigations = investigationRepository ? await investigationRepository.listOwnedForMysteries({
        mysteryIds: mysteries.map(({ _id, id }) => String(_id ?? id)),
        userId: req.user._id,
      }) : [];
      const investigationByMystery = new Map(investigations.map((record) => [String(record.mysteryId), record]));
      return res.json({ success: true, data: { mysteries: mysteries.map((mystery) => ({
        id: String(mystery._id ?? mystery.id),
        title: mystery.title,
        description: mystery.description,
        genre: mystery.genre,
        difficulty: mystery.difficulty,
        status: mystery.status,
        setting: { location: mystery.setting.location, incidentTime: mystery.setting.incidentTime },
        suspectCount: mystery.suspects.length,
        evidenceCount: mystery.evidence.length,
        investigation: (() => {
          const record = investigationByMystery.get(String(mystery._id ?? mystery.id));
          if (!record) return null;
          const hasVerdict = record.status === 'completed' && Boolean(record.accusation);
          return {
            id: String(record._id ?? record.id),
            status: record.status,
            hasVerdict,
            score: hasVerdict ? record.score ?? null : null,
          };
        })(),
        createdAt: mystery.createdAt,
      })) } });
    } catch (error) {
      return next(error);
    }
  });

  router.get('/:id', requireAuth, async (req, res, next) => {
    if (!databaseReady()) return next(serviceUnavailable('Database is unavailable.', 'DATABASE_UNAVAILABLE', true));
    try {
      const mystery = await repository.getOwnedPlayableMystery({ mysteryId: req.params.id, ownerId: req.user._id });
      if (!mystery) {
        const error = new Error('Mystery not found.');
        error.status = 404;
        error.code = 'NOT_FOUND';
        return next(error);
      }
      return res.json({ success: true, data: { mystery: toPublicMystery(mystery) } });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
