export class MemoryInvestigationRepository {
  constructor({ mysteryId = 'mystery-1', ownerId = 'owner-42', mystery, solution } = {}) {
    this.mysteryId = mysteryId;
    this.ownerId = String(ownerId);
    this.mystery = mystery;
    this.solution = solution;
    this.records = new Map();
    this.nextId = 1;
  }

  async getPlayableMysteryForOwner({ mysteryId, userId }) {
    return String(mysteryId) === this.mysteryId && String(userId) === this.ownerId && this.mystery?.status === 'playable'
      ? structuredClone(this.mystery)
      : null;
  }

  async startOrResume({ mysteryId, userId }) {
    if (String(mysteryId) !== this.mysteryId || String(userId) !== this.ownerId) return null;
    let record = [...this.records.values()].find((item) => item.mysteryId === this.mysteryId && item.userId === this.ownerId);
    if (!record) {
      record = {
        _id: `investigation-${this.nextId++}`,
        mysteryId: this.mysteryId,
        userId: this.ownerId,
        status: 'active',
        inspectedEvidenceIds: [],
        bookmarkedEvidenceIds: [],
        evidenceSuspectLinks: [],
        evidenceNotes: [],
        suspectNotes: [],
        userNotes: [],
        theory: '',
        hintHistory: [],
        accusation: null,
        score: null,
        scoreBreakdown: null,
        startedAt: new Date('2026-01-01T00:00:00Z'),
      };
      this.records.set(record._id, record);
    }
    return structuredClone(record);
  }

  async listOwnedForMysteries({ mysteryIds, userId }) {
    const allowedMysteries = new Set(mysteryIds.map(String));
    return [...this.records.values()]
      .filter((record) => record.userId === String(userId) && allowedMysteries.has(String(record.mysteryId)))
      .map((record) => structuredClone(record));
  }

  async listOwnedPlayableMysteries({ ownerId, limit = 50 }) {
    if (!this.mystery || String(ownerId) !== this.ownerId || this.mystery.status !== 'playable') return [];
    return [structuredClone(this.mystery)].slice(0, limit);
  }

  async findOwned({ investigationId, userId }) {
    const record = this.records.get(String(investigationId));
    return record && record.userId === String(userId) ? structuredClone(record) : null;
  }

  async getMysteryForInvestigation({ mysteryId, userId }) {
    return String(mysteryId) === this.mysteryId && String(userId) === this.ownerId
      ? structuredClone(this.mystery)
      : null;
  }

  async getSolution({ mysteryId }) {
    return String(mysteryId) === this.mysteryId ? structuredClone(this.solution) : null;
  }

  async updateActive({ investigationId, userId, values }) {
    const record = this.records.get(String(investigationId));
    if (!record || record.userId !== String(userId) || record.status !== 'active') return null;
    Object.assign(record, structuredClone(values));
    return structuredClone(record);
  }

  async completeActive({ investigationId, userId, accusation, score, scoreBreakdown, submittedAt }) {
    const record = this.records.get(String(investigationId));
    if (!record || record.userId !== String(userId) || record.status !== 'active' || record.accusation) return null;
    Object.assign(record, {
      accusation: structuredClone(accusation), score, scoreBreakdown: structuredClone(scoreBreakdown),
      status: 'completed', submittedAt, completedAt: submittedAt,
    });
    return structuredClone(record);
  }
}
