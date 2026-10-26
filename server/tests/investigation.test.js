import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createInvestigationService } from '../src/services/investigation.service.js';
import { buildMockMystery } from './fixtures/mockMystery.js';
import { MemoryInvestigationRepository } from './fixtures/mockInvestigation.js';

const brief = {
  scenario: 'A rare folio disappears from a locked archive after the evening inventory.',
  genre: 'detective', difficulty: 'medium', suspectCount: 4, evidenceRichness: 'standard',
  contentRating: 'teen', preferredSetting: '', language: 'en',
};
const ownerId = 'owner-42';
const secret = 'investigation-test-secret-long-enough-for-hs256';
const users = new Map([[ownerId, { _id: ownerId, name: 'Mira Vale', email: 'mira@example.test', role: 'user' }]]);

class Query {
  constructor(value) { this.value = value; }
  select() { return this; }
  then(resolve, reject) { return Promise.resolve(this.value).then(resolve, reject); }
}

const TestUser = { findById(id) { return new Query(users.get(String(id)) ?? null); } };
const validMystery = () => ({ ...buildMockMystery(brief), _id: 'mystery-1', ownerId, status: 'playable' });
const validSolution = () => structuredClone(buildMockMystery(brief).solution);

function createMemoryRepository() {
  return new MemoryInvestigationRepository({ mystery: validMystery(), solution: validSolution() });
}

function createTestApp(repository = createMemoryRepository()) {
  return createApp({
    UserModel: TestUser,
    secret,
    cookieName: 'test_session',
    authLimiter: (_req, _res, next) => next(),
    generationLimiter: (_req, _res, next) => next(),
    databaseReady: () => true,
    mysteryRepository: repository,
    investigationRepository: repository,
    investigationDatabaseReady: () => true,
  });
}

function token(id = ownerId) {
  return jwt.sign({ sub: id }, secret, { algorithm: 'HS256', expiresIn: '1h' });
}

function authed(app, path, method = 'post', id = ownerId) {
  return request(app)[method](path).set('Cookie', `test_session=${token(id)}`);
}

afterEach(() => users.delete('other-owner'));

describe('investigation progress and verdict service', () => {
  it('starts or resumes an owned investigation without exposing the saved solution', async () => {
    const repository = createMemoryRepository();
    const service = createInvestigationService({ repository });
    const first = await service.start({ mysteryId: 'mystery-1', userId: ownerId });
    const resumed = await service.start({ mysteryId: 'mystery-1', userId: ownerId });
    expect(resumed.investigation.id).toBe(first.investigation.id);
    expect(first.mystery).toHaveProperty('evidence');
    expect(first.investigation.status).toBe('active');
    expect(JSON.stringify(first)).not.toContain('culpritId');
    expect(JSON.stringify(first)).not.toContain('The archivist wanted to protect a private family history');
  });

  it('persists inspected and bookmarked evidence, suspect associations, and private notes', async () => {
    const service = createInvestigationService({ repository: createMemoryRepository() });
    const { investigation } = await service.start({ mysteryId: 'mystery-1', userId: ownerId });
    const progress = await service.updateProgress({
      investigationId: investigation.id,
      userId: ownerId,
      input: {
        inspectedEvidenceIds: ['evidence_key', 'evidence_clock'],
        bookmarkedEvidenceIds: ['evidence_key'],
        evidenceSuspectLinks: [{ evidenceId: 'evidence_key', suspectId: 'suspect_1' }],
      },
    });
    expect(progress.progress).toBeGreaterThan(0);
    expect(progress.inspectedEvidenceIds).toEqual(['evidence_key', 'evidence_clock']);
    expect(progress.bookmarkedEvidenceIds).toEqual(['evidence_key']);
    expect(progress.evidenceSuspectLinks).toEqual([{ evidenceId: 'evidence_key', suspectId: 'suspect_1' }]);

    const notes = await service.saveNotes({
      investigationId: investigation.id,
      userId: ownerId,
      input: {
        userNotes: [{ id: 'case-notes', text: 'The register time conflicts with the witness statement.' }],
        evidenceNotes: [{ evidenceId: 'evidence_key', note: 'Compare this time with the corridor entry.' }],
        suspectNotes: [{ suspectId: 'suspect_1', note: 'Recheck the east wing alibi.' }],
        theory: 'The access record may contradict one alibi.',
      },
    });
    expect(notes.userNotes[0].text).toContain('witness statement');
    expect(notes.evidenceNotes[0].evidenceId).toBe('evidence_key');
    expect(notes.suspectNotes[0].suspectId).toBe('suspect_1');
    expect(notes.theory).toContain('access record');
  });

  it('rejects evidence and suspect IDs that are not in the owned case', async () => {
    const service = createInvestigationService({ repository: createMemoryRepository() });
    const { investigation } = await service.start({ mysteryId: 'mystery-1', userId: ownerId });
    await expect(service.updateProgress({
      investigationId: investigation.id, userId: ownerId,
      input: { inspectedEvidenceIds: ['evidence_not_in_case'] },
    })).rejects.toMatchObject({ code: 'INVALID_EVIDENCE_REFERENCE', status: 400 });
    await expect(service.updateProgress({
      investigationId: investigation.id, userId: ownerId,
      input: { evidenceSuspectLinks: [{ evidenceId: 'evidence_key', suspectId: 'suspect_missing' }] },
    })).rejects.toMatchObject({ code: 'INVALID_SUSPECT_REFERENCE', status: 400 });
    await expect(service.submitVerdict({
      investigationId: investigation.id, userId: ownerId,
      input: { suspectId: 'suspect_missing', explanation: 'This explanation is long enough for the final form.', supportingEvidenceIds: [] },
    })).rejects.toMatchObject({ code: 'INVALID_SUSPECT_REFERENCE', status: 400 });
    await expect(service.submitVerdict({
      investigationId: investigation.id, userId: ownerId,
      input: { suspectId: 'suspect_1', explanation: 'This explanation is long enough for the final form.', supportingEvidenceIds: ['evidence_missing'] },
    })).rejects.toMatchObject({ code: 'INVALID_EVIDENCE_REFERENCE', status: 400 });
  });

  it('persists progressive canonical hints without revealing the culprit', async () => {
    const service = createInvestigationService({ repository: createMemoryRepository() });
    const { investigation } = await service.start({ mysteryId: 'mystery-1', userId: ownerId });
    const first = await service.requestHint({ investigationId: investigation.id, userId: ownerId });
    const second = await service.requestHint({ investigationId: investigation.id, userId: ownerId });
    expect(first.hint.level).toBe(1);
    expect(second.hint.level).toBe(2);
    expect(first.hint.text).toContain('Key register');
    expect(second.investigation.hintHistory).toHaveLength(2);
    expect(JSON.stringify(second)).not.toContain('culpritId');
    expect(JSON.stringify(second)).not.toContain('Mira Vale');
    await expect(service.requestHint({ investigationId: investigation.id, userId: ownerId }))
      .rejects.toMatchObject({ code: 'HINTS_EXHAUSTED', status: 409 });
  });

  it('keeps the solution private until submission, scores on the server, and rejects a repeated verdict', async () => {
    const repository = createMemoryRepository();
    const service = createInvestigationService({ repository });
    const { investigation } = await service.start({ mysteryId: 'mystery-1', userId: ownerId });
    await expect(service.result({ investigationId: investigation.id, userId: ownerId }))
      .rejects.toMatchObject({ code: 'VERDICT_NOT_SUBMITTED', status: 409 });

    const verdict = await service.submitVerdict({
      investigationId: investigation.id,
      userId: ownerId,
      input: {
        suspectId: 'suspect_1',
        explanation: 'The key register and the clock discrepancy contradict the archivist’s claimed timeline and support the same opportunity.',
        supportingEvidenceIds: ['evidence_key', 'evidence_clock'],
      },
    });
    expect(verdict.verdict).toMatchObject({
      correct: true,
      score: 90,
      correctSuspect: { id: 'suspect_1', name: 'Mira Vale' },
      scoreBreakdown: { culprit: 60, explanation: 15, evidence: 15 },
    });
    expect(verdict.verdict.solution).toHaveProperty('method');
    expect(verdict.verdict.solution.suspectExclusions.map(({ suspectName }) => suspectName)).toEqual([
      'Jonas Reed', 'Leah Brooks', 'Owen Park',
    ]);
    await expect(service.submitVerdict({
      investigationId: investigation.id, userId: ownerId,
      input: { suspectId: 'suspect_2', explanation: 'This is a sufficiently long explanation for a second accusation.', supportingEvidenceIds: [] },
    })).rejects.toMatchObject({ code: 'INVESTIGATION_ALREADY_SUBMITTED', status: 409 });
    await expect(service.updateProgress({ investigationId: investigation.id, userId: ownerId, input: { inspectedEvidenceIds: [] } }))
      .rejects.toMatchObject({ code: 'INVESTIGATION_ALREADY_SUBMITTED', status: 409 });
  });

  it('scores an incorrect accusation without changing the saved culprit', async () => {
    const repository = createMemoryRepository();
    const service = createInvestigationService({ repository });
    const { investigation } = await service.start({ mysteryId: 'mystery-1', userId: ownerId });
    const verdict = await service.submitVerdict({
      investigationId: investigation.id,
      userId: ownerId,
      input: { suspectId: 'suspect_2', explanation: 'This statement provides a clear but incorrect theory for the case.', supportingEvidenceIds: ['evidence_key'] },
    });
    expect(verdict.verdict.correct).toBe(false);
    expect(verdict.verdict.correctSuspect.id).toBe('suspect_1');
    expect(verdict.verdict.score).toBe(13);
    expect(repository.solution.culpritId).toBe('suspect_1');
  });
});

describe('case archive investigation status', () => {
  it('returns owner-scoped active and completed verdict summaries for archive cards', async () => {
    const repository = createMemoryRepository();
    const app = createTestApp(repository);
    const started = await authed(app, '/api/v1/mysteries/mystery-1/investigations').send();
    expect(started.status).toBe(200);
    const investigationId = started.body.data.investigation.id;

    const inProgress = await authed(app, '/api/v1/mysteries', 'get');
    expect(inProgress.status).toBe(200);
    expect(inProgress.body.data.mysteries[0].investigation).toMatchObject({
      id: investigationId, status: 'active', hasVerdict: false, score: null,
    });

    repository.records.set('foreign-investigation', {
      _id: 'foreign-investigation', mysteryId: 'mystery-1', userId: 'other-owner',
      status: 'completed', accusation: { suspectId: 'suspect_1' }, score: 100,
    });
    const submitted = await authed(app, `/api/v1/investigations/${investigationId}/accusations`)
      .send({ suspectId: 'suspect_1', explanation: 'The timeline and access record support this conclusion.', supportingEvidenceIds: ['evidence_key'] });
    expect(submitted.status).toBe(200);

    const completed = await authed(app, '/api/v1/mysteries', 'get');
    expect(completed.status).toBe(200);
    expect(completed.body.data.mysteries[0].investigation).toMatchObject({
      id: investigationId, status: 'completed', hasVerdict: true, score: 73,
    });
    expect(completed.body.data.mysteries[0]).not.toHaveProperty('status', 'completed');
    expect(repository.records.get('foreign-investigation').score).toBe(100);
  });
});

describe('investigation API ownership and solution boundary', () => {
  it('requires authentication, persists a progress action, and scopes every read to its owner', async () => {
    const app = createTestApp();
    const unauthenticated = await request(app).post('/api/v1/mysteries/mystery-1/investigations');
    expect(unauthenticated.status).toBe(401);

    const started = await authed(app, '/api/v1/mysteries/mystery-1/investigations').send();
    expect(started.status).toBe(200);
    const investigationId = started.body.data.investigation.id;
    expect(started.body.data.mystery).not.toHaveProperty('solution');
    expect(JSON.stringify(started.body.data)).not.toContain('culpritId');

    const progress = await authed(app, `/api/v1/investigations/${investigationId}/progress`, 'patch')
      .send({
        inspectedEvidenceIds: ['evidence_key'],
        bookmarkedEvidenceIds: ['evidence_key'],
        evidenceSuspectLinks: [{ evidenceId: 'evidence_key', suspectId: 'suspect_1' }],
      });
    expect(progress.status).toBe(200);
    expect(progress.body.data.inspectedEvidenceIds).toContain('evidence_key');

    const notes = await authed(app, `/api/v1/investigations/${investigationId}/notes`, 'put')
      .send({
        userNotes: [{ id: 'case-notes', text: 'Compare the register with the timeline.' }],
        evidenceNotes: [{ evidenceId: 'evidence_key', note: 'This record places the key at checkout.' }],
        suspectNotes: [{ suspectId: 'suspect_1', note: 'Check the archivist alibi.' }],
        theory: 'The register challenges one alibi.',
      });
    expect(notes.status).toBe(200);

    const hint = await authed(app, `/api/v1/investigations/${investigationId}/hints`).send();
    expect(hint.status).toBe(200);
    const persistedAfterReload = await authed(app, `/api/v1/investigations/${investigationId}`, 'get');
    expect(persistedAfterReload.body.data.investigation).toMatchObject({
      inspectedEvidenceIds: ['evidence_key'],
      bookmarkedEvidenceIds: ['evidence_key'],
      evidenceSuspectLinks: [{ evidenceId: 'evidence_key', suspectId: 'suspect_1' }],
      userNotes: [{ id: 'case-notes', text: 'Compare the register with the timeline.' }],
      evidenceNotes: [{ evidenceId: 'evidence_key', note: 'This record places the key at checkout.' }],
      suspectNotes: [{ suspectId: 'suspect_1', note: 'Check the archivist alibi.' }],
      theory: 'The register challenges one alibi.',
      hintUsage: 1,
    });
    expect(persistedAfterReload.body.data.investigation.hintHistory[0].text).toBe(hint.body.data.hint.text);
    expect(JSON.stringify(persistedAfterReload.body.data)).not.toContain('culpritId');

    users.set('other-owner', { _id: 'other-owner', name: 'Other', email: 'other@example.test', role: 'user' });
    const denied = await authed(app, `/api/v1/investigations/${investigationId}`, 'get', 'other-owner');
    expect(denied.status).toBe(404);
  });

  it('does not return solution fields from progress or before verdict submission', async () => {
    const app = createTestApp();
    const started = await authed(app, '/api/v1/mysteries/mystery-1/investigations').send();
    const id = started.body.data.investigation.id;
    const progress = await authed(app, `/api/v1/investigations/${id}`, 'get');
    expect(JSON.stringify(progress.body)).not.toContain('culpritId');
    expect(JSON.stringify(progress.body)).not.toContain('decisiveEvidenceIds');
    const earlyResult = await authed(app, `/api/v1/investigations/${id}/result`, 'get');
    expect(earlyResult.status).toBe(409);
    expect(earlyResult.body.error.code).toBe('VERDICT_NOT_SUBMITTED');
  });

  it('submits through the API, reveals the solution only afterward, and keeps result ownership private', async () => {
    const app = createTestApp();
    const started = await authed(app, '/api/v1/mysteries/mystery-1/investigations').send();
    const id = started.body.data.investigation.id;
    const submission = await authed(app, `/api/v1/investigations/${id}/accusations`).send({
      suspectId: 'suspect_1',
      explanation: 'The key register and clock discrepancy support the same opportunity and contradict the archivist’s account.',
      supportingEvidenceIds: ['evidence_key', 'evidence_clock'],
    });
    expect(submission.status).toBe(200);
    expect(submission.body.data.verdict.correct).toBe(true);
    expect(submission.body.data.verdict.solution).not.toHaveProperty('culpritId');
    expect(submission.body.data.verdict.correctSuspect.id).toBe('suspect_1');

    const repeated = await authed(app, `/api/v1/investigations/${id}/accusations`).send({
      suspectId: 'suspect_2', explanation: 'A second explanation that cannot replace the final answer.', supportingEvidenceIds: [],
    });
    expect(repeated.status).toBe(409);
    expect(repeated.body.error.code).toBe('INVESTIGATION_ALREADY_SUBMITTED');

    users.set('other-owner', { _id: 'other-owner', name: 'Other', email: 'other@example.test', role: 'user' });
    const denied = await authed(app, `/api/v1/investigations/${id}/result`, 'get', 'other-owner');
    expect(denied.status).toBe(404);
    const result = await authed(app, `/api/v1/investigations/${id}/result`, 'get');
    expect(result.status).toBe(200);
    expect(result.body.data.verdict.solution).toHaveProperty('method');
  });
});
