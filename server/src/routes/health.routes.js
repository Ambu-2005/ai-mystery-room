import { Router } from 'express';
import { getDatabaseStatus } from '../config/database.js';

const router = Router();

router.get('/', (_req, res) => {
  res.json({ success: true, data: { status: 'ok' } });
});

router.get('/ready', (_req, res) => {
  const database = getDatabaseStatus();
  const ready = database === 'connected';
  res.status(ready ? 200 : 503).json({
    success: ready,
    ...(ready
      ? { data: { status: 'ready', database } }
      : {
          error: { code: 'SERVICE_UNAVAILABLE', message: 'Database is not connected.' },
          data: { status: 'not_ready', database },
        }),
  });
});

export default router;
