import mongoose from 'mongoose';

const noteSchema = new mongoose.Schema({
  id: { type: String, required: true, maxlength: 40 },
  text: { type: String, required: true, maxlength: 5000 },
}, { _id: false });

const suspectNoteSchema = new mongoose.Schema({
  suspectId: { type: String, required: true },
  note: { type: String, required: true, maxlength: 2000 },
}, { _id: false });

const evidenceNoteSchema = new mongoose.Schema({
  evidenceId: { type: String, required: true },
  note: { type: String, required: true, maxlength: 2000 },
}, { _id: false });

const evidenceSuspectLinkSchema = new mongoose.Schema({
  evidenceId: { type: String, required: true },
  suspectId: { type: String, required: true },
}, { _id: false });

const hintSchema = new mongoose.Schema({
  level: { type: Number, required: true, min: 1, max: 3 },
  text: { type: String, required: true, maxlength: 500 },
  requestedAt: { type: Date, required: true, default: Date.now },
}, { _id: false });

const accusationSchema = new mongoose.Schema({
  suspectId: { type: String, required: true },
  explanation: { type: String, required: true, minlength: 20, maxlength: 3000 },
  supportingEvidenceIds: [{ type: String }],
}, { _id: false });

const investigationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
  mysteryId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Mystery' },
  status: { type: String, enum: ['active', 'submitted', 'completed'], default: 'active', required: true },
  inspectedEvidenceIds: { type: [String], default: [] },
  bookmarkedEvidenceIds: { type: [String], default: [] },
  evidenceSuspectLinks: { type: [evidenceSuspectLinkSchema], default: [] },
  evidenceNotes: { type: [evidenceNoteSchema], default: [] },
  suspectNotes: { type: [suspectNoteSchema], default: [] },
  userNotes: { type: [noteSchema], default: [] },
  theory: { type: String, maxlength: 3000, default: '' },
  hintHistory: { type: [hintSchema], default: [] },
  accusation: { type: accusationSchema, default: null },
  score: { type: Number, min: 0, max: 100, default: null },
  scoreBreakdown: {
    culprit: { type: Number, min: 0, max: 60, default: null },
    explanation: { type: Number, min: 0, max: 25, default: null },
    evidence: { type: Number, min: 0, max: 15, default: null },
  },
  startedAt: { type: Date, default: Date.now, required: true },
  submittedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
}, { timestamps: true, versionKey: false });

investigationSchema.index({ userId:  1, updatedAt: -1 });
investigationSchema.index({ mysteryId: 1, userId: 1 }, { unique: true });

export const Investigation = mongoose.models.Investigation
  ?? mongoose.model('Investigation', investigationSchema);
