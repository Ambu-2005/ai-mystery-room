import mongoose from 'mongoose';

const redHerringSchema = new mongoose.Schema({
  evidenceId: { type: String, required: true },
  explanation: { type: String, required: true, maxlength: 500 },
}, { _id: false });

const exclusionSchema = new mongoose.Schema({
  suspectId: { type: String, required: true },
  evidenceIds: [{ type: String, required: true }],
  explanation: { type: String, required: true, maxlength: 500 },
}, { _id: false });

const solutionSchema = new mongoose.Schema({
  mysteryId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true, ref: 'Mystery' },
  culpritId: { type: String, required: true, select: false },
  motive: { type: String, required: true, maxlength: 600, select: false },
  method: { type: String, required: true, maxlength: 900, select: false },
  reasoning: { type: [String], required: true, select: false },
  decisiveEvidenceIds: { type: [String], required: true, select: false },
  redHerringExplanations: { type: [redHerringSchema], required: true, select: false },
  suspectExclusions: { type: [exclusionSchema], required: true, select: false },
}, { timestamps: { createdAt: true, updatedAt: false }, versionKey: false });

export const MysterySolution = mongoose.models.MysterySolution
  ?? mongoose.model('MysterySolution', solutionSchema);
