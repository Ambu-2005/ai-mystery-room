import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { disconnectDatabase } from '../src/config/database.js';

describe('foundation API', () => {
  beforeAll(async () => disconnectDatabase());

  it('reports liveness using the standard success envelope', async () => {
    const response = await request(app).get('/api/v1/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, data: { status: 'ok' } });
  });

  it('reports database readiness without claiming a disconnected database is ready', async () => {
    const response = await request(app).get('/api/v1/health/ready');
    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      success: false,
      error: { code: 'SERVICE_UNAVAILABLE', message: 'Database is not connected.' },
      data: { status: 'not_ready', database: 'disconnected' },
    });
  });

  it('returns a consistent not-found error', async () => {
    const response = await request(app).get('/api/v1/not-a-route');
    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Route not found: GET /api/v1/not-a-route' },
    });
  });

  afterAll(async () => disconnectDatabase());
});
