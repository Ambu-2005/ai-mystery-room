import { describe, expect, it } from 'vitest';
import { getEvidenceTimelineContext } from '../src/features/investigation/evidenceMapping.js';

describe('evidence timeline mapping', () => {
  it('maps each of six evidence records to its own timestamp and linked event', () => {
    const mystery = {
      timeline: Array.from({ length: 6 }, (_, index) => ({
        id: `event_${index + 1}`,
        timestamp: `18:0${index}`,
        description: `Timeline event ${index + 1} explains what happened.`,
      })),
      evidence: Array.from({ length: 6 }, (_, index) => ({
        id: `evidence_${index + 1}`,
        title: `Evidence ${index + 1}`,
        description: `Evidence description ${index + 1}.`,
        content: `Full evidence details ${index + 1}.`,
        timestamp: `18:0${index}`,
        timelineEventId: `event_${index + 1}`,
      })),
    };

    const inspected = mystery.evidence.map((evidence) => ({
      evidence,
      ...getEvidenceTimelineContext(mystery, evidence),
    }));
    expect(inspected).toHaveLength(6);
    inspected.forEach(({ evidence, evidenceTimestamp, event }, index) => {
      expect(evidence.title).toBe(`Evidence ${index + 1}`);
      expect(evidence.description).toBe(`Evidence description ${index + 1}.`);
      expect(evidence.content).toBe(`Full evidence details ${index + 1}.`);
      expect(evidenceTimestamp).toBe(`18:0${index}`);
      expect(event).toMatchObject({
        id: `event_${index + 1}`,
        timestamp: evidence.timestamp,
        description: `Timeline event ${index + 1} explains what happened.`,
      });
    });
  });

  it('does not substitute an unrelated event when a linked event is missing', () => {
    const mystery = { timeline: [{ id: 'event_other', timestamp: '18:00', description: 'Unrelated.' }] };
    expect(getEvidenceTimelineContext(mystery, { timelineEventId: 'event_missing', timestamp: '18:15' }))
      .toEqual({ evidenceTimestamp: '18:15', event: null });
  });
});
