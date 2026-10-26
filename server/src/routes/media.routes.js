import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { getDatabaseStatus } from '../config/database.js';
import { createRequireAuth } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { MongoMysteryRepository } from '../repositories/mystery.repository.js';
import {
  listMediaAssets,
  loadMediaAssetDocument,
  loadReadyMediaContent,
  requestEvidenceMedia,
  retryMediaAsset,
} from '../services/mediaGeneration.service.js';

const mediaRequestSchema = z.object({ mediaType: z.enum(['image', 'video']) }).strict();
const mediaListQuerySchema = z.object({ evidenceId: z.string().trim().min(1).max(120).optional() }).strict();
const asText = (value) => value?.toString?.() ?? String(value ?? '');

function databaseUnavailable() {
  const error = new Error('Database is unavailable. Media was not requested or changed.');
  error.status = 503;
  error.code = 'DATABASE_UNAVAILABLE';
  error.retryable = true;
  return error;
}

function notFound() {
  const error = new Error('Case or media asset not found.');
  error.status = 404;
  error.code = 'NOT_FOUND';
  return error;
}

export function createMediaRouter({
  UserModel,
  secret,
  cookieName,
  repository = new MongoMysteryRepository(),
  databaseReady = () => getDatabaseStatus() === 'connected',
  generationLimiter = (_req, _res, next) => next(),
} = {}) {
  const router = Router();
  const requireAuth = createRequireAuth({ UserModel, secret, cookieName });

  const run = (handler, { status = 200 } = {}) => async (req, res, next) => {
    if (!databaseReady()) return next(databaseUnavailable());
    try {
      const data = await handler(req);
      return res.status(status).json({ success: true, data });
    } catch (error) {
      return next(error);
    }
  };

  async function ownedMystery(req) {
    const mystery = await repository.getOwnedPlayableMystery({
      mysteryId: req.params.mysteryId,
      ownerId: req.user._id,
    });
    if (!mystery) throw notFound();
    return mystery;
  }

  router.get('/mysteries/:mysteryId/media', requireAuth, run(async (req) => {
    const parsedQuery = mediaListQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      const error = new Error('Invalid evidence filter.');
      error.status = 400;
      error.code = 'VALIDATION_ERROR';
      throw error;
    }
    const { evidenceId } = parsedQuery.data;
    const mystery = await ownedMystery(req);
    return { assets: await listMediaAssets(mystery._id, evidenceId) };
  }));

  router.post(
    '/mysteries/:mysteryId/evidence/:evidenceId/media',
    requireAuth,
    generationLimiter,
    validateBody(mediaRequestSchema),
    run(async (req) => {
      const mystery = await ownedMystery(req);
      const asset = await requestEvidenceMedia({
        mystery,
        evidenceId: req.params.evidenceId,
        mediaType: req.validatedBody.mediaType,
        userId: req.user._id,
      });
      return { asset };
    }, { status: 202 }),
  );

  router.post('/mysteries/:mysteryId/media/:assetId/retry', requireAuth, generationLimiter, run(async (req) => {
    const mystery = await ownedMystery(req);
    if (!mongoose.isValidObjectId(req.params.assetId)) throw notFound();
    const stored = await loadMediaAssetDocument(req.params.assetId);
    if (!stored || asText(stored.mysteryId) !== asText(mystery._id) || stored.status !== 'failed') throw notFound();
    const asset = await retryMediaAsset(req.params.assetId);
    if (!asset) throw notFound();
    return { asset };
  }, { status: 202 }));

  router.get('/mysteries/:mysteryId/media/:assetId/content', requireAuth, async (req, res, next) => {
    if (!databaseReady()) return next(databaseUnavailable());
    try {
      const mystery = await ownedMystery(req);
      if (!mongoose.isValidObjectId(req.params.assetId)) throw notFound();
      const content = await loadReadyMediaContent({ assetId: req.params.assetId, mysteryId: mystery._id });
      if (!content) throw notFound();
      if (!['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'video/mp4', 'video/webm'].includes(content.mimeType)) {
        throw notFound();
      }
      res.set({
        'Content-Type': content.mimeType,
        'Content-Length': String(content.buffer.length),
        'Content-Disposition': 'inline',
        // Allow the allow-listed Vite origin to render authenticated media; CORS
        // still restricts which origins can read the response.
        'Cross-Origin-Resource-Policy': 'cross-origin',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      if (content.mimeType === 'image/svg+xml') {
        res.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
      }
      return res.status(200).send(content.buffer);
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
