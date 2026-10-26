import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createRequireOwnership } from '../src/middleware/auth.middleware.js';
import { User } from '../src/models/User.js';

const testSecret = 'test-only-secret-long-enough-for-jwt-signing';
const users = new Map();
let nextId = 1;

class UserQuery {
  constructor(value) { this.value = value; }
  select() { return this; }
  then(resolve, reject) { return Promise.resolve(this.value).then(resolve, reject); }
}

const TestUser = {
  findOne({ email }) { return new UserQuery([...users.values()].find((user) => user.email === email) ?? null); },
  findById(id) { return new UserQuery(users.get(String(id)) ?? null); },
  async create(values) {
    if ([...users.values()].some((user) => user.email === values.email)) {
      const error = new Error('duplicate key');
      error.code = 11000;
      error.keyPattern = { email: 1 };
      throw error;
    }
    const user = { _id: String(nextId++), role: 'user', ...values };
    users.set(user._id, user);
    return user;
  },
};

function makeTestApp() {
  return createApp({
    UserModel: TestUser,
    secret: testSecret,
    cookieName: 'test_session',
    authLimiter: (_req, _res, next) => next(),
    generationLimiter: (_req, _res, next) => next(),
    databaseReady: () => false,
  });
}

afterEach(() => {
  users.clear();
  nextId = 1;
});

describe('authentication API', () => {
  it('normalizes email and excludes password hashes in the MongoDB user schema', () => {
    const user = new User({ name: 'Mira Vale', email: ' Mira@Example.COM ', passwordHash: 'hash-value' });
    expect(user.email).toBe('mira@example.com');
    expect(User.schema.path('email').options.unique).toBe(true);
    expect(User.schema.path('passwordHash').options.select).toBe(false);
    expect(user.toJSON()).not.toHaveProperty('passwordHash');
  });

  it('registers with a normalized email, bcrypt hash, and HttpOnly session cookie', async () => {
    const app = makeTestApp();
    const response = await request.agent(app).post('/api/v1/auth/register').send({
      name: 'Mira Vale', email: '  Mira@Example.COM ', password: 'a-long-test-password',
    });
    expect(response.status).toBe(201);
    expect(response.body.data.user).toEqual({ id: '1', name: 'Mira Vale', email: 'mira@example.com', role: 'user' });
    expect(response.body.data.user).not.toHaveProperty('passwordHash');
    expect(users.get('1').passwordHash).not.toBe('a-long-test-password');
    expect(users.get('1').passwordHash).toMatch(/^\$2[aby]\$/);
    expect(response.headers['set-cookie'][0]).toContain('HttpOnly');
    expect(response.headers['set-cookie'][0]).toContain('Path=/api/v1');
  });

  it('rejects invalid registration input with field validation errors', async () => {
    const response = await request(makeTestApp()).post('/api/v1/auth/register').send({
      name: 'A', email: 'not-an-email', password: 'short',
    });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details).toHaveProperty('email');
    expect(response.body.error.details).toHaveProperty('password');
  });

  it('normalizes email and rejects duplicate accounts', async () => {
    const app = makeTestApp();
    await request(app).post('/api/v1/auth/register').send({ name: 'Mira Vale', email: 'mira@example.com', password: 'a-long-test-password' });
    const duplicate = await request(app).post('/api/v1/auth/register').send({ name: 'Another Mira', email: 'MIRA@EXAMPLE.COM', password: 'another-long-password' });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
  });

  it('logs in with a valid password and rejects invalid credentials', async () => {
    const app = makeTestApp();
    const agent = request.agent(app);
    await agent.post('/api/v1/auth/register').send({ name: 'Mira Vale', email: 'mira@example.com', password: 'a-long-test-password' });
    const logout = await agent.post('/api/v1/auth/logout');
    expect(logout.body.data.loggedOut).toBe(true);
    const login = await agent.post('/api/v1/auth/login').send({ email: 'MIRA@example.com', password: 'a-long-test-password' });
    expect(login.status).toBe(200);
    expect(login.headers['set-cookie'][0]).toContain('HttpOnly');
    const denied = await request(app).post('/api/v1/auth/login').send({ email: 'mira@example.com', password: 'wrong-password' });
    expect(denied.status).toBe(401);
    expect(denied.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('protects current-user and mystery endpoints, and supports logout/session checks', async () => {
    const app = makeTestApp();
    expect((await request(app).get('/api/v1/auth/me')).status).toBe(401);
    expect((await request(app).post('/api/v1/mysteries').send({})).status).toBe(401);
    const agent = request.agent(app);
    await agent.post('/api/v1/auth/register').send({ name: 'Mira Vale', email: 'mira@example.com', password: 'a-long-test-password' });
    const current = await agent.get('/api/v1/auth/me');
    expect(current.status).toBe(200);
    expect(current.body.data.user.email).toBe('mira@example.com');
    expect(current.body.data.user).not.toHaveProperty('passwordHash');
    const brief = await agent.post('/api/v1/mysteries').send({
      scenario: 'A prototype disappears from a locked laboratory after an evening exhibition.',
      genre: 'detective', difficulty: 'medium', suspectCount: 4,
    });
    expect(brief.status).toBe(503);
    expect(brief.body.error.code).toBe('DATABASE_UNAVAILABLE');
    expect(brief.body.error.message).toMatch(/No case was generated or saved/);
    await agent.post('/api/v1/auth/logout');
    expect((await agent.get('/api/v1/auth/me')).status).toBe(401);
  });

  it('checks resource ownership using both resource id and authenticated user id', async () => {
    let filter;
    const middleware = createRequireOwnership({ Model: { findOne: async (criteria) => { filter = criteria; return null; } } });
    const errors = [];
    await middleware({ params: { id: 'case-1' }, user: { _id: 'user-7' } }, {}, (error) => errors.push(error));
    expect(filter).toEqual({ _id: 'case-1', ownerId: 'user-7' });
    expect(errors[0]).toMatchObject({ status: 404, code: 'NOT_FOUND' });
  });
});
