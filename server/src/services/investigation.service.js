import { randomUUID } from 'node:crypto';
import { toPublicMystery } from '../models/Mystery.js';
import { MongoInvestigationRepository } from '../repositories/investigation.repository.js';
import { accusationSchema, notesSchema, progressSchema } from '../validators/investigation.schema.js';

export class InvestigationError extends Error {
  constructor(message, { status = 500, code = 'INVESTIGATION_FAILED', details } = {}) {
    super(message);
    this.name = 'InvestigationError';
    this.status = status;
    this.code = code;
    if (details) this.details = details;
  }
}

const missingResource = () => new InvestigationError('Investigation not found.', { status: 404, code: 'NOT_FOUND' });
const completedError = () => new InvestigationError('This investigation has already been submitted.', { status: 409, code: 'INVESTIGATION_ALREADY_SUBMITTED' });

function publicInvestigation(record, evidenceCount) {
  return {
    id: String(record._id ?? record.id),
    mysteryId: String(record.mysteryId),
    status: record.status,
    inspectedEvidenceIds: record.inspectedEvidenceIds ?? [],
    bookmarkedEvidenceIds: record.bookmarkedEvidenceIds ?? [],
    evidenceSuspectLinks: record.evidenceSuspectLinks ?? [],
    evidenceNotes: record.evidenceNotes ?? [],
    suspectNotes: record.suspectNotes ?? [],
    userNotes: record.userNotes ?? [],
    theory: record.theory ?? '',
    hintHistory: record.hintHistory ?? [],
    hintUsage: (record.hintHistory ?? []).length,
    accusation: record.accusation ?? null,
    score: record.score ?? null,
    scoreBreakdown: record.scoreBreakdown ?? null,
    startedAt: record.startedAt,
    submittedAt: record.submittedAt ?? null,
    completedAt: record.completedAt ?? null,
    progress: evidenceCount ? Math.round(((record.inspectedEvidenceIds ?? []).length / evidenceCount) * 100) : 0,
  };
}

function assertUniqueKeys(items, key, field) {
  if (new Set(items.map(key)).size !== items.length) {
    throw new InvestigationError(`${field} entries must be unique.`, { status: 400, code: 'VALIDATION_ERROR' });
  }
}

export function createInvestigationService({ repository = new MongoInvestigationRepository(), now = () => new Date() } = {}) {
  async function loadOwned({ investigationId, userId }) {
    const investigation = await repository.findOwned({ investigationId, userId });
    if (!investigation) throw missingResource();
    const mystery = await repository.getMysteryForInvestigation({ mysteryId: investigation.mysteryId, userId });
    if (!mystery) throw missingResource();
    return { investigation, mystery };
  }

  function requireActive(investigation) {
    if (investigation.status !== 'active' || investigation.accusation) throw completedError();
  }

  async function saveActive({ investigation, userId, values }) {
    const saved = await repository.updateActive({ investigationId: investigation._id ?? investigation.id, userId, values });
    if (!saved) throw completedError();
    return saved;
  }

  function ensureEvidenceIds(ids, mystery, field) {
    const existing = new Set(mystery.evidence.map((item) => item.id));
    if (ids.some((id) => !existing.has(id))) {
      throw new InvestigationError(`${field} contains evidence that is not part of this case.`, { status: 400, code: 'INVALID_EVIDENCE_REFERENCE' });
    }
  }

  function ensureSuspectId(id, mystery, field) {
    if (!mystery.suspects.some((suspect) => suspect.id === id)) {
      throw new InvestigationError(`${field} does not match a suspect in this case.`, { status: 400, code: 'INVALID_SUSPECT_REFERENCE' });
    }
  }

  async function resultFor(investigation, mystery) {
    if (investigation.status !== 'completed' || !investigation.accusation) {
      throw new InvestigationError('Submit a final accusation before viewing the solution.', { status: 409, code: 'VERDICT_NOT_SUBMITTED' });
    }
    const solution = await repository.getSolution({ mysteryId: investigation.mysteryId });
    if (!solution) throw new InvestigationError('The saved case solution is unavailable.', { status: 503, code: 'SOLUTION_UNAVAILABLE' });
    const selectedSuspect = mystery.suspects.find(({ id }) => id === investigation.accusation.suspectId);
    const correctSuspect = mystery.suspects.find(({ id }) => id === solution.culpritId);
    const decisiveEvidence = solution.decisiveEvidenceIds.map((id) => mystery.evidence.find((item) => item.id === id)).filter(Boolean);
    const redHerrings = solution.redHerringExplanations.map((item) => ({
      evidence: mystery.evidence.find(({ id }) => id === item.evidenceId)?.title ?? 'Case evidence',
      explanation: item.explanation,
    }));
    const suspectExclusions = solution.suspectExclusions.map((item) => ({
      ...item,
      suspectName: mystery.suspects.find(({ id }) => id === item.suspectId)?.name ?? item.suspectId,
    }));
    return {
      investigation: publicInvestigation(investigation, mystery.evidence.length),
      verdict: {
        correct: investigation.accusation.suspectId === solution.culpritId,
        score: investigation.score,
        feedback: investigation.accusation.suspectId === solution.culpritId
          ? 'Your accusation matches the evidence and the case solution.'
          : 'Your accusation did not match the predetermined culprit. Review the evidence connections below.',
        selectedSuspect: selectedSuspect ? { id: selectedSuspect.id, name: selectedSuspect.name } : null,
        correctSuspect: correctSuspect ? { id: correctSuspect.id, name: correctSuspect.name } : null,
        explanation: investigation.accusation.explanation,
        scoreBreakdown: investigation.scoreBreakdown ?? null,
        solution: {
          motive: solution.motive,
          method: solution.method,
          reasoning: solution.reasoning,
          decisiveEvidence: decisiveEvidence.map(({ id, title, description }) => ({ id, title, description })),
          redHerringExplanations: redHerrings,
          suspectExclusions,
        },
      },
    };
  }

  return {
    async start({ mysteryId, userId }) {
      const mystery = await repository.getPlayableMysteryForOwner({ mysteryId, userId });
      if (!mystery) throw missingResource();
      const investigation = await repository.startOrResume({ mysteryId, userId });
      if (!investigation) throw missingResource();
      return { investigation: publicInvestigation(investigation, mystery.evidence.length), mystery: toPublicMystery(mystery) };
    },

    async get({ investigationId, userId }) {
      const { investigation, mystery } = await loadOwned({ investigationId, userId });
      return { investigation: publicInvestigation(investigation, mystery.evidence.length), mystery: toPublicMystery(mystery) };
    },

    async updateProgress({ investigationId, userId, input }) {
      const { investigation, mystery } = await loadOwned({ investigationId, userId });
      requireActive(investigation);
      const patch = progressSchema.parse(input);
      if (Object.keys(patch).length === 0) {
        throw new InvestigationError('Choose at least one progress item to update.', { status: 400, code: 'VALIDATION_ERROR' });
      }
      const evidenceIds = new Set(mystery.evidence.map(({ id }) => id));
      const suspectIds = new Set(mystery.suspects.map(({ id }) => id));
      for (const field of ['inspectedEvidenceIds', 'bookmarkedEvidenceIds']) {
        if (patch[field]) ensureEvidenceIds(patch[field], mystery, field);
      }
      if (patch.evidenceSuspectLinks) {
        for (const link of patch.evidenceSuspectLinks) {
          if (!evidenceIds.has(link.evidenceId)) throw new InvestigationError('A linked evidence item is not part of this case.', { status: 400, code: 'INVALID_EVIDENCE_REFERENCE' });
          if (!suspectIds.has(link.suspectId)) throw new InvestigationError('A linked suspect is not part of this case.', { status: 400, code: 'INVALID_SUSPECT_REFERENCE' });
        }
      }
      const values = {};
      for (const key of ['inspectedEvidenceIds', 'bookmarkedEvidenceIds', 'evidenceSuspectLinks']) {
        if (patch[key] !== undefined) values[key] = patch[key];
      }
      const saved = await saveActive({ investigation, userId, values });
      return publicInvestigation(saved, mystery.evidence.length);
    },

    async saveNotes({ investigationId, userId, input }) {
      const { investigation, mystery } = await loadOwned({ investigationId, userId });
      requireActive(investigation);
      const notes = notesSchema.parse(input);
      assertUniqueKeys(notes.userNotes, ({ id }) => id, 'User notes');
      assertUniqueKeys(notes.evidenceNotes, ({ evidenceId }) => evidenceId, 'Evidence notes');
      assertUniqueKeys(notes.suspectNotes, ({ suspectId }) => suspectId, 'Suspect notes');
      ensureEvidenceIds(notes.evidenceNotes.map(({ evidenceId }) => evidenceId), mystery, 'Evidence notes');
      notes.suspectNotes.forEach(({ suspectId }) => ensureSuspectId(suspectId, mystery, 'Suspect note'));
      const saved = await saveActive({ investigation, userId, values: notes });
      return publicInvestigation(saved, mystery.evidence.length);
    },

    async requestHint({ investigationId, userId }) {
      const { investigation, mystery } = await loadOwned({ investigationId, userId });
      requireActive(investigation);
      const solution = await repository.getSolution({ mysteryId: investigation.mysteryId });
      if (!solution) throw new InvestigationError('The saved case solution is unavailable.', { status: 503, code: 'SOLUTION_UNAVAILABLE' });
      const nextLevel = (investigation.hintHistory ?? []).length + 1;
      if (nextLevel > 2 || nextLevel > solution.decisiveEvidenceIds.length) {
        throw new InvestigationError('No further hints are available for this case.', { status: 409, code: 'HINTS_EXHAUSTED' });
      }
      const clueIds = solution.decisiveEvidenceIds.slice(0, Math.min(nextLevel, 2));
      const clues = clueIds.map((id) => mystery.evidence.find((item) => item.id === id)).filter(Boolean);
      const hintText = nextLevel === 1
        ? `Revisit “${clues[0]?.title ?? 'the first key record'}” and compare its timestamp with the timeline.`
        : nextLevel === 2
          ? `Compare “${clues[0]?.title ?? 'the first record'}” with “${clues[1]?.title ?? 'the second record'}”; look for details that reinforce the same sequence.`
          : `Use those two records to test which suspect's alibi fits the timeline and evidence.`;
      const hint = { level: nextLevel, text: hintText, requestedAt: now() };
      const saved = await saveActive({ investigation, userId, values: { hintHistory: [...(investigation.hintHistory ?? []), hint] } });
      return { hint, investigation: publicInvestigation(saved, mystery.evidence.length) };
    },

    async submitVerdict({ investigationId, userId, input }) {
      const { investigation, mystery } = await loadOwned({ investigationId, userId });
      requireActive(investigation);
      const accusation = accusationSchema.parse(input);
      ensureSuspectId(accusation.suspectId, mystery, 'Accusation');
      ensureEvidenceIds(accusation.supportingEvidenceIds, mystery, 'Supporting evidence');
      const solution = await repository.getSolution({ mysteryId: investigation.mysteryId });
      if (!solution) throw new InvestigationError('The saved case solution is unavailable.', { status: 503, code: 'SOLUTION_UNAVAILABLE' });
      const correct = accusation.suspectId === solution.culpritId;
      const culpritPoints = correct ? 60 : 0;
      const explanationPoints = accusation.explanation.length >= 250 ? 25 : accusation.explanation.length >= 100 ? 15 : 5;
      const decisiveSet = new Set(solution.decisiveEvidenceIds);
      const supportedDecisiveCount = new Set(accusation.supportingEvidenceIds.filter((id) => decisiveSet.has(id))).size;
      const evidencePoints = solution.decisiveEvidenceIds.length
        ? Math.round((supportedDecisiveCount / solution.decisiveEvidenceIds.length) * 15)
        : 0;
      const score = culpritPoints + explanationPoints + evidencePoints;
      const submittedAt = now();
      const completed = await repository.completeActive({
        investigationId: investigation._id ?? investigation.id,
        userId,
        accusation,
        score,
        submittedAt,
        scoreBreakdown: { culprit: culpritPoints, explanation: explanationPoints, evidence: evidencePoints },
      });
      if (!completed) throw completedError();
      return resultFor(completed, mystery);
    },

    async result({ investigationId, userId }) {
      const { investigation, mystery } = await loadOwned({ investigationId, userId });
      return resultFor(investigation, mystery);
    },
  };
}
