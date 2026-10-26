import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../../config/env.js';
import { MediaStorageProvider } from './storage.interface.js';

const extensions = new Map([
  ['image/png', '.png'],
  ['image/jpeg', '.jpg'],
  ['image/webp', '.webp'],
  ['image/svg+xml', '.svg'],
  ['video/mp4', '.mp4'],
  ['video/webm', '.webm'],
]);

export class LocalMediaStorageProvider extends MediaStorageProvider {
  constructor({ root = path.resolve(process.cwd(), env.MEDIA_STORAGE_DIR) } = {}) {
    super();
    this.root = root;
    this.name = 'local';
  }

  async save(assetId, mimeType, buffer) {
    const extension = extensions.get(mimeType);
    if (!extension) throw new TypeError(`Unsupported media MIME type: ${mimeType}`);
    if (!Buffer.isBuffer(buffer) || buffer.byteLength > env.MEDIA_MAX_ASSET_BYTES) {
      throw new RangeError('Generated media exceeds the configured storage limit.');
    }
    await mkdir(this.root, { recursive: true });
    const storageKey = `${assetId}${extension}`;
    await writeFile(path.join(this.root, storageKey), buffer, { flag: 'wx' });
    return { storageKey, sizeBytes: buffer.byteLength };
  }

  async read(storageKey) {
    if (typeof storageKey !== 'string' || path.basename(storageKey) !== storageKey) {
      throw new TypeError('Invalid media storage key.');
    }
    return readFile(path.join(this.root, storageKey));
  }

  async delete(storageKey) {
    if (typeof storageKey !== 'string' || path.basename(storageKey) !== storageKey) return;
    await rm(path.join(this.root, storageKey), { force: true });
  }
}
