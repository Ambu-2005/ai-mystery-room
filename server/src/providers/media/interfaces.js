export class ImageGenerationProvider {
  constructor() { this.mediaType = 'image'; }

  async generate() {
    throw new Error('ImageGenerationProvider.generate must be implemented.');
  }
}

export class VideoGenerationProvider {
  constructor() { this.mediaType = 'video'; }

  async generate() {
    throw new Error('VideoGenerationProvider.generate must be implemented.');
  }
}
