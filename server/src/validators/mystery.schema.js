import { z } from 'zod';

export const mysteryBriefSchema = z.object({
  scenario: z.string().trim().min(50).max(2000),
  title: z.string().trim().max(120).optional().default(''),
  genre: z.enum(['detective', 'college-mystery', 'heist', 'missing-object', 'locked-room', 'historical', 'corporate']),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  suspectCount: z.coerce.number().int().min(3).max(6),
  evidenceRichness: z.enum(['standard', 'detailed']).default('standard'),
  contentRating: z.literal('teen').default('teen'),
  preferredSetting: z.string().trim().max(160).optional().default(''),
  language: z.literal('en').default('en'),
}).strict();

const entityId = z.string().regex(/^[a-z][a-z0-9_-]{1,39}$/);
const text = (min = 3, max = 900) => z.string().trim().min(min).max(max);
const clockTime = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
const knownOutputFields = new Set([
  'title', 'description', 'setting', 'location', 'incidentTime', 'incident', 'objective', 'suspects',
  'id', 'name', 'appearance', 'role', 'biography', 'motive', 'alibi', 'relationshipIds', 'evidenceIds',
  'timeline', 'timestamp', 'suspectIds', 'evidence', 'type', 'content', 'relatedSuspectIds',
  'relatedEvidenceIds', 'timelineEventId', 'reliability', 'essential', 'solution', 'culpritId', 'method',
  'reasoning', 'decisiveEvidenceIds', 'redHerringExplanations', 'evidenceId', 'explanation',
  'suspectExclusions', 'suspectId',
]);
const MAX_VALIDATION_DIAGNOSTICS = 32;

function diagnosticPath(path) {
  const rendered = path.map((part, index) => {
    if (typeof part === 'number') return `[${part}]`;
    const safePart = knownOutputFields.has(part) ? part : '[unknown-key]';
    return index === 0 ? safePart : `.${safePart}`;
  }).join('');
  return rendered || '$';
}

function attachValidationDiagnostics(error, stage) {
  error.stage = stage;
  error.code = stage === 'schema' ? 'CASE_SCHEMA_INVALID' : 'CASE_CONSISTENCY_FAILED';
  error.diagnostics = (error.issues ?? []).slice(0, MAX_VALIDATION_DIAGNOSTICS).map((issue) => ({
    code: issue.code ?? 'validation_error',
    path: diagnosticPath(issue.path ?? []),
    ...(issue.code === 'invalid_type' && issue.input === undefined ? { missing: true } : {}),
    ...(issue.code === 'invalid_type' && ['string', 'number', 'boolean', 'object', 'array'].includes(issue.expected)
      ? { expected: issue.expected }
      : {}),
    ...(issue.code === 'custom' ? { rule: issue.message } : {}),
    ...(['too_small', 'too_big'].includes(issue.code)
      ? { limit: issue.minimum ?? issue.maximum, bound: issue.inclusive ? 'inclusive' : 'exclusive' }
      : {}),
  }));
  return error;
}

const suspectSchema = z.object({
  id: entityId,
  name: text(2, 80),
  appearance: text(5, 240),
  role: text(2, 120),
  biography: text(20, 700),
  motive: text(10, 500),
  alibi: text(10, 500),
  relationshipIds: z.array(entityId).max(6),
  evidenceIds: z.array(entityId).min(1).max(16),
}).strict();

const timelineEventSchema = z.object({
  id: entityId,
  timestamp: clockTime,
  description: text(10, 500),
  suspectIds: z.array(entityId).max(6),
}).strict();

const evidenceSchema = z.object({
  id: entityId,
  title: text(3, 100),
  type: z.enum(['chat-transcript', 'witness-statement', 'cctv', 'photograph', 'forensic-report', 'timeline', 'physical-clue', 'access-record']),
  description: text(20, 900),
  content: text(20, 1800),
  location: text(2, 160),
  timestamp: clockTime,
  relatedSuspectIds: z.array(entityId).max(6),
  relatedEvidenceIds: z.array(entityId).max(20),
  timelineEventId: entityId,
  reliability: z.enum(['low', 'medium', 'high']),
  essential: z.boolean(),
}).strict();

const exclusionSchema = z.object({
  suspectId: entityId,
  evidenceIds: z.array(entityId).min(1).max(8),
  explanation: text(20, 500),
}).strict();

export const generatedMysterySchema = z.object({
  title: text(3, 120),
  description: text(30, 900),
  setting: z.object({ location: text(3, 160), incidentTime: clockTime }).strict(),
  incident: z.object({ description: text(20, 900), objective: text(10, 240) }).strict(),
  suspects: z.array(suspectSchema).min(3).max(6),
  timeline: z.array(timelineEventSchema).min(4).max(16),
  evidence: z.array(evidenceSchema).min(5).max(24),
  solution: z.object({
    culpritId: entityId,
    motive: text(10, 600),
    method: text(20, 900),
    reasoning: z.array(text(10, 500)).min(2).max(8),
    decisiveEvidenceIds: z.array(entityId).min(2).max(8),
    redHerringExplanations: z.array(z.object({ evidenceId: entityId, explanation: text(20, 500) }).strict()).min(1).max(8),
    suspectExclusions: z.array(exclusionSchema).min(2).max(5),
  }).strict(),
}).strict();

function timeMinutes(time) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function unique(values) {
  return new Set(values).size === values.length;
}

export function validateGeneratedMystery(value, brief) {
  let parsed;
  try {
    parsed = generatedMysterySchema.parse(value);
  } catch (error) {
    if (error instanceof z.ZodError) throw attachValidationDiagnostics(error, 'schema');
    throw error;
  }
  const issues = [];
  const add = (path, message) => issues.push({ code: 'custom', path, message });

  if (parsed.suspects.length !== brief.suspectCount) add(['suspects'], `Expected exactly ${brief.suspectCount} suspects.`);
  const minimumEvidence = brief.evidenceRichness === 'detailed' ? 8 : 5;
  if (parsed.evidence.length < minimumEvidence) add(['evidence'], `At least ${minimumEvidence} evidence items are required for ${brief.evidenceRichness} detail.`);

  const suspectIds = parsed.suspects.map((item) => item.id);
  const timelineIds = parsed.timeline.map((item) => item.id);
  const evidenceIds = parsed.evidence.map((item) => item.id);
  for (const [name, ids] of [['suspects', suspectIds], ['timeline', timelineIds], ['evidence', evidenceIds]]) {
    if (!unique(ids)) add([name], `${name} IDs must be unique.`);
  }
  if (!unique([...suspectIds, ...timelineIds, ...evidenceIds])) add([], 'Suspect, timeline, and evidence IDs must be unique across the case.');
  if (new Set(parsed.suspects.map(({ name }) => name.toLocaleLowerCase())).size !== parsed.suspects.length) {
    add(['suspects'], 'Each suspect must have a distinct name.');
  }

  const suspectSet = new Set(suspectIds);
  const timelineSet = new Set(timelineIds);
  const evidenceSet = new Set(evidenceIds);
  const evidenceById = new Map(parsed.evidence.map((item) => [item.id, item]));
  parsed.suspects.forEach((suspect, index) => {
    for (const [field, ids] of [['relationshipIds', suspect.relationshipIds], ['evidenceIds', suspect.evidenceIds]]) {
      if (!unique(ids)) add(['suspects', index, field], `${field} references must be unique.`);
    }
    if (suspect.relationshipIds.some((id) => !suspectSet.has(id) || id === suspect.id)) add(['suspects', index, 'relationshipIds'], 'Suspect relationships must reference other existing suspects.');
    if (suspect.evidenceIds.some((id) => !evidenceSet.has(id))) add(['suspects', index, 'evidenceIds'], 'Suspect evidence references must exist.');
    if (suspect.evidenceIds.some((id) => !evidenceById?.get(id)?.relatedSuspectIds.includes(suspect.id))) add(['suspects', index, 'evidenceIds'], 'Each suspect evidence reference must identify that suspect.');
  });
  let timelineDayOffset = 0;
  let previousTimelineMinute;
  let previousClockMinute;
  let crossedMidnight = false;
  parsed.timeline.forEach((event, index) => {
    if (!unique(event.suspectIds)) add(['timeline', index, 'suspectIds'], 'Timeline suspect references must be unique.');
    if (event.suspectIds.some((id) => !suspectSet.has(id))) add(['timeline', index, 'suspectIds'], 'Timeline suspect references must exist.');
    const clockMinute = timeMinutes(event.timestamp);
    if (previousClockMinute !== undefined && clockMinute < previousClockMinute) {
      if (crossedMidnight) {
        add(['timeline', index, 'timestamp'], 'Timeline may cross midnight only once and must remain chronological.');
      } else {
        timelineDayOffset += 24 * 60;
        crossedMidnight = true;
      }
    }
    const timelineMinute = clockMinute + timelineDayOffset;
    if (previousTimelineMinute !== undefined && timelineMinute < previousTimelineMinute) {
      add(['timeline', index, 'timestamp'], 'Timeline events must be in chronological order.');
    }
    previousClockMinute = clockMinute;
    previousTimelineMinute = timelineMinute;
  });
  if (!parsed.timeline.some(({ timestamp }) => timestamp === parsed.setting.incidentTime)) add(['setting', 'incidentTime'], 'The timeline must include the incident time.');
  parsed.evidence.forEach((item, index) => {
    for (const [field, ids] of [['relatedSuspectIds', item.relatedSuspectIds], ['relatedEvidenceIds', item.relatedEvidenceIds]]) {
      if (!unique(ids)) add(['evidence', index, field], `${field} references must be unique.`);
    }
    if (item.relatedSuspectIds.some((id) => !suspectSet.has(id))) add(['evidence', index, 'relatedSuspectIds'], 'Evidence suspect references must exist.');
    if (item.relatedEvidenceIds.some((id) => !evidenceSet.has(id) || id === item.id)) add(['evidence', index, 'relatedEvidenceIds'], 'Evidence links must reference other existing evidence items.');
    if (!timelineSet.has(item.timelineEventId)) add(['evidence', index, 'timelineEventId'], 'Evidence must reference an existing timeline event.');
    if (item.timestamp && item.timestamp !== parsed.timeline.find(({ id }) => id === item.timelineEventId)?.timestamp) add(['evidence', index, 'timestamp'], 'Evidence time must match its linked timeline event.');
  });

  const solution = parsed.solution;
  if (!suspectSet.has(solution.culpritId)) add(['solution', 'culpritId'], 'The culprit must be one of the case suspects.');
  if (!unique(solution.decisiveEvidenceIds) || solution.decisiveEvidenceIds.some((id) => !evidenceSet.has(id))) add(['solution', 'decisiveEvidenceIds'], 'Decisive clues must be unique references to existing evidence.');
  const decisiveItems = solution.decisiveEvidenceIds.map((id) => evidenceById.get(id)).filter(Boolean);
  if (decisiveItems.length < 2 || decisiveItems.some((item) => !item.essential || !item.relatedSuspectIds.includes(solution.culpritId))) {
    add(['solution', 'decisiveEvidenceIds'], 'At least two essential clues must support the saved culprit.');
  }

  const innocentIds = suspectIds.filter((id) => id !== solution.culpritId);
  const exclusions = solution.suspectExclusions;
  if (!unique(exclusions.map(({ suspectId }) => suspectId)) || exclusions.length !== innocentIds.length || innocentIds.some((id) => !exclusions.some((item) => item.suspectId === id))) {
    add(['solution', 'suspectExclusions'], 'Every alternative suspect must have one evidence-based exclusion.');
  }
  exclusions.forEach((item, index) => {
    if (!unique(item.evidenceIds)) add(['solution', 'suspectExclusions', index, 'evidenceIds'], 'Exclusion evidence references must be unique.');
    if (!suspectSet.has(item.suspectId) || item.suspectId === solution.culpritId) add(['solution', 'suspectExclusions', index, 'suspectId'], 'Exclusions must refer to a non-culprit suspect.');
    if (item.evidenceIds.some((id) => !evidenceSet.has(id) || !evidenceById.get(id)?.relatedSuspectIds.includes(item.suspectId))) add(['solution', 'suspectExclusions', index, 'evidenceIds'], 'Each exclusion must reference evidence connected to that suspect.');
  });
  const redHerringIds = solution.redHerringExplanations.map(({ evidenceId }) => evidenceId);
  if (!unique(redHerringIds) || redHerringIds.some((id) => !evidenceSet.has(id) || solution.decisiveEvidenceIds.includes(id) || evidenceById.get(id)?.essential)) {
    add(['solution', 'redHerringExplanations'], 'Red herrings must reference unique existing non-decisive evidence.');
  }

  const culprit = parsed.suspects.find(({ id }) => id === solution.culpritId);
  const playerText = JSON.stringify({ ...parsed, solution: undefined }).toLocaleLowerCase();
  const escapedName = culprit?.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (escapedName && new RegExp(`\\b(?:the\\s+)?(?:culprit|perpetrator|thief|person responsible)\\s+(?:is|was)\\s+${escapedName}\\b`, 'i').test(playerText)) {
    add(['solution', 'culpritId'], 'Player-facing text must not reveal the culprit directly.');
  }

  if (issues.length) {
    throw attachValidationDiagnostics(new z.ZodError(issues), 'consistency');
  }
  return parsed;
}

const stringSchema = { type: 'STRING' };
const arrayOfStrings = { type: 'ARRAY', items: stringSchema };
const objectSchema = (properties, required = Object.keys(properties)) => ({ type: 'OBJECT', properties, required });

export const geminiMysteryResponseSchema = objectSchema({
  title: stringSchema,
  description: stringSchema,
  setting: objectSchema({ location: stringSchema, incidentTime: stringSchema }),
  incident: objectSchema({ description: stringSchema, objective: stringSchema }),
  suspects: { type: 'ARRAY', items: objectSchema({
    id: stringSchema, name: stringSchema, appearance: stringSchema, role: stringSchema,
    biography: stringSchema, motive: stringSchema, alibi: stringSchema,
    relationshipIds: arrayOfStrings, evidenceIds: arrayOfStrings,
  }) },
  timeline: { type: 'ARRAY', items: objectSchema({ id: stringSchema, timestamp: stringSchema, description: stringSchema, suspectIds: arrayOfStrings }) },
  evidence: { type: 'ARRAY', items: objectSchema({
    id: stringSchema, title: stringSchema, type: { type: 'STRING', enum: ['chat-transcript', 'witness-statement', 'cctv', 'photograph', 'forensic-report', 'timeline', 'physical-clue', 'access-record'] },
    description: stringSchema, content: stringSchema, location: stringSchema, timestamp: stringSchema,
    relatedSuspectIds: arrayOfStrings, relatedEvidenceIds: arrayOfStrings, timelineEventId: stringSchema,
    reliability: { type: 'STRING', enum: ['low', 'medium', 'high'] }, essential: { type: 'BOOLEAN' },
  }) },
  solution: objectSchema({
    culpritId: stringSchema, motive: stringSchema, method: stringSchema, reasoning: arrayOfStrings,
    decisiveEvidenceIds: arrayOfStrings,
    redHerringExplanations: { type: 'ARRAY', items: objectSchema({ evidenceId: stringSchema, explanation: stringSchema }) },
    suspectExclusions: { type: 'ARRAY', items: objectSchema({ suspectId: stringSchema, evidenceIds: arrayOfStrings, explanation: stringSchema }) },
  }),
});
