import mongoose from 'mongoose';

const mediaAssetSchema = new mongoose.Schema({
  mysteryId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  evidenceId: { type: String, required: true, trim: true },
  mediaType: { type: String, enum: ['image', 'video'], required: true },
  status: { type: String, enum: ['pending', 'processing', 'ready', 'failed', 'unavailable'], default: 'pending', index: true },
  mode: { type: String, enum: ['ai', 'mock', 'simulated', 'unavailable'], required: true },
  provider: { type: String, required: true },
  model: { type: String, default: null },
  promptVersion: { type: String, required: true },
  prompt: { type: String, required: true, select: false },
  validationContext: { type: mongoose.Schema.Types.Mixed, default: null, select: false },
  dedupeKey: { type: String, required: true, unique: true },
  storageKey: { type: String, default: null },
  mimeType: { type: String, default: null },
  sizeBytes: { type: Number, default: null },
  durationSeconds: { type: Number, default: null },
  eventTimestamp: { type: String, default: null },
  inspectedAt: { type: Date, default: null },
  retryCount: { type: Number, default: 0, min: 0 },
  usage: { type: mongoose.Schema.Types.Mixed, default: null },
  costUsd: { type: Number, default: null, min: 0 },
  errorCode: { type: String, default: null },
  failureMessage: { type: String, default: null },
  statusMessage: { type: String, default: null },
}, { timestamps: true });

mediaAssetSchema.index({ mysteryId: 1, evidenceId: 1, mediaType: 1, createdAt: -1 });
mediaAssetSchema.index({ status: 1, updatedAt: 1 });

export const MediaAsset = mongoose.models.MediaAsset
  ?? mongoose.model('MediaAsset', mediaAssetSchema);
