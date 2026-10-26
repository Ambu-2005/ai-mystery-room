import assert from 'node:assert/strict';
import { test } from 'node:test';
import { env } from '../src/config/env.js';
import { GoogleImageGenerationProvider } from '../src/providers/media/googleImage.provider.js';
import { GoogleVideoGenerationProvider } from '../src/providers/media/googleVideo.provider.js';

const optIn = process.env.RUN_MEDIA_PROVIDER_INTEGRATION === 'true';

test('Google image provider generates a real image (opt-in, provider charges may apply)', {
  skip: !optIn || env.IMAGE_PROVIDER !== 'google' || !env.IMAGE_API_KEY,
}, async () => {
  const output = await new GoogleImageGenerationProvider().generate({
    prompt: 'A fictional, clearly staged detective evidence photograph of a brass key on a desk. No people, text, or logos.',
  });
  assert.ok(output.buffer.length > 0);
  assert.match(output.mimeType, /^image\//);
});

test('Google video provider generates a real video (opt-in, provider charges may apply)', {
  skip: !optIn || env.VIDEO_PROVIDER !== 'google' || !env.VIDEO_API_KEY,
}, async () => {
  const output = await new GoogleVideoGenerationProvider().generate({
    prompt: `A fictional, clearly staged fixed CCTV shot of a brass key on a desk. One continuous shot, no people, no readable text. No longer than ${env.VIDEO_MAX_DURATION_SECONDS} seconds.`,
  });
  assert.ok(output.buffer.length > 0);
  assert.equal(output.mimeType, 'video/mp4');
});
