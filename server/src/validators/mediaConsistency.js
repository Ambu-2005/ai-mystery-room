import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { env } from '../config/env.js';
import { MediaProviderError } from '../providers/media/errors.js';
import { buildImageConsistencyPrompt } from '../providers/media/prompts.js';

const validationSchema = z.object({
  consistent: z.boolean(),
  contradictions: z.array(z.string().max(240)).max(8),
});

export async function validateImageAgainstCase({ mystery, evidence, buffer, mimeType, client: providedClient, model = env.GEMINI_MODEL }) {
  if (!env.MEDIA_VALIDATE_IMAGES && !providedClient) return { consistent: true, validator: 'disabled' };
  if (!providedClient && (!env.GEMINI_API_KEY || !model)) {
    throw new MediaProviderError('Image fact validation is not configured.', { code: 'MEDIA_VALIDATION_UNAVAILABLE' });
  }

  const client = providedClient ?? new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  try {
    const response = await client.models.generateContent({
      model,
      contents: [
        { text: buildImageConsistencyPrompt({ mystery, evidence }) },
        { inlineData: { mimeType, data: buffer.toString('base64') } },
      ],
      config: { responseMimeType: 'application/json' },
    });
    const text = response.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('').trim();
    const parsed = validationSchema.safeParse(JSON.parse(text ?? ''));
    if (!parsed.success) {
      throw new MediaProviderError('Image consistency validator returned invalid data.', { code: 'MEDIA_VALIDATION_INVALID' });
    }
    if (!parsed.data.consistent) {
      throw new MediaProviderError('Generated image conflicts with saved case facts.', { code: 'MEDIA_VALIDATION_FAILED' });
    }
    return {
      consistent: true,
      validator: model,
      usage: response.usageMetadata ? {
        promptTokens: response.usageMetadata.promptTokenCount,
        outputTokens: response.usageMetadata.candidatesTokenCount,
        totalTokens: response.usageMetadata.totalTokenCount,
      } : null,
    };
  } catch (error) {
    if (error instanceof MediaProviderError) throw error;
    const status = Number(error?.status ?? error?.code);
    throw new MediaProviderError('Image consistency validation failed.', {
      code: 'MEDIA_VALIDATION_FAILED',
      retryable: status === 408 || status === 429 || status >= 500,
      cause: error,
    });
  }
}
