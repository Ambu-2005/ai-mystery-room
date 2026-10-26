import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { Mystery } from '../src/models/Mystery.js';
import { MysterySolution } from '../src/models/MysterySolution.js';
import { MongoMysteryRepository } from '../src/repositories/mystery.repository.js';
import { createMysteryGenerationService } from '../src/services/mysteryGeneration.service.js';
import { validateGeneratedMystery } from '../src/validators/mystery.schema.js';
import { buildMockMystery, MemoryMysteryRepository, MockTextGenerationProvider } from './fixtures/mockMystery.js';
import { GoogleGeminiTextProvider } from '../src/providers/text/googleGemini.provider.js';

const brief = {
  scenario: 'A rare folio disappears from a locked archive after the evening inventory.',
  title: '', genre: 'detective', difficulty: 'medium', suspectCount: 4,
  evidenceRichness: 'standard', contentRating: 'teen', preferredSetting: '', language: 'en',
};
const secret = 'test-only-mystery-secret-long-enough-for-jwt';
const ownerId = 'owner-42';
const silentLogger = { warn() {}, error() {} };
const users = new Map([[ownerId, { _id: ownerId, name: 'Mira Vale', email: 'mira@example.test', role: 'user' }]]);

class Query {
  constructor(value) { this.value = value; }
  select() { return this; }
  then(resolve, reject) { return Promise.resolve(this.value).then(resolve, reject); }
}

const TestUser = { findById(id) { return new Query(users.get(String(id)) ?? null); } };

function makeToken(id = ownerId) {
  return jwt.sign({ sub: id }, secret, { algorithm: 'HS256', expiresIn: '1h' });
}

function makeApp({ provider, repository, databaseReady = () => true, generationRetries = 0, logger = silentLogger } = {}) {
  return createApp({
    UserModel: TestUser,
    secret,
    cookieName: 'test_session',
    authLimiter: (_req, _res, next) => next(),
    generationLimiter: (_req, _res, next) => next(),
    textProvider: provider,
    mysteryRepository: repository,
    databaseReady,
    generationRetries,
    generationSleep: async () => {},
    logger,
  });
}

function authenticated(app, path, method = 'post') {
  return request(app)[method](path).set('Cookie', `test_session=${makeToken()}`);
}

afterEach(() => users.delete('other-owner'));

describe('mystery generation schema and service', () => {
  it('accepts a complete case whose references, chronology, and clue logic are consistent', () => {
    const valid = validateGeneratedMystery(buildMockMystery(brief), brief);
    expect(valid.suspects).toHaveLength(4);
    expect(valid.solution.decisiveEvidenceIds).toHaveLength(2);
  });

  it('rejects duplicate IDs, a nonexistent culprit, and out-of-order timeline events', () => {
    const duplicate = buildMockMystery(brief);
    duplicate.evidence[0].id = duplicate.evidence[1].id;
    expect(() => validateGeneratedMystery(duplicate, brief)).toThrow(/IDs must be unique/);

    const invalidCulprit = buildMockMystery(brief);
    invalidCulprit.solution.culpritId = 'suspect_missing';
    expect(() => validateGeneratedMystery(invalidCulprit, brief)).toThrow(/culprit must be one of the case suspects/);

    const unordered = buildMockMystery(brief);
    [unordered.timeline[0].timestamp, unordered.timeline[1].timestamp, unordered.timeline[2].timestamp, unordered.timeline[3].timestamp] = ['19:00', '17:00', '16:30', '18:30'];
    unordered.setting.incidentTime = '18:30';
    const unorderedEventTimes = new Map(unordered.timeline.map(({ id, timestamp }) => [id, timestamp]));
    unordered.evidence.forEach((item) => { item.timestamp = unorderedEventTimes.get(item.timelineEventId); });
    expect(() => validateGeneratedMystery(unordered, brief)).toThrow(/midnight only once|chronological order/);
  });

  it('reports precise paths for broken evidence, suspect, culprit, decisive-clue, exclusion, and red-herring references', () => {
    const cases = [
      {
        path: 'evidence[0].relatedSuspectIds',
        mutate: (mystery) => { mystery.evidence[0].relatedSuspectIds = ['suspect_missing']; },
      },
      {
        path: 'suspects[0].evidenceIds',
        mutate: (mystery) => { mystery.suspects[0].evidenceIds[0] = 'evidence_missing'; },
      },
      {
        path: 'timeline[0].suspectIds',
        mutate: (mystery) => { mystery.timeline[0].suspectIds = ['suspect_missing']; },
      },
      {
        path: 'evidence[0].timelineEventId',
        mutate: (mystery) => { mystery.evidence[0].timelineEventId = 'event_missing'; },
      },
      {
        path: 'evidence[0].relatedEvidenceIds',
        mutate: (mystery) => { mystery.evidence[0].relatedEvidenceIds = ['evidence_missing']; },
      },
      {
        path: 'solution.decisiveEvidenceIds',
        mutate: (mystery) => { mystery.solution.decisiveEvidenceIds[0] = 'evidence_missing'; },
      },
      {
        path: 'solution.culpritId',
        mutate: (mystery) => { mystery.solution.culpritId = 'suspect_missing'; },
      },
      {
        path: 'evidence',
        mutate: (mystery) => { mystery.evidence[1].id = mystery.evidence[0].id; },
      },
      {
        path: 'solution.decisiveEvidenceIds',
        mutate: (mystery) => { mystery.evidence.find(({ id }) => id === mystery.solution.decisiveEvidenceIds[0]).essential = false; },
      },
      {
        path: 'solution.suspectExclusions[0].evidenceIds',
        mutate: (mystery) => { mystery.evidence.find(({ id }) => id === mystery.solution.suspectExclusions[0].evidenceIds[0]).relatedSuspectIds = ['suspect_1']; },
      },
      {
        path: 'solution.redHerringExplanations',
        mutate: (mystery) => { mystery.evidence.find(({ id }) => id === mystery.solution.redHerringExplanations[0].evidenceId).essential = true; },
      },
      {
        path: 'solution.redHerringExplanations',
        mutate: (mystery) => { mystery.solution.redHerringExplanations[0].evidenceId = 'evidence_missing'; },
      },
    ];

    for (const { path, mutate } of cases) {
      const invalid = buildMockMystery(brief);
      mutate(invalid);
      let thrown;
      try { validateGeneratedMystery(invalid, brief); } catch (error) { thrown = error; }
      expect(thrown?.stage).toBe('consistency');
      expect(thrown?.code).toBe('CASE_CONSISTENCY_FAILED');
      expect(thrown?.diagnostics.some((issue) => issue.path === path)).toBe(true);
    }
  });

  it('accepts one chronological midnight rollover and rejects a second rollover', () => {
    const overnight = buildMockMystery(brief);
    const times = ['23:20', '23:50', '00:05', '00:20', '00:35', '00:50', '01:05'];
    overnight.timeline.forEach((event, index) => { event.timestamp = times[index]; });
    overnight.setting.incidentTime = times[1];
    const eventTimes = new Map(overnight.timeline.map(({ id, timestamp }) => [id, timestamp]));
    overnight.evidence.forEach((item) => { item.timestamp = eventTimes.get(item.timelineEventId); });
    expect(validateGeneratedMystery(overnight, brief).timeline).toHaveLength(7);

    overnight.timeline[4].timestamp = '00:10';
    const secondRollTimes = new Map(overnight.timeline.map(({ id, timestamp }) => [id, timestamp]));
    overnight.evidence.forEach((item) => { item.timestamp = secondRollTimes.get(item.timelineEventId); });
    let thrown;
    try { validateGeneratedMystery(overnight, brief); } catch (error) { thrown = error; }
    expect(thrown?.stage).toBe('consistency');
    expect(thrown?.diagnostics).toContainEqual(expect.objectContaining({ path: 'timeline[4].timestamp' }));
  });

  it('keeps a missing decisive-evidence array as a schema error rather than weakening the requirement', () => {
    const invalid = buildMockMystery(brief);
    invalid.solution.decisiveEvidenceIds = [];
    let thrown;
    try { validateGeneratedMystery(invalid, brief); } catch (error) { thrown = error; }
    expect(thrown?.stage).toBe('schema');
    expect(thrown?.code).toBe('CASE_SCHEMA_INVALID');
    expect(thrown?.diagnostics).toContainEqual(expect.objectContaining({
      path: 'solution.decisiveEvidenceIds', code: 'too_small',
    }));

    const missingExplanation = buildMockMystery(brief);
    missingExplanation.solution.redHerringExplanations[0].explanation = 'Too short.';
    let explanationError;
    try { validateGeneratedMystery(missingExplanation, brief); } catch (error) { explanationError = error; }
    expect(explanationError?.stage).toBe('schema');
    expect(explanationError?.diagnostics).toContainEqual(expect.objectContaining({
      path: 'solution.redHerringExplanations[0].explanation', code: 'too_small',
    }));
  });

  it('rejects incomplete clue sufficiency and direct solution leakage in public text', () => {
    const insufficient = buildMockMystery(brief);
    insufficient.solution.suspectExclusions.pop();
    expect(() => validateGeneratedMystery(insufficient, brief)).toThrow(/Every alternative suspect/);

    const leaked = buildMockMystery(brief);
    leaked.evidence[0].description = 'The culprit is Mira Vale, according to the signed note.';
    expect(() => validateGeneratedMystery(leaked, brief)).toThrow(/must not reveal the culprit directly/);
  });

  it('retries one transient model failure, then validates and saves exactly one case', async () => {
    const provider = new MockTextGenerationProvider({ sequence: [Object.assign(new Error('temporary'), { retryable: true, status: 503 }), buildMockMystery(brief)] });
    const repository = new MemoryMysteryRepository();
    const service = createMysteryGenerationService({ provider, repository, maxRetries: 1, sleep: async () => {}, logger: silentLogger });
    const mystery = await service.generateAndSave({ brief, ownerId });
    expect(provider.calls).toHaveLength(2);
    expect(mystery.status).toBe('playable');
    expect(repository.cases.size).toBe(1);
    expect(repository.solutions.size).toBe(1);
    expect(repository.solutions.get(mystery._id).culpritId).toBe('suspect_1');
    expect(mystery).not.toHaveProperty('solution');
  });

  it('does not save a case when generation output remains invalid after bounded retries', async () => {
    const invalid = buildMockMystery(brief);
    invalid.solution.culpritId = 'not-a-suspect';
    const provider = new MockTextGenerationProvider({ mystery: invalid });
    const repository = new MemoryMysteryRepository();
    const service = createMysteryGenerationService({ provider, repository, maxRetries: 3, sleep: async () => {}, logger: silentLogger });
    await expect(service.generateAndSave({ brief, ownerId })).rejects.toMatchObject({ code: 'GENERATED_CASE_INCONSISTENT', status: 502 });
    expect(provider.calls).toHaveLength(2);
    expect(repository.cases.size).toBe(0);
    expect(repository.solutions.size).toBe(0);
  });

  it('logs exact schema issue paths and feeds only sanitized validation feedback into bounded regeneration', async () => {
    const malformed = buildMockMystery(brief);
    delete malformed.evidence[0].timelineEventId;
    const provider = new MockTextGenerationProvider({ sequence: [malformed, buildMockMystery(brief)] });
    const repository = new MemoryMysteryRepository();
    const records = [];
    const logger = { warn: (message, fields) => records.push({ message, fields }), error() {} };
    const service = createMysteryGenerationService({ provider, repository, maxRetries: 1, sleep: async () => {}, logger });
    const mystery = await service.generateAndSave({ brief, ownerId });
    expect(mystery.status).toBe('playable');
    expect(provider.calls).toHaveLength(2);
    expect(provider.calls[1].validationFeedback).toContainEqual({ code: 'invalid_type', path: 'evidence[0].timelineEventId' });
    expect(records[0].fields).toMatchObject({ stage: 'schema', errorCode: 'CASE_SCHEMA_INVALID', attempt: 1 });
    expect(records[0].fields.issues).toContainEqual(expect.objectContaining({
      code: 'invalid_type', path: 'evidence[0].timelineEventId', missing: true,
    }));
    expect(JSON.stringify(records)).not.toContain(brief.scenario);
  });

  it('regenerates once with exact consistency feedback and saves only the corrected case', async () => {
    const inconsistent = buildMockMystery(brief);
    inconsistent.evidence[0].relatedSuspectIds = ['suspect_missing'];
    const provider = new MockTextGenerationProvider({ sequence: [inconsistent, buildMockMystery(brief)] });
    const repository = new MemoryMysteryRepository();
    const logs = [];
    const service = createMysteryGenerationService({
      provider, repository, maxRetries: 3, sleep: async () => {},
      logger: { warn: (_message, fields) => logs.push(fields), error() {} },
    });
    const saved = await service.generateAndSave({ brief, ownerId });
    expect(saved.status).toBe('playable');
    expect(provider.calls).toHaveLength(2);
    expect(provider.calls[1].validationFeedback).toContainEqual(expect.objectContaining({
      code: 'custom', path: 'evidence[0].relatedSuspectIds',
    }));
    expect(logs[0]).toMatchObject({ stage: 'consistency', errorCode: 'CASE_CONSISTENCY_FAILED' });
    expect(logs[0].issues).toContainEqual(expect.objectContaining({ path: 'evidence[0].relatedSuspectIds' }));
    expect(repository.cases.size).toBe(1);
    expect(repository.solutions.size).toBe(1);
  });

  it('returns a retryable persistence error instead of success when storage fails', async () => {
    const service = createMysteryGenerationService({
      provider: new MockTextGenerationProvider(),
      repository: { async savePlayableMystery() { throw new Error('sensitive database internals'); } },
      maxRetries: 0,
      logger: silentLogger,
    });
    await expect(service.generateAndSave({ brief, ownerId })).rejects.toMatchObject({ code: 'MYSTERY_SAVE_FAILED', status: 503, retryable: true });
  });
});

describe('Google Gemini text provider', () => {
  function sdkResponse(text, { finishReason = 'STOP', modelVersion = 'configured-model', responseId = 'sdk-response-1' } = {}) {
    return {
      candidates: [{ content: { parts: [{ text }] }, finishReason }],
      modelVersion,
      responseId,
      usageMetadata: { promptTokenCount: 9, candidatesTokenCount: 20, totalTokenCount: 29 },
      get text() {
        return this.candidates[0].content.parts.map((part) => part.text ?? '').join('');
      },
    };
  }

  it('uses the installed SDK GenerateContentResponse text getter and structured JSON schema options', async () => {
    let requestData;
    const provider = new GoogleGeminiTextProvider({
      apiKey: 'server-test-key', model: 'configured-model', client: { models: { generateContent: async (data) => {
        requestData = data;
        return sdkResponse(JSON.stringify(buildMockMystery(brief)));
      } } },
    });
    const result = await provider.generateMystery({ brief });
    expect(requestData.model).toBe('configured-model');
    expect(requestData.config.responseMimeType).toBe('application/json');
    expect(requestData.config.responseSchema.type).toBe('OBJECT');
    expect(requestData.config.maxOutputTokens).toBe(16384);
    expect(requestData.contents).toContain(brief.scenario);
    expect(result.usage.totalTokens).toBe(29);
    expect(result.mystery.solution.culpritId).toBe('suspect_1');
  });

  it('distinguishes malformed JSON, an empty response, and output truncated by MAX_TOKENS', async () => {
    const providerFor = (response) => new GoogleGeminiTextProvider({
      model: 'configured-model',
      client: { models: { generateContent: async () => response } },
    });

    await expect(providerFor(sdkResponse('{"title":')).generateMystery({ brief })).rejects.toMatchObject({
      code: 'GEMINI_INVALID_JSON', stage: 'response_parse', retryable: true, model: 'configured-model', finishReason: 'STOP',
    });
    await expect(providerFor({ candidates: [], get text() { return undefined; } }).generateMystery({ brief })).rejects.toMatchObject({
      code: 'GEMINI_EMPTY_RESPONSE', stage: 'response_parse', retryable: true,
    });
    await expect(providerFor(sdkResponse('{"title":', { finishReason: 'MAX_TOKENS' })).generateMystery({ brief })).rejects.toMatchObject({
      code: 'GEMINI_OUTPUT_TRUNCATED', stage: 'response_parse', retryable: true, finishReason: 'MAX_TOKENS',
    });
  });

  it('classifies JSON schema failures in the validation service instead of treating them as parse failures', async () => {
    const malformedMystery = buildMockMystery(brief);
    delete malformedMystery.evidence[0].timelineEventId;
    const response = sdkResponse(JSON.stringify(malformedMystery));
    const provider = new GoogleGeminiTextProvider({ model: 'configured-model', client: { models: { generateContent: async () => response } } });
    const repository = new MemoryMysteryRepository();
    const logs = [];
    const service = createMysteryGenerationService({
      provider, repository, maxRetries: 0,
      logger: { warn: (_message, fields) => logs.push(fields), error() {} },
    });
    await expect(service.generateAndSave({ brief, ownerId })).rejects.toMatchObject({
      code: 'GENERATED_CASE_SCHEMA_INVALID', status: 502,
    });
    expect(logs[0]).toMatchObject({ stage: 'schema', errorCode: 'CASE_SCHEMA_INVALID', model: 'configured-model' });
    expect(logs[0].issues).toContainEqual(expect.objectContaining({ path: 'evidence[0].timelineEventId', missing: true }));
    expect(repository.cases.size).toBe(0);
    expect(repository.solutions.size).toBe(0);
  });

  it('returns a clear configuration error without a key or model and sanitizes provider errors', async () => {
    const unconfigured = new GoogleGeminiTextProvider({ apiKey: '', model: '', client: null });
    await expect(unconfigured.generateMystery({ brief })).rejects.toMatchObject({ code: 'GEMINI_NOT_CONFIGURED', status: 503 });

    const limited = new GoogleGeminiTextProvider({ model: 'configured-model', client: { models: { generateContent: async () => { throw Object.assign(new Error('sensitive provider internals'), { status: 429 }); } } } });
    await expect(limited.generateMystery({ brief })).rejects.toMatchObject({ code: 'GEMINI_RATE_LIMITED', status: 503, retryable: true });
    await expect(limited.generateMystery({ brief })).rejects.not.toThrow(/sensitive provider internals/);

    const unsupported = new GoogleGeminiTextProvider({ model: 'configured-model', client: { models: { generateContent: async () => { throw Object.assign(new Error('private SDK details'), { status: 400 }); } } } });
    await expect(unsupported.generateMystery({ brief })).rejects.toMatchObject({
      code: 'GEMINI_MODEL_CONFIGURATION_ERROR', status: 503, retryable: false, stage: 'provider_request', model: 'configured-model',
    });
  });
});

describe('mystery API and public/private persistence boundary', () => {
  it('generates, persists and returns only the public case, then retrieves it by owner', async () => {
    const provider = new MockTextGenerationProvider();
    const repository = new MemoryMysteryRepository();
    const app = makeApp({ provider, repository });
    const created = await authenticated(app, '/api/v1/mysteries').send(brief);
    expect(created.status).toBe(201);
    const mystery = created.body.data.mystery;
    expect(mystery).toMatchObject({ title: 'The Quiet Archive', status: 'playable', scenario: brief.scenario });
    expect(mystery).not.toHaveProperty('ownerId');
    expect(mystery).not.toHaveProperty('solution');
    expect(mystery.evidence[0]).not.toHaveProperty('essential');
    expect(JSON.stringify(mystery)).not.toContain('culpritId');
    expect(JSON.stringify(mystery)).not.toContain('The archivist wanted to protect a private family history');
    expect(repository.solutions.get(mystery.id).culpritId).toBe('suspect_1');

    const archive = await authenticated(app, '/api/v1/mysteries', 'get');
    expect(archive.status).toBe(200);
    expect(archive.body.data.mysteries).toHaveLength(1);
    expect(archive.body.data.mysteries[0]).not.toHaveProperty('solution');

    const retrieved = await authenticated(app, `/api/v1/mysteries/${mystery.id}`, 'get');
    expect(retrieved.status).toBe(200);
    expect(retrieved.body.data.mystery).not.toHaveProperty('solution');
    users.set('other-owner', { _id: 'other-owner', name: 'Other', email: 'other@example.test', role: 'user' });
    const otherToken = jwt.sign({ sub: 'other-owner' }, secret, { algorithm: 'HS256' });
    const denied = await request(app).get(`/api/v1/mysteries/${mystery.id}`).set('Cookie', `test_session=${otherToken}`);
    expect(denied.status).toBe(404);
  });

  it('returns MongoDB unavailable before calling Gemini and does not report success', async () => {
    const provider = new MockTextGenerationProvider();
    const repository = new MemoryMysteryRepository();
    const app = makeApp({ provider, repository, databaseReady: () => false });
    const response = await authenticated(app, '/api/v1/mysteries').send(brief);
    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe('DATABASE_UNAVAILABLE');
    expect(provider.calls).toHaveLength(0);
    expect(repository.cases.size).toBe(0);
  });

  it('validates all brief fields before invoking the provider', async () => {
    const provider = new MockTextGenerationProvider();
    const app = makeApp({ provider, repository: new MemoryMysteryRepository() });
    const response = await authenticated(app, '/api/v1/mysteries').send({
      ...brief, scenario: 'Too short', genre: 'crime-real', difficulty: 'nightmare', suspectCount: 8, evidenceRichness: 'ultra',
    });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details).toHaveProperty('scenario');
    expect(response.body.error.details).toHaveProperty('genre');
    expect(response.body.error.details).toHaveProperty('difficulty');
    expect(response.body.error.details).toHaveProperty('suspectCount');
    expect(response.body.error.details).toHaveProperty('evidenceRichness');
    expect(provider.calls).toHaveLength(0);
  });

  it('returns explicit Gemini configuration errors without saving any case', async () => {
    const provider = new GoogleGeminiTextProvider({ apiKey: '', model: '', client: null });
    const repository = new MemoryMysteryRepository();
    const app = makeApp({ provider, repository });
    const response = await authenticated(app, '/api/v1/mysteries').send(brief);
    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe('GEMINI_NOT_CONFIGURED');
    expect(response.body.error.message).toContain('GEMINI_API_KEY and GEMINI_MODEL');
    expect(repository.cases.size).toBe(0);
  });

  it('returns a safe retryable provider error without saving a mystery', async () => {
    const provider = new MockTextGenerationProvider({ error: Object.assign(new Error('Gemini is temporarily unavailable.'), { status: 503, code: 'GEMINI_UNAVAILABLE', retryable: true }) });
    const repository = new MemoryMysteryRepository();
    const app = makeApp({ provider, repository });
    const response = await authenticated(app, '/api/v1/mysteries').send(brief);
    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe('GEMINI_UNAVAILABLE');
    expect(response.body.error.message).toMatch(/temporarily unavailable/);
    expect(repository.cases.size).toBe(0);
  });

  it('returns a safe schema error code and request reference while logging only field diagnostics', async () => {
    const malformed = buildMockMystery(brief);
    delete malformed.evidence[0].timelineEventId;
    const provider = new MockTextGenerationProvider({ mystery: malformed });
    const repository = new MemoryMysteryRepository();
    const records = [];
    const logger = { warn: (message, fields) => records.push({ message, fields }), error() {} };
    const app = makeApp({ provider, repository, generationRetries: 0, logger });
    const response = await authenticated(app, '/api/v1/mysteries').send(brief);
    expect(response.status).toBe(502);
    expect(response.body.error).toMatchObject({
      code: 'GENERATED_CASE_SCHEMA_INVALID',
      message: expect.stringContaining('missing or incorrectly formatted fields'),
      retryable: true,
    });
    expect(response.body.error.requestId).toEqual(expect.any(String));
    expect(response.body.error).not.toHaveProperty('details');
    expect(records[0].fields).toMatchObject({ stage: 'schema', errorCode: 'CASE_SCHEMA_INVALID' });
    expect(records[0].fields.issues).toContainEqual(expect.objectContaining({ path: 'evidence[0].timelineEventId', missing: true }));
    expect(repository.cases.size).toBe(0);
    expect(repository.solutions.size).toBe(0);
  });
});

describe('Mongo mystery persistence adapter', () => {
  it('keeps solution fields in a separate collection and publishes only after both writes', async () => {
    const events = [];
    const cases = new Map();
    const solutions = new Map();
    class FakeMystery {
      constructor(data) { Object.assign(this, data); this._id = 'mongo-case-id'; }
      async save() { events.push(`case:${this.status}`); cases.set(String(this._id), this); }
      static async deleteOne({ _id }) { cases.delete(String(_id)); }
      static findOne(query) { return { lean: async () => cases.get(String(query._id)) ?? null }; }
    }
    const FakeSolution = {
      async create(data) { events.push('solution'); solutions.set(String(data.mysteryId), data); },
      async deleteOne({ mysteryId }) { solutions.delete(String(mysteryId)); },
    };
    const repository = new MongoMysteryRepository({ MysteryModel: FakeMystery, MysterySolutionModel: FakeSolution });
    const result = await repository.savePlayableMystery({
      ownerId,
      facts: { title: 'Case', description: 'A fictional case description.', scenario: brief.scenario, genre: brief.genre, difficulty: brief.difficulty, evidenceRichness: 'standard', contentRating: 'teen', preferredSetting: '', language: 'en', setting: {}, incident: {}, suspects: [], timeline: [], evidence: [] },
      solution: { culpritId: 'suspect_1', motive: 'private motive', method: 'private method', reasoning: [], decisiveEvidenceIds: [], redHerringExplanations: [], suspectExclusions: [] },
      generationMetadata: { provider: 'mock', model: 'test' }, promptVersion: 'test-v1',
    });
    expect(events).toEqual(['case:generating', 'solution', 'case:playable']);
    expect(result).not.toHaveProperty('solution');
    expect(solutions.get('mongo-case-id').culpritId).toBe('suspect_1');
  });

  it('deletes an unpublished case if private solution persistence fails', async () => {
    let deleted = false;
    class FakeMystery {
      constructor(data) { Object.assign(this, data); this._id = 'orphan-case'; }
      async save() {}
      static async deleteOne() { deleted = true; }
    }
    const repository = new MongoMysteryRepository({ MysteryModel: FakeMystery, MysterySolutionModel: {
      async create() { throw new Error('database write failed'); },
      async deleteOne() {},
    } });
    await expect(repository.savePlayableMystery({ ownerId, facts: {}, solution: {}, generationMetadata: {}, promptVersion: 'test-v1' })).rejects.toThrow();
    expect(deleted).toBe(true);
  });
});

describe('Mongo mystery model privacy', () => {
  it('does not define solution data on the public Mystery schema and hides every private solution field by default', () => {
    expect(Mystery.schema.path('solution')).toBeUndefined();
    for (const field of ['culpritId', 'motive', 'method', 'reasoning', 'decisiveEvidenceIds', 'redHerringExplanations', 'suspectExclusions']) {
      expect(MysterySolution.schema.path(field).options.select).toBe(false);
    }
  });
});
