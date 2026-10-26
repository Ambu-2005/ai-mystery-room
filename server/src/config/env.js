import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  GEMINI_API_KEY: z.string().optional().default(''),
  GEMINI_MODEL: z.string().optional().default(''),
  GEMINI_TIMEOUT_MS: z.coerce.number().int().min(5000).max(300000).default(120000),
  GEMINI_MAX_RETRIES: z.coerce.number().int().min(0).max(1).default(1),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must contain at least 32 characters'),
  COOKIE_NAME: z.string().min(1).default('mystery_session'),
  IMAGE_PROVIDER: z.enum(['mock', 'google']).default('mock'),
  IMAGE_API_KEY: z.string().optional().default(''),
  IMAGE_MODEL: z.string().min(1).default('gemini-nano-banana-2.1'),
  IMAGE_RESOLUTION: z.enum(['512', '1K', '2K', '4K']).default('1K'),
  VIDEO_PROVIDER: z.enum(['simulation', 'google', 'disabled']).default('simulation'),
  VIDEO_API_KEY: z.string().optional().default(''),
  VIDEO_MODEL: z.string().min(1).default('gemini-omni-1.1-flash'),
  VIDEO_RESOLUTION: z.enum(['360p', '720p', '1080p', '4k']).default('720p'),
  VIDEO_MAX_DURATION_SECONDS: z.coerce.number().int().min(3).max(10).default(8),
  MEDIA_STORAGE_PROVIDER: z.enum(['local']).default('local'),
  MEDIA_STORAGE_DIR: z.string().default('./storage/media'),
  MEDIA_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
  MEDIA_PROVIDER_TIMEOUT_MS: z.coerce.number().int().min(1000).max(900000).default(600000),
  MEDIA_MAX_ASSET_BYTES: z.coerce.number().int().min(1024).max(524288000).default(52428800),
  MEDIA_MAX_IMAGES_PER_MYSTERY: z.coerce.number().int().min(1).max(20).default(3),
  MEDIA_VALIDATE_IMAGES: z.stringbool().default(true),
}).superRefine((value, ctx) => {
  if (value.IMAGE_PROVIDER === 'google' && !value.IMAGE_API_KEY && !value.GEMINI_API_KEY) {
    ctx.addIssue({ code: 'custom', path: ['IMAGE_API_KEY'], message: 'Set IMAGE_API_KEY or GEMINI_API_KEY when IMAGE_PROVIDER=google' });
  }
  if (value.IMAGE_PROVIDER === 'google' && value.MEDIA_VALIDATE_IMAGES && (!value.GEMINI_API_KEY || !value.GEMINI_MODEL)) {
    ctx.addIssue({ code: 'custom', path: ['GEMINI_API_KEY'], message: 'GEMINI_API_KEY and GEMINI_MODEL are required for image fact validation' });
  }
  if (value.VIDEO_PROVIDER === 'google' && !value.VIDEO_API_KEY && !value.GEMINI_API_KEY) {
    ctx.addIssue({ code: 'custom', path: ['VIDEO_API_KEY'], message: 'Set VIDEO_API_KEY or GEMINI_API_KEY when VIDEO_PROVIDER=google' });
  }
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  const details = result.error.issues.map(({ path, message }) => `${path.join('.')}: ${message}`).join('\n');
  throw new Error(`Invalid server environment configuration:\n${details}`);
}

export const env = Object.freeze(result.data);
