import { setTimeout as delay } from 'node:timers/promises';

export class MediaProviderError extends Error {
  constructor(message, { code = 'MEDIA_PROVIDER_ERROR', retryable = false, cause } = {}) {
    super(message, { cause });
    this.name = 'MediaProviderError';
    this.code = code;
    this.retryable = retryable;
  }
}

export async function retryTransiently(operation, { maxRetries, onRetry = async () => {}, sleep = delay } = {}) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      if (attempt >= maxRetries || !isRetryableProviderError(error)) {
        error.retryCount = attempt;
        throw error;
      }
      await onRetry(attempt + 1, error);
      await sleep(Math.min(1000 * (2 ** attempt), 8000));
    }
  }
}

export function isRetryableProviderError(error) {
  return error?.retryable === true;
}

export function withTimeout(promise, timeoutMs, label = 'Media provider') {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new MediaProviderError(`${label} timed out.`, {
      code: 'MEDIA_PROVIDER_TIMEOUT',
    })), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
