import { env } from '../config/env.js';
import { LocalMediaStorageProvider } from '../providers/media/localStorage.provider.js';

export function createMediaStorageProvider() {
  if (env.MEDIA_STORAGE_PROVIDER === 'local') return new LocalMediaStorageProvider();
  throw new Error(`Unsupported media storage provider: ${env.MEDIA_STORAGE_PROVIDER}`);
}

const storage = createMediaStorageProvider();

export const saveMediaFile = (...args) => storage.save(...args);
export const readMediaFile = (...args) => storage.read(...args);
export const deleteMediaFile = (...args) => storage.delete(...args);
