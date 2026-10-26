import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import { Mystery, toPublicMystery } from '../src/models/Mystery.js';
import { MysterySolution } from '../src/models/MysterySolution.js';
import { Investigation } from '../src/models/Investigation.js';
import { MongoInvestigationRepository } from '../src/repositories/investigation.repository.js';
import { createInvestigationService } from '../src/services/investigation.service.js';
import { MongoMysteryRepository } from '../src/repositories/mystery.repository.js';
import { createMysteryGenerationService } from '../src/services/mysteryGeneration.service.js';
import { buildMockMystery, MockTextGenerationProvider } from './fixtures/mockMystery.js';

const enabled = process.env.RUN_MONGO_INTEGRATION === 'true';
const testBrief = {
  scenario: 'A rare folio disappears from a locked archive after the evening inventory.',
  title: 'Local Mongo Integration Case',
  genre: 'detective',
  difficulty: 'medium',
  suspectCount: 4,
  evidenceRichness: 'standard',
  contentRating: 'teen',
  preferredSetting: '',
  language: 'en',
};
const ownerId = new mongoose.Types.ObjectId();
let createdMysteryId;
let createdInvestigationId;
let connected = false;

describe.skipIf(!enabled)('MongoDB mystery generation integration (opt-in)', () => {
  beforeAll(async () => {
    await connectDatabase();
    connected = true;
  }, 20_000);

  afterAll(async () => {
    if (connected) {
      if (createdMysteryId) {
        await Promise.allSettled([
          Mystery.deleteOne({ _id: createdMysteryId, ownerId }),
          MysterySolution.deleteOne({ mysteryId: createdMysteryId }),
          Investigation.deleteOne({ _id: createdInvestigationId, userId: ownerId }),
        ]);
      }
      await disconnectDatabase();
    }
  }, 20_000);

  it('writes a playable case and private solution separately, verifies ownership, then cleans up', async () => {
    const repository = new MongoMysteryRepository();
    const service = createMysteryGenerationService({
      provider: new MockTextGenerationProvider({ mystery: buildMockMystery(testBrief) }),
      repository,
      maxRetries: 0,
    });
    const mystery = await service.generateAndSave({ brief: testBrief, ownerId });
    createdMysteryId = mystery._id;
    expect(mystery.status).toBe('playable');

    const persistedCase = await Mystery.findById(createdMysteryId).lean();
    expect(persistedCase.status).toBe('playable');
    expect(persistedCase).not.toHaveProperty('solution');
    expect(toPublicMystery(persistedCase)).not.toHaveProperty('generationMetadata');

    const hiddenByDefault = await MysterySolution.findOne({ mysteryId: createdMysteryId }).lean();
    expect(hiddenByDefault).not.toHaveProperty('culpritId');
    const privateSolution = await MysterySolution.findOne({ mysteryId: createdMysteryId })
      .select('+culpritId +motive +method +reasoning +decisiveEvidenceIds +redHerringExplanations +suspectExclusions')
      .lean();
    expect(privateSolution.culpritId).toBe('suspect_1');

    const owned = await repository.getOwnedPlayableMystery({ mysteryId: createdMysteryId, ownerId });
    const notOwned = await repository.getOwnedPlayableMystery({ mysteryId: createdMysteryId, ownerId: new mongoose.Types.ObjectId() });
    expect(owned.status).toBe('playable');
    expect(notOwned).toBeNull();

    const investigationService = createInvestigationService({ repository: new MongoInvestigationRepository() });
    const started = await investigationService.start({ mysteryId: createdMysteryId, userId: ownerId });
    createdInvestigationId = started.investigation.id;
    expect(JSON.stringify(started)).not.toContain('culpritId');
    await investigationService.updateProgress({
      investigationId: createdInvestigationId,
      userId: ownerId,
      input: { inspectedEvidenceIds: ['evidence_key'], bookmarkedEvidenceIds: ['evidence_key'] },
    });
    await investigationService.saveNotes({
      investigationId: createdInvestigationId,
      userId: ownerId,
      input: {
        userNotes: [{ id: 'case-notes', text: 'Compare the key register with the event log.' }],
        evidenceNotes: [{ evidenceId: 'evidence_key', note: 'The checkout is later than claimed.' }],
        suspectNotes: [{ suspectId: 'suspect_1', note: 'Recheck the alibi.' }],
        theory: 'The access record conflicts with the account.',
      },
    });
    await investigationService.updateProgress({
      investigationId: createdInvestigationId,
      userId: ownerId,
      input: { evidenceSuspectLinks: [{ evidenceId: 'evidence_key', suspectId: 'suspect_1' }] },
    });
    const savedHint = await investigationService.requestHint({ investigationId: createdInvestigationId, userId: ownerId });
    const refreshed = await investigationService.get({ investigationId: createdInvestigationId, userId: ownerId });
    const persistedInvestigation = await Investigation.findById(createdInvestigationId).lean();
    expect(persistedInvestigation.inspectedEvidenceIds).toEqual(['evidence_key']);
    expect(persistedInvestigation.bookmarkedEvidenceIds).toEqual(['evidence_key']);
    expect(persistedInvestigation.evidenceSuspectLinks).toEqual([{ evidenceId: 'evidence_key', suspectId: 'suspect_1' }]);
    expect(persistedInvestigation.userNotes[0].text).toContain('event log');
    expect(persistedInvestigation.theory).toContain('conflicts');
    expect(refreshed.investigation.hintHistory[0].text).toBe(savedHint.hint.text);
    expect(refreshed.investigation.evidenceNotes[0].note).toContain('checkout');
    expect(refreshed.investigation.suspectNotes[0].note).toContain('alibi');
    expect(JSON.stringify(refreshed)).not.toContain('culpritId');
    const verdict = await investigationService.submitVerdict({
      investigationId: createdInvestigationId,
      userId: ownerId,
      input: {
        suspectId: 'suspect_1',
        explanation: 'The key register and clock discrepancy conflict with the archivist’s alibi and point to the same opportunity.',
        supportingEvidenceIds: ['evidence_key', 'evidence_clock'],
      },
    });
    expect(verdict.verdict).toMatchObject({ correct: true, correctSuspect: { id: 'suspect_1' } });
    expect((await Investigation.findById(createdInvestigationId).lean()).status).toBe('completed');
  }, 30_000);
});
