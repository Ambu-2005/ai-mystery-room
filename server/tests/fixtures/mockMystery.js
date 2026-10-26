export function buildMockMystery(brief) {
  const suspects = Array.from({ length: brief.suspectCount }, (_, index) => ({
    id: `suspect_${index + 1}`,
    name: ['Mira Vale', 'Jonas Reed', 'Leah Brooks', 'Owen Park', 'Nia Stone', 'Eli Frost'][index],
    appearance: 'A neatly dressed figure with a distinctive blue scarf.',
    role: index === 0 ? 'Night archivist' : `Visitor ${index}`,
    biography: `A fictional character connected to the ${brief.genre} case and its setting.`,
    motive: index === 0 ? 'Wanted to protect a long-hidden family secret.' : 'Hoped to gain something from the missing object.',
    alibi: index === 0 ? 'Claims to have catalogued books in the east wing.' : 'Claims to have been in the public reading room.',
    relationshipIds: index === 0 ? ['suspect_2'] : ['suspect_1'],
    evidenceIds: [],
  }));

  const evidenceCount = Math.max(brief.evidenceRichness === 'detailed' ? 8 : 5, brief.suspectCount + 3);
  const timeline = Array.from({ length: Math.max(4, evidenceCount) }, (_, index) => ({
    id: `event_${index + 1}`,
    timestamp: ['17:30', '18:30', '18:45', '19:00', '19:15', '19:30', '19:45', '20:00', '20:15'][index],
    description: [
      'The archive closes to ordinary visitors.',
      'A final inventory is recorded before the incident.',
      'A corridor door opens during the quiet period.',
      'The missing item is discovered and the room is secured.',
      'A witness reports a detail from the corridor.',
      'The access record is compared with the witness account.',
      'A staff member provides a follow-up statement.',
      'A second record confirms the room was secured.',
      'The final inventory is checked against the first one.',
    ][index],
    suspectIds: [suspects[index % suspects.length].id],
  }));

  const evidence = [];
  function addEvidence({ id, title, description, suspectId, essential = false, type = 'physical-clue', eventIndex = evidence.length }) {
    evidence.push({
      id,
      title,
      type,
      description,
      content: `${description} The recorded detail is preserved in the fictional case file for comparison.`,
      location: eventIndex === 1 ? 'East archive corridor' : 'Marlowe archive room',
      timestamp: timeline[eventIndex].timestamp,
      relatedSuspectIds: [suspectId],
      relatedEvidenceIds: [],
      timelineEventId: timeline[eventIndex].id,
      reliability: essential ? 'high' : 'medium',
      essential,
    });
  }
  addEvidence({ id: 'evidence_key', title: 'Key register', description: 'A signed key register records an unplanned late checkout.', suspectId: suspects[0].id, essential: true, type: 'access-record', eventIndex: 1 });
  addEvidence({ id: 'evidence_clock', title: 'Clock discrepancy', description: 'A clock log places the archive key at the corridor during the incident.', suspectId: suspects[0].id, essential: true, type: 'forensic-report', eventIndex: 2 });
  for (let index = 1; index < suspects.length; index += 1) {
    addEvidence({ id: `evidence_alibi_${index + 1}`, title: `Visitor ${index} statement`, description: `A dated public-room record supports visitor ${index}'s account of where they were.`, suspectId: suspects[index].id, eventIndex: Math.min(index + 2, timeline.length - 1), type: 'witness-statement' });
  }
  const redHerring = `evidence_rumor_${brief.suspectCount}`;
  addEvidence({ id: redHerring, title: 'Unverified rumor', description: 'A visitor repeated an unverified rumor that initially points suspicion toward the wrong person.', suspectId: suspects[1].id, eventIndex: timeline.length - 1, type: 'chat-transcript' });
  while (evidence.length < evidenceCount) {
    const index = evidence.length;
    addEvidence({ id: `evidence_detail_${index}`, title: `Archive detail ${index}`, description: 'A routine archive detail helps verify the sequence of events in the case.', suspectId: suspects[index % suspects.length].id, eventIndex: index % timeline.length, type: 'timeline' });
  }

  for (const suspect of suspects) {
    suspect.evidenceIds = evidence.filter((item) => item.relatedSuspectIds.includes(suspect.id)).map((item) => item.id);
  }
  evidence.forEach((item, index) => {
    item.relatedEvidenceIds = [evidence[(index + 1) % evidence.length].id];
  });

  const culpritId = suspects[0].id;
  return {
    title: 'The Quiet Archive',
    description: 'A vanished folio leaves a quiet archive full of unanswered questions.',
    setting: { location: brief.preferredSetting || 'The fictional Marlowe Archive', incidentTime: '18:30' },
    incident: { description: 'A rare folio disappears from a room secured during the evening inventory.', objective: 'Determine who removed the folio and how the timeline reveals it.' },
    suspects,
    timeline,
    evidence,
    solution: {
      culpritId,
      motive: 'The archivist wanted to protect a private family history.',
      method: 'The archivist used a late key checkout while the corridor was empty.',
      reasoning: ['The key register contradicts the archivist’s alibi.', 'The clock log places the key at the secured corridor.'],
      decisiveEvidenceIds: ['evidence_key', 'evidence_clock'],
      redHerringExplanations: [{ evidenceId: redHerring, explanation: 'The rumor was repeated without a first-hand source and is disproved by the visitor statement.' }],
      suspectExclusions: suspects.slice(1).map((suspect) => ({
        suspectId: suspect.id,
        evidenceIds: [suspect.evidenceIds[0]],
        explanation: `A dated ${suspect.name} record supports their stated location during the relevant time.`,
      })),
    },
  };
}

export class MockTextGenerationProvider {
  constructor({ mystery, error, sequence } = {}) {
    this.mystery = mystery;
    this.error = error;
    this.sequence = sequence ? [...sequence] : null;
    this.calls = [];
  }

  async generateMystery(input) {
    this.calls.push(input);
    if (this.sequence?.length) {
      const next = this.sequence.shift();
      if (next instanceof Error) throw next;
      return {
        mystery: structuredClone(next), provider: 'mock', model: 'fixture-v1', durationMs: 3,
        usage: { promptTokens: 0, outputTokens: 0, totalTokens: 0 },
      };
    }
    if (this.error) throw this.error;
    const mystery = this.mystery ?? buildMockMystery(input.brief);
    return {
      mystery: structuredClone(mystery), provider: 'mock', model: 'fixture-v1', durationMs: 3,
      usage: { promptTokens: 0, outputTokens: 0, totalTokens: 0 },
    };
  }
}

export class MemoryMysteryRepository {
  constructor() {
    this.cases = new Map();
    this.solutions = new Map();
    this.nextId = 1;
  }

  async savePlayableMystery({ ownerId, facts, solution, generationMetadata, promptVersion }) {
    const id = `case-${this.nextId++}`;
    const mystery = {
      _id: id,
      ownerId: String(ownerId),
      ...structuredClone(facts),
      status: 'playable',
      generationMetadata: structuredClone(generationMetadata),
      promptVersion,
      createdAt: new Date('2026-01-01T00:00:00Z'),
    };
    this.cases.set(id, mystery);
    this.solutions.set(id, structuredClone(solution));
    return mystery;
  }

  async getOwnedPlayableMystery({ mysteryId, ownerId }) {
    const mystery = this.cases.get(String(mysteryId));
    if (!mystery || mystery.status !== 'playable' || mystery.ownerId !== String(ownerId)) return null;
    return structuredClone(mystery);
  }

  async listOwnedPlayableMysteries({ ownerId, limit = 50 }) {
    return [...this.cases.values()]
      .filter((mystery) => mystery.status === 'playable' && mystery.ownerId === String(ownerId))
      .sort((left, right) => right.createdAt - left.createdAt)
      .slice(0, limit)
      .map((mystery) => structuredClone(mystery));
  }
}
