import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'vitest';
import mongoose from 'mongoose';
import { MediaAsset } from '../src/models/MediaAsset.js';
import { MediaProviderError, retryTransiently, withTimeout } from '../src/providers/media/errors.js';
import { GoogleImageGenerationProvider } from '../src/providers/media/googleImage.provider.js';
import { GoogleVideoGenerationProvider } from '../src/providers/media/googleVideo.provider.js';
import { MockImageGenerationProvider } from '../src/providers/media/mockImage.provider.js';
import { SimulatedVideoProvider } from '../src/providers/media/simulatedVideo.provider.js';
import { LocalMediaStorageProvider } from '../src/providers/media/localStorage.provider.js';
import { buildEvidenceMediaPrompt, buildImageConsistencyPrompt } from '../src/providers/media/prompts.js';
import { validateImageAgainstCase } from '../src/validators/mediaConsistency.js';

const savedCase = {
  _id: new mongoose.Types.ObjectId(),
  title: 'The Missing Prototype',
  setting: { location: 'Fictional engineering laboratory' },
  incident: { description: 'A prototype disappeared after a college exhibition.' },
  suspects: [{ name: 'Mira', appearance: 'Short dark hair', role: 'Researcher' }],
  solution: { culpritId: 'secret-suspect', method: 'private method must not enter media prompts' },
  timeline: [{ id: 'event-ev-1', timestamp: '18:40', description: 'A cabinet was opened.' }],
  evidence: [{ id: 'ev-1', timelineEventId: 'event-ev-1', title: 'Cabinet access log', type: 'access-record', description: 'The laboratory cabinet opened at 18:42.', timestamp: '18:42' }],
};

describe('media provider foundation', () => {
  it('builds image/video prompts only from public saved facts', () => {
    const prompt = buildEvidenceMediaPrompt({ mystery: savedCase, evidence: savedCase.evidence[0], mediaType: 'video' });
    assert.match(prompt, /18:40/);
    assert.match(prompt, /A cabinet was opened/);
    assert.match(prompt, /Fictional engineering laboratory/);
    assert.match(prompt, /no longer than 8 seconds/);
    assert.doesNotMatch(prompt, /secret-suspect|private method/);
    assert.match(prompt, /Do not reveal or imply who committed/);
    const consistencyPrompt = buildImageConsistencyPrompt({ mystery: savedCase, evidence: savedCase.evidence[0] });
    assert.doesNotMatch(consistencyPrompt, /secret-suspect|private method/);
  });

  it('uses the configured Google image model through Interactions API and returns image bytes', async () => {
    let request;
    const provider = new GoogleImageGenerationProvider({
      model: 'configured-image-model',
      client: { interactions: { create: async (input) => {
        request = input;
        return { output_image: { data: Buffer.from('image').toString('base64'), mime_type: 'image/png' }, usage: { total_tokens: 17 } };
      } } },
    });
    const output = await provider.generate({ prompt: 'fictional evidence prompt' });
    assert.equal(request.model, 'configured-image-model');
    assert.equal(request.response_format.type, 'image');
    assert.equal(request.response_format.image_size, '1K');
    assert.deepEqual(output.buffer, Buffer.from('image'));
    assert.equal(output.mimeType, 'image/png');
    assert.equal(output.usage.total_tokens, 17);
  });

  it('uses Google Interactions API video generation and returns inline bytes when provided', async () => {
    let request;
    const provider = new GoogleVideoGenerationProvider({
      model: 'configured-video-model',
      client: { interactions: { create: async (input) => {
        request = input;
        return { output_video: { data: Buffer.from('video').toString('base64'), mime_type: 'video/mp4' }, usage: { total_tokens: 88 } };
      } } },
    });
    const output = await provider.generate({ prompt: 'fictional CCTV evidence prompt' });
    assert.equal(request.model, 'configured-video-model');
    assert.equal(request.response_format.type, 'video');
    assert.equal(request.response_format.delivery, 'uri');
    assert.equal(request.response_format.resolution, '720p');
    assert.deepEqual(output.buffer, Buffer.from('video'));
    assert.equal(output.mimeType, 'video/mp4');
    assert.equal(output.usage.total_tokens, 88);
  });

  it('polls and downloads URI-delivered video from the Google Files API', async () => {
    let lookedUpName;
    let downloadedPath;
    const provider = new GoogleVideoGenerationProvider({
      model: 'configured-video-model',
      pollIntervalMs: 1,
      client: {
        interactions: { create: async () => ({ output_video: { uri: 'https://generativelanguage.googleapis.com/v1beta/files/abc-123:download?alt=media', mime_type: 'video/mp4' } }) },
        files: {
          get: async ({ name }) => { lookedUpName = name; return { state: 'ACTIVE' }; },
          download: async ({ file, downloadPath }) => { downloadedPath = downloadPath; await writeFile(downloadPath, Buffer.from('downloaded-video')); },
        },
      },
    });
    const output = await provider.generate({ prompt: 'fictional CCTV evidence prompt' });
    assert.equal(lookedUpName, 'files/abc-123');
    assert.ok(downloadedPath.endsWith('evidence.mp4'));
    assert.deepEqual(output.buffer, Buffer.from('downloaded-video'));
    assert.equal(output.mimeType, 'video/mp4');
  });

  it('validates generated images against case facts and rejects contradictions', async () => {
    let request;
    const client = { models: { generateContent: async (input) => {
      request = input;
      return {
        candidates: [{ content: { parts: [{ text: '{"consistent":true,"contradictions":[]}' }] } }],
        usageMetadata: { totalTokenCount: 44 },
      };
    } } };
    const result = await validateImageAgainstCase({
      mystery: savedCase,
      evidence: savedCase.evidence[0],
      buffer: Buffer.from('png-bytes'),
      mimeType: 'image/png',
      client,
      model: 'test-validator',
    });
    assert.equal(result.consistent, true);
    assert.equal(result.validator, 'test-validator');
    assert.match(request.contents[0].text, /Canonical case facts/);
    assert.doesNotMatch(request.contents[0].text, /secret-suspect|private method/);
    assert.equal(request.contents[1].inlineData.mimeType, 'image/png');

    const contradictoryClient = { models: { generateContent: async () => ({
      candidates: [{ content: { parts: [{ text: '{"consistent":false,"contradictions":["wrong room"]}' }] } }],
    }) } };
    await assert.rejects(validateImageAgainstCase({
      mystery: savedCase,
      evidence: savedCase.evidence[0],
      buffer: Buffer.from('png-bytes'),
      mimeType: 'image/png',
      client: contradictoryClient,
      model: 'test-validator',
    }), (error) => error.code === 'MEDIA_VALIDATION_FAILED');
  });

  it('marks mock images and simulated video instead of disguising them as real media', async () => {
    const image = await new MockImageGenerationProvider().generate({ prompt: 'Case scene' });
    assert.equal(image.mimeType, 'image/svg+xml');
    assert.match(image.buffer.toString(), /MOCK EVIDENCE/);
    const video = await new SimulatedVideoProvider().generate({});
    assert.equal(video.unavailable, true);
    assert.equal(video.mode, 'simulated');
    assert.match(video.message, /no slideshow is presented/);
    assert.equal(video.buffer, undefined);
  });

  it('retries transient failures with bounded attempts', async () => {
    let attempts = 0;
    const result = await retryTransiently(async () => {
      attempts += 1;
      if (attempts < 3) throw new MediaProviderError('temporary', { retryable: true });
      return 'ready';
    }, { maxRetries: 2, sleep: async () => {} });
    assert.equal(result, 'ready');
    assert.equal(attempts, 3);
  });

  it('does not retry permanent failures or provider timeouts', async () => {
    let attempts = 0;
    await assert.rejects(retryTransiently(async () => {
      attempts += 1;
      throw new MediaProviderError('invalid key');
    }, { maxRetries: 4, sleep: async () => {} }));
    assert.equal(attempts, 1);
    await assert.rejects(withTimeout(new Promise(() => {}), 5, 'test provider'), /timed out/);
  });

  it('persists status, mode, prompt version, deduplication, storage and usage fields', async () => {
    const asset = new MediaAsset({
      mysteryId: savedCase._id,
      evidenceId: 'ev-1',
      mediaType: 'video',
      status: 'processing',
      mode: 'ai',
      provider: 'google',
      model: 'configured-video-model',
      promptVersion: 'case-evidence-v1',
      prompt: 'private worker prompt',
      dedupeKey: 'a'.repeat(64),
      usage: { generation: { totalTokens: 20 } },
    });
    await assert.doesNotReject(asset.validate());
    assert.equal(asset.status, 'processing');
    assert.equal(asset.mode, 'ai');
  });

  it('stores media outside MongoDB and rejects path traversal keys', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'mystery-media-test-'));
    try {
      const storage = new LocalMediaStorageProvider({ root });
      const saved = await storage.save('asset-1', 'image/png', Buffer.from('image')); 
      assert.equal(saved.storageKey, 'asset-1.png');
      assert.deepEqual(await storage.read(saved.storageKey), Buffer.from('image'));
      await assert.rejects(storage.read('../private.env'), /Invalid media storage key/);
      await storage.delete(saved.storageKey);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
