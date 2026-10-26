import { ImageGenerationProvider } from './interfaces.js';

export class MockImageGenerationProvider extends ImageGenerationProvider {
  constructor() { super(); }

  name = 'mock';
  model = 'labeled-svg-fixture';

  async generate({ prompt }) {
    const safePrompt = prompt.replace(/[<>&"']/g, '').slice(0, 110);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="768" viewBox="0 0 1024 768"><rect width="1024" height="768" fill="#151a20"/><path d="M0 570 250 330l160 160 220-260 394 340v198H0Z" fill="#252d34"/><circle cx="790" cy="200" r="54" fill="#bd9b5e" opacity=".8"/><text x="512" y="650" text-anchor="middle" fill="#e9e2d1" font-family="sans-serif" font-size="34">MOCK EVIDENCE — NOT AI GENERATED</text><text x="512" y="705" text-anchor="middle" fill="#aaa" font-family="sans-serif" font-size="16">${safePrompt}</text></svg>`;
    return { buffer: Buffer.from(svg), mimeType: 'image/svg+xml', usage: null, costUsd: 0 };
  }
}
