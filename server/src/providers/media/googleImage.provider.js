import { GoogleGenAI } from '@google/genai';
import { env } from '../../config/env.js';
import { MediaProviderError } from './errors.js';
import { ImageGenerationProvider } from './interfaces.js';

function retryable(error) {
  const status = Number(error?.status ?? error?.code);
  return status === 408 || status === 429 || status >= 500;
}

export class GoogleImageGenerationProvider extends ImageGenerationProvider {
  constructor({ client, model = env.IMAGE_MODEL } = {}) {
    super();
    this.client = client ?? new GoogleGenAI({
      apiKey: env.IMAGE_API_KEY || env.GEMINI_API_KEY,
      httpOptions: { timeout: env.MEDIA_PROVIDER_TIMEOUT_MS },
    });
    this.name = 'google';
    this.model = model;
  }

  async generate({ prompt }) {
    try {
      // Use the current Interactions API image response format for Nano Banana models.
      const interaction = await this.client.interactions.create({
        model: this.model,
        input: prompt,
        response_format: {
          type: 'image',
          mime_type: 'image/png',
          aspect_ratio: '4:3',
          image_size: env.IMAGE_RESOLUTION,
        },
      });
      const image = interaction.output_image;
      if (!image?.data) {
        throw new MediaProviderError('Image provider returned no image data.', { code: 'MEDIA_OUTPUT_MISSING' });
      }
      const buffer = Buffer.from(image.data, 'base64');
      if (!buffer.length) {
        throw new MediaProviderError('Image provider returned an empty image.', { code: 'MEDIA_OUTPUT_MISSING' });
      }
      return {
        buffer,
        mimeType: image.mime_type ?? 'image/png',
        usage: interaction.usage ?? null,
        costUsd: null,
      };
    } catch (error) {
      if (error instanceof MediaProviderError) throw error;
      throw new MediaProviderError('Google image generation failed. Check the media model, API key, and account access.', {
        code: 'IMAGE_PROVIDER_FAILED', retryable: retryable(error), cause: error,
      });
    }
  }
}
