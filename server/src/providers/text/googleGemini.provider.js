import { GoogleGenAI } from '@google/genai';
import { env } from '../../config/env.js';
import { buildMysteryPrompt, MYSTERY_SYSTEM_INSTRUCTION } from './mysteryPrompt.js';
import { TextGenerationProvider } from './interfaces.js';
import { geminiMysteryResponseSchema } from '../../validators/mystery.schema.js';

function safeProviderError(error) {
  const status = Number(error?.status ?? error?.code);
  if (status === 400 || status === 404) {
    return Object.assign(new Error('Gemini rejected the configured model or structured-output request. Check that the selected model supports JSON response schemas.'), {
      status: 503, code: 'GEMINI_MODEL_CONFIGURATION_ERROR', retryable: false, stage: 'provider_request',
    });
  }
  if (status === 401 || status === 403) {
    return Object.assign(new Error('Gemini credentials were rejected. Check GEMINI_API_KEY on the server.'), {
      status: 503, code: 'GEMINI_CONFIGURATION_ERROR', retryable: false, stage: 'provider_request',
    });
  }
  if (status === 429) {
    return Object.assign(new Error('Gemini is temporarily rate limited. Please try again shortly.'), {
      status: 503, code: 'GEMINI_RATE_LIMITED', retryable: true, stage: 'provider_request',
    });
  }
  if (status === 408 || status >= 500 || error?.name === 'AbortError' || error?.name === 'TimeoutError'
    || ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'EAI_AGAIN'].includes(error?.code)) {
    return Object.assign(new Error('Gemini is temporarily unavailable. Please try again.'), {
      status: 503, code: 'GEMINI_UNAVAILABLE', retryable: true, stage: 'provider_request',
    });
  }
  return Object.assign(new Error('Gemini could not generate a valid mystery. Please try again.'), {
    status: 502, code: 'GEMINI_GENERATION_FAILED', retryable: false, stage: 'provider_request',
  });
}

function responseError(message, { code, retryable, model, finishReason, responseId } = {}) {
  return Object.assign(new Error(message), {
    status: 502,
    code,
    retryable,
    stage: 'response_parse',
    model,
    finishReason,
    responseId,
  });
}

export class GoogleGeminiTextProvider extends TextGenerationProvider {
  constructor({ client, apiKey = env.GEMINI_API_KEY, model = env.GEMINI_MODEL, timeoutMs = env.GEMINI_TIMEOUT_MS } = {}) {
    super();
    this.model = model;
    this.timeoutMs = timeoutMs;
    this.client = client ?? (apiKey ? new GoogleGenAI({ apiKey, httpOptions: { timeout: timeoutMs } }) : null);
  }

  async generateMystery({ brief, validationFeedback = [] }) {
    if (!this.client || !this.model) {
      const error = new Error('Mystery generation is not configured. Set GEMINI_API_KEY and GEMINI_MODEL in the server environment.');
      error.status = 503;
      error.code = 'GEMINI_NOT_CONFIGURED';
      error.retryable = false;
      error.stage = 'configuration';
      throw error;
    }
    const startedAt = Date.now();
    try {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: buildMysteryPrompt(brief, validationFeedback),
        config: {
          systemInstruction: MYSTERY_SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: geminiMysteryResponseSchema,
          temperature: 0.65,
          maxOutputTokens: 16384,
        },
      });

      const model = response?.modelVersion || this.model;
      const candidate = response?.candidates?.[0];
      const finishReason = candidate?.finishReason;
      const responseId = response?.responseId;
      const blockReason = response?.promptFeedback?.blockReason;
      if (blockReason || ['SAFETY', 'RECITATION', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'SPII'].includes(finishReason)) {
        throw responseError('Gemini could not return this mystery because the response was blocked.', {
          code: 'GEMINI_RESPONSE_BLOCKED', retryable: false, model, finishReason: finishReason ?? blockReason, responseId,
        });
      }

      if (finishReason === 'MAX_TOKENS') {
        throw responseError('Gemini reached its output limit before completing the mystery. Please retry.', {
          code: 'GEMINI_OUTPUT_TRUNCATED', retryable: true, model, finishReason, responseId,
        });
      }

      let text;
      try {
        // The official SDK exposes generated candidate text through this documented getter.
        text = response?.text;
      } catch {
        throw responseError('Gemini returned an unreadable structured response.', {
          code: 'GEMINI_RESPONSE_INVALID', retryable: true, model, finishReason, responseId,
        });
      }
      if (typeof text !== 'string' || text.trim().length === 0) {
        throw responseError('Gemini returned no structured mystery.', {
          code: 'GEMINI_EMPTY_RESPONSE', retryable: true, model, finishReason, responseId,
        });
      }

      let mystery;
      try {
        mystery = JSON.parse(text);
      } catch {
        throw responseError('Gemini returned malformed structured output.', {
          code: 'GEMINI_INVALID_JSON', retryable: true, model, finishReason, responseId,
        });
      }
      return {
        mystery,
        provider: 'google',
        model,
        durationMs: Date.now() - startedAt,
        usage: response.usageMetadata ? {
          promptTokens: response.usageMetadata.promptTokenCount ?? null,
          outputTokens: response.usageMetadata.candidatesTokenCount ?? null,
          totalTokens: response.usageMetadata.totalTokenCount ?? null,
        } : null,
      };
    } catch (error) {
      if (error?.retryable !== undefined) throw error;
      const providerError = safeProviderError(error);
      providerError.model = this.model;
      throw providerError;
    }
  }
}
