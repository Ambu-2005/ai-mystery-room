import { Router } from 'express';
import { getDatabaseStatus } from '../config/database.js';
import { createRequireAuth } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { MongoInvestigationRepository } from '../repositories/investigation.repository.js';
import { createInvestigationService } from '../services/investigation.service.js';
import { accusationSchema, notesSchema, progressSchema } from '../validators/investigation.schema.js';

function databaseUnavailable() {
  const error = new Error('Database is unavailable. Investigation progress was not changed.');
  error.status = 503;
  error.code = 'DATABASE_UNAVAILABLE';
  error.retryable = true;
  return error;
}

export function createInvestigationRouter({
  UserModel,
  secret,
  cookieName,
  repository = new MongoInvestigationRepository(),
  service = createInvestigationService({ repository }),
  databaseReady = () => getDatabaseStatus() === 'connected',
} = {}) {
  const router = Router();
  const requireAuth = createRequireAuth({ UserModel, secret, cookieName });
  const run = (handler) => async (req, res, next) => {
    if (!databaseReady()) return next(databaseUnavailable());
    try {
      const data = await handler(req);
      return res.json({ success: true, data });
    } catch (error) {
      return next(error);
    }
  };

  router.post('/mysteries/:mysteryId/investigations', requireAuth, run((req) =>
    service.start({ mysteryId: req.params.mysteryId, userId: req.user._id })));
  router.get('/investigations/:id', requireAuth, run((req) =>
    service.get({ investigationId: req.params.id, userId: req.user._id })));
  router.patch('/investigations/:id/progress', requireAuth, validateBody(progressSchema), run((req) =>
    service.updateProgress({ investigationId: req.params.id, userId: req.user._id, input: req.validatedBody })));
  router.put('/investigations/:id/notes', requireAuth, validateBody(notesSchema), run((req) =>
    service.saveNotes({ investigationId: req.params.id, userId: req.user._id, input: req.validatedBody })));
  router.post('/investigations/:id/hints', requireAuth, run((req) =>
    service.requestHint({ investigationId: req.params.id, userId: req.user._id })));
  router.post('/investigations/:id/accusations', requireAuth, validateBody(accusationSchema), run((req) =>
    service.submitVerdict({ investigationId: req.params.id, userId: req.user._id, input: req.validatedBody })));
  router.get('/investigations/:id/result', requireAuth, run((req) =>
    service.result({ investigationId: req.params.id, userId: req.user._id })));

  return router;
}
