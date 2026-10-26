import { GoogleGenAI } from '@google/genai';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { env } from '../../config/env.js';
import { MediaProviderError } from './errors.js';
import { VideoGenerationProvider } from './interfaces.js';

function retryable(error) {
  const status = Number(error?.status ?? error?.code);
  return status === 408 || status === 429 || status >= 500;
}

export class GoogleVideoGenerationProvider extends VideoGenerationProvider {
  constructor({ client, model = env.VIDEO_MODEL, pollIntervalMs = 5000, timeoutMs = env.MEDIA_PROVIDER_TIMEOUT_MS } = {}) {
    super();
    this.client = client ?? new GoogleGenAI({
      apiKey: env.VIDEO_API_KEY || env.GEMINI_API_KEY,
      httpOptions: { timeout: env.MEDIA_PROVIDER_TIMEOUT_MS },
    });
    this.name = 'google';
    this.model = model;
    this.pollIntervalMs = pollIntervalMs;
    this.timeoutMs = timeoutMs;
  }

  async generate({ prompt }) {
    try {
      const interaction = await this.client.interactions.create({
        model: this.model,
        input: prompt,
        response_format: {
          type: 'video',
          delivery: 'uri',
          resolution: env.VIDEO_RESOLUTION,
          aspect_ratio: '16:9',
        },
      });
      const output = interaction.output_video;
      if (!output?.data && !output?.uri) {
        throw new MediaProviderError('Google video generation returned no video data.', {
          code: 'MEDIA_OUTPUT_MISSING',
        });
      }
      const buffer = output.data
        ? Buffer.from(output.data, 'base64')
        : await this.#downloadVideo(output);
      if (!buffer.length) {
        throw new MediaProviderError('Google video generation returned an empty video.', {
          code: 'MEDIA_OUTPUT_MISSING',
        });
      }
      return {
        buffer,
        mimeType: output.mime_type ?? 'video/mp4',
        durationSeconds: null,
        usage: interaction.usage ?? null,
        costUsd: null,
      };
    } catch (error) {
      if (error instanceof MediaProviderError) throw error;
      throw new MediaProviderError('Google video generation failed. Check the media model, API key, and account access.', {
        code: 'VIDEO_PROVIDER_FAILED',
        retryable: retryable(error),
        cause: error,
      });
    }
  }

  async #downloadVideo(output) {
    let uri;
    try {
      uri = new URL(output.uri);
    } catch {
      throw new MediaProviderError('Google video generation returned an invalid download URI.', {
        code: 'MEDIA_OUTPUT_MISSING',
      });
    }
    const fileId = uri.pathname.match(/\/files\/([a-zA-Z0-9_-]+)/)?.[1];
    if (uri.protocol !== 'https:' || uri.hostname !== 'generativelanguage.googleapis.com' || !fileId) {
      throw new MediaProviderError('Google video generation returned an unsupported download URI.', {
        code: 'MEDIA_OUTPUT_MISSING',
      });
    }

    const deadline = Date.now() + this.timeoutMs;
    while (true) {
      const file = await this.client.files.get({ name: `files/${fileId}` });
      const state = String(file.state?.name ?? file.state ?? '').toUpperCase();
      if (state === 'ACTIVE') break;
      if (state === 'FAILED') {
        throw new MediaProviderError('Google video processing failed.', {
          code: 'MEDIA_OUTPUT_MISSING',
        });
      }
      const remainingMs = deadline - Date.now();
      if (remainingMs <= 0) {
        throw new MediaProviderError('Google video processing timed out.', {
          code: 'MEDIA_PROVIDER_TIMEOUT',
          retryable: true,
        });
      }
      await delay(Math.min(this.pollIntervalMs, remainingMs));
    }

    const directory = await mkdtemp(path.join(os.tmpdir(), 'mystery-video-'));
    const downloadPath = path.join(directory, 'evidence.mp4');
    try {
      await this.client.files.download({ file: output, downloadPath });
      return await readFile(downloadPath);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
}
