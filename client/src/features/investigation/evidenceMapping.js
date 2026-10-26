export function getEvidenceTimelineContext(mystery, evidence) {
  const event = mystery.timeline.find(({ id }) => id === evidence.timelineEventId) ?? null;
  return {
    evidenceTimestamp: evidence.timestamp ?? null,
    event,
  };
}
