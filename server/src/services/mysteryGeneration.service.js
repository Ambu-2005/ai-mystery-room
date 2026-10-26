import { randomUUID } from 'node:crypto';
import { env } from '../config/env.js';
import { MYSTERY_PROMPT_VERSION } from '../providers/text/mysteryPrompt.js';
import { GoogleGeminiTextProvider } from '../providers/text/googleGemini.provider.js';
import { MongoMysteryRepository } from '../repositories/mystery.repository.js';
import { validateGeneratedMystery } from '../validators/mystery.schema.js';

export class MysteryGenerationError extends Error {
  constructor(message, { status = 500, code = 'MYSTERY_GENERATION_FAILED', retryable = false, requestId } = {}) {
    super(message);
    this.name = 'MysteryGenerationError';
    this.status = status;
    this.code = code;
    this.retryable = retryable;
    if (requestId) this.requestId = requestId;
  }
}

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export function createMysteryGenerationService({
  provider = new GoogleGeminiTextProvider(),
  repository = new MongoMysteryRepository(),
  maxRetries = env.GEMINI_MAX_RETRIES,
  sleep = wait,
  logger = console,
} = {}) {
  const retryLimit = Math.min(1, Math.max(0, Number(maxRetries) || 0));
  return {
    async generateAndSave({ brief, ownerId }) {
      const requestId = randomUUID();
      let generated;
      let retryCount = 0;
      let lastValidationError;
      let validationFeedback = [];
      for (let attempt = 0; attempt <= retryLimit; attempt += 1) {
        try {
          generated = await provider.generateMystery({ brief, validationFeedback });
        } catch (error) {
          const stage = error.stage ?? 'provider_request';
          logger.warn?.('Mystery generation provider failure', {
            requestId,
            attempt: attempt + 1,
            stage,
            errorCode: error.code ?? 'GEMINI_GENERATION_FAILED',
            status: Number.isInteger(error.status) ? error.status : undefined,
            model: typeof error.model === 'string' ? error.model.slice(0, 120) : undefined,
            finishReason: typeof error.finishReason === 'string' ? error.finishReason : undefined,
            providerResponseId: typeof error.responseId === 'string' ? error.responseId.slice(0, 160) : undefined,
          });
          if (error.retryable && attempt < retryLimit) {
            retryCount += 1;
            if (stage === 'response_parse') {
              validationFeedback = [{
                code: error.code ?? 'GEMINI_INVALID_RESPONSE',
                path: '$',
                rule: error.code === 'GEMINI_OUTPUT_TRUNCATED'
                  ? 'Return the complete response within the output budget. Keep each field concise while preserving all required case facts and links.'
                  : 'Return one complete JSON value matching the response schema. Do not add markdown fences or surrounding prose.',
              }];
            }
            await sleep(300 * (2 ** attempt));
            continue;
          }
          throw new MysteryGenerationError(error.message || 'Gemini could not generate this case. Please try again.', {
            status: error.status ?? 503,
            code: error.code ?? 'GEMINI_GENERATION_FAILED',
            retryable: Boolean(error.retryable),
            requestId,
          });
        }

        try {
          generated = { ...generated, mystery: validateGeneratedMystery(generated.mystery, brief) };
          lastValidationError = undefined;
          break;
        } catch (error) {
          const stage = ['schema', 'consistency'].includes(error.stage) ? error.stage : 'validation_internal';
          const diagnostics = Array.isArray(error.diagnostics) ? error.diagnostics : [];
          logger.warn?.('Mystery generation validation failure', {
            requestId,
            attempt: attempt + 1,
            stage,
            errorCode: error.code ?? (stage === 'schema' ? 'CASE_SCHEMA_INVALID' : 'CASE_CONSISTENCY_FAILED'),
            model: typeof generated?.model === 'string' ? generated.model.slice(0, 120) : undefined,
            issueCount: diagnostics.length,
            issues: diagnostics,
          });
          if (stage === 'validation_internal') {
            throw new MysteryGenerationError('The generated case could not be validated. No case was saved.', {
              status: 500,
              code: 'MYSTERY_VALIDATION_INTERNAL_ERROR',
              retryable: false,
              requestId,
            });
          }
          lastValidationError = error;
          validationFeedback = diagnostics.map(({ code, path, rule }) => ({ code, path, ...(rule ? { rule } : {}) }));
          if (attempt < retryLimit) {
            retryCount += 1;
            await sleep(300 * (2 ** attempt));
            continue;
          }
        }
      }

      if (lastValidationError || !generated?.mystery) {
        const schemaFailure = lastValidationError?.stage === 'schema';
        throw new MysteryGenerationError(
          schemaFailure
            ? 'Gemini returned a case with missing or incorrectly formatted fields. No case was saved; please retry.'
            : 'The generated case had inconsistent clues or references. No case was saved; please retry.',
          {
          status: 502,
          code: schemaFailure ? 'GENERATED_CASE_SCHEMA_INVALID' : 'GENERATED_CASE_INCONSISTENT',
          retryable: true,
          requestId,
        });
      }

      const { solution, ...publicOutput } = generated.mystery;
      const facts = {
        ...publicOutput,
        title: brief.title || generated.mystery.title,
        scenario: brief.scenario,
        genre: brief.genre,
        difficulty: brief.difficulty,
        evidenceRichness: brief.evidenceRichness,
        contentRating: brief.contentRating,
        preferredSetting: brief.preferredSetting,
        language: brief.language,
      };
      try {
        return await repository.savePlayableMystery({
          ownerId,
          facts,
          solution,
          generationMetadata: {
            provider: generated.provider,
            model: generated.model,
            durationMs: generated.durationMs,
            usage: generated.usage,
            retryCount,
          },
          promptVersion: MYSTERY_PROMPT_VERSION,
        });
      } catch (error) {
        logger.error?.('Mystery generation persistence failure', {
          requestId,
          stage: 'persistence',
          errorName: error?.name ?? 'Error',
          errorCode: typeof error?.code === 'string' || typeof error?.code === 'number' ? error.code : 'DATABASE_WRITE_FAILED',
        });
        throw new MysteryGenerationError('The case passed validation but could not be saved. Check MongoDB connectivity and try again.', {
          status: 503,
          code: 'MYSTERY_SAVE_FAILED',
          retryable: true,
          requestId,
        });
      }
    },
  };
}
