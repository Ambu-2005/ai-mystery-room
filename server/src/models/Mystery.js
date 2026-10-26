import mongoose from 'mongoose';

const settingSchema = new mongoose.Schema({
  location: { type: String, required: true, maxlength: 160 },
  incidentTime: { type: String, required: true },
}, { _id: false });

const incidentSchema = new mongoose.Schema({
  description: { type: String, required: true, maxlength: 900 },
  objective: { type: String, required: true, maxlength: 240 },
}, { _id: false });

const suspectSchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true, maxlength: 80 },
  appearance: { type: String, required: true, maxlength: 240 },
  role: { type: String, required: true, maxlength: 120 },
  biography: { type: String, required: true, maxlength: 700 },
  motive: { type: String, required: true, maxlength: 500 },
  alibi: { type: String, required: true, maxlength: 500 },
  relationshipIds: [{ type: String }],
  evidenceIds: [{ type: String }],
}, { _id: false });

const timelineEventSchema = new mongoose.Schema({
  id: { type: String, required: true },
  timestamp: { type: String, required: true },
  description: { type: String, required: true, maxlength: 500 },
  suspectIds: [{ type: String }],
}, { _id: false });

const evidenceSchema = new mongoose.Schema({
  id: { type: String, required: true },
  title: { type: String, required: true, maxlength: 100 },
  type: { type: String, required: true },
  description: { type: String, required: true, maxlength: 900 },
  content: { type: String, required: true, maxlength: 1800 },
  location: { type: String, required: true, maxlength: 160 },
  timestamp: { type: String },
  relatedSuspectIds: [{ type: String }],
  relatedEvidenceIds: [{ type: String }],
  timelineEventId: { type: String, required: true },
  reliability: { type: String, enum: ['low', 'medium', 'high'], required: true },
  essential: { type: Boolean, required: true },
}, { _id: false });

const mysterySchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
  title: { type: String, required: true, maxlength: 120 },
  description: { type: String, required: true, maxlength: 900 },
  scenario: { type: String, required: true, maxlength: 2000 },
  genre: { type: String, required: true, enum: ['detective', 'college-mystery', 'heist', 'missing-object', 'locked-room', 'historical', 'corporate'] },
  difficulty: { type: String, required: true, enum: ['easy', 'medium', 'hard'] },
  evidenceRichness: { type: String, required: true, enum: ['standard', 'detailed'] },
  contentRating: { type: String, required: true, enum: ['teen'], default: 'teen' },
  preferredSetting: { type: String, maxlength: 160, default: '' },
  language: { type: String, required: true, enum: ['en'], default: 'en' },
  status: { type: String, required: true, enum: ['generating', 'playable', 'completed', 'failed'], default: 'generating' },
  setting: { type: settingSchema, required: true },
  incident: { type: incidentSchema, required: true },
  suspects: { type: [suspectSchema], required: true },
  timeline: { type: [timelineEventSchema], required: true },
  evidence: { type: [evidenceSchema], required: true },
  generationMetadata: {
    provider: { type: String, required: true },
    model: { type: String, required: true },
    durationMs: { type: Number, min: 0 },
    usage: { type: mongoose.Schema.Types.Mixed, default: null },
    retryCount: { type: Number, min: 0, default: 0 },
  },
  promptVersion: { type: String, required: true },
}, { timestamps: true, versionKey: false });

mysterySchema.index({ ownerId: 1, createdAt: -1 });
mysterySchema.index({ status: 1, createdAt: -1 });

export const Mystery = mongoose.models.Mystery ?? mongoose.model('Mystery', mysterySchema);

export function toPublicMystery(mystery) {
  return {
    id: String(mystery._id ?? mystery.id),
    title: mystery.title,
    description: mystery.description,
    scenario: mystery.scenario,
    genre: mystery.genre,
    difficulty: mystery.difficulty,
    status: mystery.status,
    setting: { location: mystery.setting.location, incidentTime: mystery.setting.incidentTime },
    incident: { description: mystery.incident.description, objective: mystery.incident.objective },
    suspects: mystery.suspects.map((suspect) => ({
      id: suspect.id,
      name: suspect.name,
      appearance: suspect.appearance,
      role: suspect.role,
      biography: suspect.biography,
      motive: suspect.motive,
      alibi: suspect.alibi,
      relationshipIds: suspect.relationshipIds,
      evidenceIds: suspect.evidenceIds,
    })),
    timeline: mystery.timeline.map((event) => ({
      id: event.id,
      timestamp: event.timestamp,
      description: event.description,
      suspectIds: event.suspectIds,
    })),
    evidence: mystery.evidence.map((item) => ({
      id: item.id,
      title: item.title,
      type: item.type,
      description: item.description,
      content: item.content,
      location: item.location,
      timestamp: item.timestamp,
      relatedSuspectIds: item.relatedSuspectIds,
      relatedEvidenceIds: item.relatedEvidenceIds,
      timelineEventId: item.timelineEventId,
      reliability: item.reliability,
    })),
    createdAt: mystery.createdAt,
  };
}
