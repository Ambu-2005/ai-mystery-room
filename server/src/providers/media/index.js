import { env } from '../../config/env.js';
import { GoogleImageGenerationProvider } from './googleImage.provider.js';
import { GoogleVideoGenerationProvider } from './googleVideo.provider.js';
import { MockImageGenerationProvider } from './mockImage.provider.js';
import { SimulatedVideoProvider } from './simulatedVideo.provider.js';

export function createImageGenerationProvider() {
  return env.IMAGE_PROVIDER === 'google'
    ? new GoogleImageGenerationProvider()
    : new MockImageGenerationProvider();
}

export function createVideoGenerationProvider() {
  if (env.VIDEO_PROVIDER === 'google') return new GoogleVideoGenerationProvider();
  if (env.VIDEO_PROVIDER === 'disabled') return null;
  return new SimulatedVideoProvider();
}
