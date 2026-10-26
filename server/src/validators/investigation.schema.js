import { z } from 'zod';

const id = z.string().trim().min(2).max(40).regex(/^[a-z][a-z0-9_-]+$/);
const uniqueBy = (key) => (items) => new Set(items.map((item) => (typeof item === 'string' ? item : key(item)))).size === items.length;

const evidenceSuspectLinkSchema = z.object({ evidenceId: id, suspectId: id }).strict();
const suspectNoteSchema = z.object({ suspectId: id, note: z.string().trim().max(2000) }).strict();
const evidenceNoteSchema = z.object({ evidenceId: id, note: z.string().trim().max(2000) }).strict();
const userNoteSchema = z.object({ id: z.string().trim().min(1).max(40), text: z.string().trim().max(5000) }).strict();

export const progressSchema = z.object({
  inspectedEvidenceIds: z.array(id).max(24).optional(),
  bookmarkedEvidenceIds: z.array(id).max(24).optional(),
  evidenceSuspectLinks: z.array(evidenceSuspectLinkSchema).max(144).optional(),
}).strict().superRefine((data, context) => {
  for (const field of ['inspectedEvidenceIds', 'bookmarkedEvidenceIds']) {
    if (data[field] && !uniqueBy((item) => item)(data[field])) {
      context.addIssue({ code: 'custom', path: [field], message: 'IDs must be unique.' });
    }
  }
  if (data.evidenceSuspectLinks && !uniqueBy(({ evidenceId, suspectId }) => `${evidenceId}:${suspectId}`)(data.evidenceSuspectLinks)) {
    context.addIssue({ code: 'custom', path: ['evidenceSuspectLinks'], message: 'Evidence/suspect links must be unique.' });
  }
});

export const notesSchema = z.object({
  userNotes: z.array(userNoteSchema).max(30).default([]),
  evidenceNotes: z.array(evidenceNoteSchema).max(24).default([]),
  suspectNotes: z.array(suspectNoteSchema).max(6).default([]),
  theory: z.string().trim().max(3000).default(''),
}).strict().superRefine((data, context) => {
  for (const [field, items, key] of [
    ['userNotes', data.userNotes, ({ id: noteId }) => noteId],
    ['evidenceNotes', data.evidenceNotes, ({ evidenceId }) => evidenceId],
    ['suspectNotes', data.suspectNotes, ({ suspectId }) => suspectId],
  ]) {
    if (!uniqueBy(key)(items)) context.addIssue({ code: 'custom', path: [field], message: 'Note keys must be unique.' });
  }
});

export const accusationSchema = z.object({
  suspectId: id,
  explanation: z.string().trim().min(20).max(3000),
  supportingEvidenceIds: z.array(id).max(24).default([]),
}).strict().superRefine((data, context) => {
  if (!uniqueBy((item) => item)(data.supportingEvidenceIds)) {
    context.addIssue({ code: 'custom', path: ['supportingEvidenceIds'], message: 'Supporting evidence IDs must be unique.' });
  }
});
