export class MediaStorageProvider {
  async save() { throw new Error('MediaStorageProvider.save must be implemented.'); }
  async read() { throw new Error('MediaStorageProvider.read must be implemented.'); }
  async delete() { throw new Error('MediaStorageProvider.delete must be implemented.'); }
}
