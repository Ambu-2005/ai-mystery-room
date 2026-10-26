import { VideoGenerationProvider } from './interfaces.js';

export class SimulatedVideoProvider extends VideoGenerationProvider {
  constructor() { super(); }

  name = 'simulation';
  model = null;

  async generate() {
    return {
      unavailable: true,
      mode: 'simulated',
      message: 'Real video generation is not configured. This CCTV evidence is unavailable; no slideshow is presented as a generated video.',
    };
  }
}
