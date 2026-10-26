import { createHash } from 'node:crypto';
import { env } from '../config/env.js';
import { MediaAsset } from '../models/MediaAsset.js';
import { createImageGenerationProvider, createVideoGenerationProvider } from '../providers/media/index.js';
import { retryTransiently, withTimeout } from '../providers/media/errors.js';
import { MEDIA_PROMPT_VERSION, buildEvidenceMediaPrompt } from '../providers/media/prompts.js';
import { deleteMediaFile, readMediaFile, saveMediaFile } from './mediaStorage.service.js';
import { validateImageAgainstCase } from '../validators/mediaConsistency.js';

const imageProvider = createImageGenerationProvider();
const videoProvider = createVideoGenerationProvider();
const activeJobs = new Set();
const queuedJobs = [];
let runningJobs = 0;
const maxConcurrentJobs = 2;

const idText = (value) => value?.toString?.() ?? String(value ?? '');

export function toMediaAssetResponse(asset) {
  const doc = typeof asset.toObject === 'function' ? asset.toObject() : asset;
  return {
    id: idText(doc._id),
    mysteryId: idText(doc.mysteryId),
    evidenceId: doc.evidenceId,
    mediaType: doc.mediaType,
    status: doc.status,
    mode: doc.mode,
    provider: doc.provider,
    model: doc.model,
    mimeType: doc.mimeType,
    sizeBytes: doc.sizeBytes,
    durationSeconds: doc.durationSeconds,
    eventTimestamp: doc.eventTimestamp,
    retryCount: doc.retryCount,
    usage: doc.usage,
    costUsd: doc.costUsd,
    errorCode: doc.errorCode,
    statusMessage: doc.statusMessage,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function enqueueJob(assetId) {
  const key = idText(assetId);
  if (activeJobs.has(key) || queuedJobs.includes(key)) return;
  queuedJobs.push(key);
  void drainQueue();
}

async function drainQueue() {
  while (runningJobs < maxConcurrentJobs && queuedJobs.length > 0) {
    const assetId = queuedJobs.shift();
    if (activeJobs.has(assetId)) continue;
    activeJobs.add(assetId);
    runningJobs += 1;
    void processMediaJob(assetId).catch(async (error) => {
      console.error('Media worker failed:', { assetId, errorName: error?.name ?? 'Error' });
      await MediaAsset.updateOne({ _id: assetId, status: { $in: ['pending', 'processing'] } }, {
        $set: { status: 'failed', errorCode: 'MEDIA_WORKER_FAILED', statusMessage: 'Media could not be generated. The case and evidence remain available.' },
      });
    }).catch(() => {}).finally(() => {
      activeJobs.delete(assetId);
      runningJobs -= 1;
      void drainQueue();
    });
  }
}

async function processMediaJob(assetId) {
  const asset = await MediaAsset.findById(assetId).select('+prompt +validationContext');
  if (!asset || !['pending', 'processing'].includes(asset.status)) return;
  const provider = asset.mediaType === 'image' ? imageProvider : videoProvider;
  if (!provider) {
    asset.status = 'unavailable';
    asset.mode = 'unavailable';
    asset.statusMessage = 'Video generation is disabled in configuration.';
    await asset.save();
    return;
  }

  asset.status = 'processing';
  asset.statusMessage = `${asset.mode === 'mock' ? 'Creating labeled mock' : 'Generating'} ${asset.mediaType} evidence.`;
  asset.errorCode = null;
  asset.failureMessage = null;
  await asset.save();

  let savedStorageKey = null;
  try {
    const result = await retryTransiently(async () => withTimeout(
        provider.generate({ prompt: asset.prompt, mediaType: asset.mediaType }),
        env.MEDIA_PROVIDER_TIMEOUT_MS,
        `${asset.mediaType} generation`,
      ), {
        maxRetries: env.MEDIA_MAX_RETRIES,
        onRetry: async (retryCount) => {
          asset.retryCount = retryCount;
          asset.status = 'processing';
          asset.statusMessage = `Temporary provider issue. Retrying (${retryCount}/${env.MEDIA_MAX_RETRIES}).`;
          await asset.save();
        },
      });
    if (result.unavailable) {
      asset.status = 'unavailable';
      asset.mode = result.mode ?? 'unavailable';
      asset.statusMessage = result.message;
      await asset.save();
      return;
    }

    let validationUsage = null;
    if (asset.mediaType === 'image' && asset.mode === 'ai') {
      if (!asset.validationContext?.mystery || !asset.validationContext?.evidence) {
        throw Object.assign(new Error('Saved case context is unavailable for image validation.'), { code: 'MEDIA_VALIDATION_CONTEXT_MISSING' });
      }
      const validation = await withTimeout(
        validateImageAgainstCase({
          mystery: asset.validationContext.mystery,
          evidence: asset.validationContext.evidence,
          buffer: result.buffer,
          mimeType: result.mimeType,
        }),
        env.MEDIA_PROVIDER_TIMEOUT_MS,
        'Image consistency validation',
      );
      validationUsage = validation.usage;
    }

    const saved = await saveMediaFile(asset.id, result.mimeType, result.buffer);
    savedStorageKey = saved.storageKey;
    asset.status = 'ready';
    asset.storageKey = saved.storageKey;
    asset.mimeType = result.mimeType;
    asset.sizeBytes = saved.sizeBytes;
    asset.durationSeconds = result.durationSeconds ?? null;
    asset.usage = { generation: result.usage ?? null, validation: validationUsage };
    asset.costUsd = result.costUsd ?? null;
    asset.statusMessage = asset.mode === 'mock'
      ? 'Mock image fixture. It is not an AI-generated case image.'
      : 'Generated fictional evidence. AI-generated media.';
    await asset.save();
  } catch (error) {
    if (savedStorageKey) await deleteMediaFile(savedStorageKey).catch(() => {});
    asset.retryCount = error.retryCount ?? asset.retryCount;
    asset.errorCode = error.code ?? 'MEDIA_GENERATION_FAILED';
    asset.failureMessage = error.message?.slice(0, 240) ?? 'Media generation failed.';
    // Log safe diagnostics for local development; never log API keys, prompts, or headers.
    console.error('Media generation failed', {
      assetId: idText(asset._id),
      mediaType: asset.mediaType,
      provider: asset.provider,
      model: asset.model,
      errorCode: asset.errorCode,
      message: String(error.message ?? 'Media generation failed.').slice(0, 240),
      providerStatus: error.cause?.status ?? error.status ?? null,
      providerCode: error.cause?.code ?? null,
      providerMessage: String(error.cause?.message ?? '').slice(0, 240),
    });
    asset.status = 'failed';
    asset.statusMessage = 'Media could not be generated. The case and evidence remain available.';
    await asset.save();
  }
}

export async function requestEvidenceMedia({ mystery, evidenceId, mediaType, userId }) {
  if (!mystery?._id || !Array.isArray(mystery.evidence)) {
    throw new TypeError('Media generation requires a persisted mystery record.');
  }
  if (!userId || idText(mystery.ownerId) !== idText(userId)) {
    const error = new Error('You cannot generate media for this mystery.');
    error.status = 403;
    error.code = 'FORBIDDEN';
    throw error;
  }
  if (!['image', 'video'].includes(mediaType)) throw new TypeError('mediaType must be image or video.');
  const evidence = mystery.evidence.find((item) => idText(item.id ?? item._id) === idText(evidenceId));
  if (!evidence) throw new TypeError('Evidence must belong to the saved mystery.');

  const evidenceSnapshot = {
    id: idText(evidence.id ?? evidence._id),
    title: evidence.title,
    type: evidence.type,
    description: evidence.description,
    discoveryLocation: evidence.discoveryLocation ?? evidence.location,
    timestamp: evidence.timestamp,
    timelineEventId: evidence.timelineEventId,
  };
  // Timeline events point to evidence through evidence.timelineEventId; event
  // documents do not store evidenceId, so match against the event's own id.
  const timelineEntry = Array.isArray(mystery.timeline)
    ? mystery.timeline.find((entry) => idText(entry.id) === idText(evidence.timelineEventId))
    : null;
  const mysterySnapshot = {
    _id: idText(mystery._id),
    title: mystery.title,
    setting: {
      location: mystery.setting?.location ?? (typeof mystery.setting === 'string' ? mystery.setting : undefined),
      incidentTime: mystery.setting?.incidentTime,
    },
    incident: { description: mystery.incident?.description ?? mystery.description },
    suspects: (mystery.suspects ?? []).map((suspect) => ({
      name: suspect.name,
      appearance: suspect.appearance ?? suspect.portraitDescription,
      portraitDescription: suspect.portraitDescription,
      role: suspect.role ?? suspect.occupation,
      occupation: suspect.occupation,
    })),
    timeline: timelineEntry ? [{
      id: idText(timelineEntry.id),
      timestamp: timelineEntry.timestamp,
      description: timelineEntry.description,
    }] : [],
  };

  const provider = mediaType === 'image' ? imageProvider : videoProvider;
  const providerName = provider?.name ?? 'disabled';
  const model = provider?.model ?? null;
  const prompt = buildEvidenceMediaPrompt({
    mystery: mysterySnapshot,
    evidence: evidenceSnapshot,
    mediaType,
    maxDurationSeconds: env.VIDEO_MAX_DURATION_SECONDS,
  });
  const dedupeKey = createHash('sha256')
    .update([idText(mystery._id), idText(evidenceId), mediaType, providerName, model ?? '', prompt].join('\n'))
    .digest('hex');

  let existing = await MediaAsset.findOne({ dedupeKey }).select('+prompt');
  if (existing && ['ready', 'pending', 'processing', 'unavailable'].includes(existing.status)) {
    if (existing.status === 'pending') enqueueJob(existing._id);
    return toMediaAssetResponse(existing);
  }
  if (mediaType === 'image') {
    const imageCount = await MediaAsset.countDocuments({ mysteryId: mystery._id, mediaType: 'image', status: { $in: ['pending', 'processing', 'ready'] } });
    if (imageCount >= env.MEDIA_MAX_IMAGES_PER_MYSTERY) {
      const error = new Error('This case has reached its configured image generation limit.');
      error.code = 'MEDIA_LIMIT_REACHED';
      throw error;
    }
  }

  const mode = providerName === 'google' ? 'ai'
    : providerName === 'mock' ? 'mock'
      : providerName === 'simulation' ? 'simulated' : 'unavailable';
  try {
    existing = await MediaAsset.create({
      mysteryId: mystery._id,
      evidenceId: idText(evidenceId),
      mediaType,
      status: providerName === 'simulation' || providerName === 'disabled' ? 'unavailable' : 'pending',
      mode,
      provider: providerName,
      model,
      promptVersion: MEDIA_PROMPT_VERSION,
      prompt,
      validationContext: { mystery: mysterySnapshot, evidence: evidenceSnapshot },
      dedupeKey,
      eventTimestamp: evidence.timestamp ?? null,
      statusMessage: providerName === 'simulation'
        ? 'Simulated CCTV unavailable: no real video was generated.'
        : providerName === 'disabled' ? 'Video generation is disabled.' : null,
    });
  } catch (error) {
    if (error.code !== 11000) throw error;
    existing = await MediaAsset.findOne({ dedupeKey }).select('+prompt');
    if (!existing) throw error;
  }
  if (existing.status === 'pending') enqueueJob(existing._id);
  return toMediaAssetResponse(existing);
}

export async function getMediaAsset(assetId) {
  const asset = await MediaAsset.findById(assetId);
  return asset ? toMediaAssetResponse(asset) : null;
}

export async function listMediaAssets(mysteryId, evidenceId) {
  const query = { mysteryId };
  if (evidenceId) query.evidenceId = evidenceId;
  const assets = await MediaAsset.find(query).sort({ createdAt: -1 });
  return assets.map(toMediaAssetResponse);
}

export async function loadReadyMediaContent({ assetId, mysteryId }) {
  const asset = await MediaAsset.findOne({ _id: assetId, mysteryId, status: 'ready' });
  if (!asset?.storageKey) return null;
  const buffer = await readMediaFile(asset.storageKey);
  return { buffer, mimeType: asset.mimeType };
}

export async function recoverPendingMediaJobs() {
  await MediaAsset.updateMany({ status: 'processing' }, {
    $set: {
      status: 'failed',
      errorCode: 'MEDIA_WORKER_INTERRUPTED',
      statusMessage: 'The worker stopped during generation. Retry explicitly to avoid duplicate provider charges.',
    },
  });
  const pending = await MediaAsset.find({ status: 'pending' }).select('_id').lean();
  for (const asset of pending) enqueueJob(asset._id);
}

export async function loadMediaAssetDocument(assetId) {
  return MediaAsset.findById(assetId).select('+prompt');
}

export async function retryMediaAsset(assetId) {
  const asset = await MediaAsset.findById(assetId).select('+prompt');
  if (!asset || asset.status !== 'failed') return null;
  asset.status = 'pending';
  asset.retryCount = 0;
  asset.errorCode = null;
  asset.failureMessage = null;
  await asset.save();
  enqueueJob(asset._id);
  return toMediaAssetResponse(asset);
}
