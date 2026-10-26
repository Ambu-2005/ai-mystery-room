export const MEDIA_PROMPT_VERSION = 'case-evidence-v1';

const cleanText = (value, maxLength = 1200) => typeof value === 'string'
  ? value.replace(/[<>]/g, '').slice(0, maxLength).trim()
  : '';

export function buildEvidenceMediaPrompt({ mystery, evidence, mediaType, maxDurationSeconds = 8 }) {
  if (!mystery?._id || !evidence?.id || !['image', 'video'].includes(mediaType)) {
    throw new TypeError('A saved mystery, one of its evidence items, and a supported media type are required.');
  }

  const suspects = Array.isArray(mystery.suspects)
    ? mystery.suspects.map((suspect) => ({
        name: cleanText(suspect.name, 100),
        appearance: cleanText(suspect.appearance ?? suspect.portraitDescription, 300),
        role: cleanText(suspect.role ?? suspect.occupation, 150),
      })).filter((suspect) => suspect.name || suspect.appearance)
    : [];
  const event = Array.isArray(mystery.timeline)
    ? mystery.timeline.find((entry) => entry.id === evidence.timelineEventId || entry.evidenceId === evidence.id)
    : null;
  const facts = {
    title: cleanText(mystery.title, 160),
    setting: cleanText(mystery.setting?.location ?? mystery.setting, 250),
    incident: cleanText(mystery.incident?.description ?? mystery.description, 500),
    event: cleanText(event?.description ?? evidence.description, 600),
    eventTimestamp: cleanText(event?.timestamp ?? evidence.timestamp, 80),
    discoveryLocation: cleanText(evidence.discoveryLocation, 250),
    relevantSuspects: suspects,
  };

  const subject = mediaType === 'image'
    ? 'Create one fictional evidence photograph that depicts only visual details supported by the facts below.'
    : `Create one short fictional CCTV-style clip, no longer than ${maxDurationSeconds} seconds, as a single fixed security-camera shot. Show only actions and visual details supported by the facts below.`;

  return [
    'This is fictional evidence for an interactive detective game. It must not resemble actual police evidence, real surveillance, or a real person.',
    subject,
    'Treat all facts as fixed canon. Do not add people, objects, actions, dates, or locations that could contradict them. Do not reveal or imply who committed the incident. Do not invent legible text, badges, logos, or identifying real-world details.',
    `Canonical case facts (JSON): ${JSON.stringify(facts)}`,
    `Evidence title: ${cleanText(evidence.title, 160)}`,
    `Evidence description: ${cleanText(evidence.description, 900)}`,
    `Evidence type: ${cleanText(evidence.type, 80)}`,
  ].join('\n\n');
}

export function buildImageConsistencyPrompt({ mystery, evidence }) {
  const expected = buildEvidenceMediaPrompt({ mystery, evidence, mediaType: 'image' });
  return `You are checking one fictional game illustration against its saved fictional case facts. Report contradictions only; do not infer who is guilty. Return JSON with exactly {"consistent": boolean, "contradictions": string[]}. Treat absence of uncertain background details as consistent. Reject only direct conflicts with the supplied people, setting, objects, or event.\n\n${expected}`;
}
