import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';

if (!process.env.GEMINI_API_KEY) {
  console.error('GEMINI_API_KEY is missing from server/.env');
  process.exit(1);
}

const model = 'gemini-3.6-flash';

const client = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: { timeout: 180000 },
});

try {
  const response = await client.models.generateContent({
    model,
    contents: 'Reply with exactly: OK',
    config: {
      maxOutputTokens: 512,
      thinkingConfig: {
        thinkingLevel: 'low',
      },
    },
  });

  console.log('Gemini test succeeded.');
  console.log('Model:', response.modelVersion || model);
  console.log('Response:', response.text ?? '(no text returned)');
  console.log(
    'Finish reason:',
    response.candidates?.[0]?.finishReason ?? 'unknown'
  );
} catch (error) {
  console.error('Gemini test failed.');
  console.error('Status:', error.status ?? 'unknown');
  console.error('Code:', error.code ?? 'unknown');
  console.error(
    'Message:',
    String(error.message ?? error).slice(0, 500)
  );
  process.exitCode = 1;
}