import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  // Required in Step 1
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5000),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  MONGODB_URI_TEST: z.string().optional(),

  // Required in Step 2: Auth
  JWT_ACCESS_SECRET: z.string().min(1, 'JWT_ACCESS_SECRET is required'),
  JWT_REFRESH_SECRET: z.string().min(1, 'JWT_REFRESH_SECRET is required'),
  GOOGLE_CLIENT_ID: z.string().optional(),
  // Step 3: AI & Credits
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_FLASH_MODEL: z.string().default('gemini-3.5-flash-lite'),
  GEMINI_PRO_MODEL: z.string().default('gemini-3.1-pro-preview'),
  GEMINI_EMBED_MODEL: z.string().default('gemini-embedding-001'),
  GEMINI_TTS_MODEL: z.string().default('gemini-3.8-flash-lite-tts'),
  CREDITS_PER_100_TOKENS: z.coerce.number().default(1),
  CREDIT_ENFORCEMENT_MODE: z
    .enum(['quota_free', 'credit_strict'])
    .default(process.env.NODE_ENV === 'test' ? 'credit_strict' : 'quota_free'),

  // Subsequent steps
  PINECONE_API_KEY: z.string().optional(),
  PINECONE_INDEX: z.string().optional(),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  STARTER_CREDITS: z.coerce.number().default(100),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().optional(),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Environment validation failed:');
  console.error(parsedEnv.error.format());
  process.exit(1);
}

export const env = parsedEnv.data;
