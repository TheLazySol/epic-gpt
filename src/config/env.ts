import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  // Discord
  DISCORD_TOKEN: z.string().min(1, 'DISCORD_TOKEN is required'),
  DISCORD_CLIENT_ID: z.string().min(1, 'DISCORD_CLIENT_ID is required'),

  // OpenAI
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required'),

  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Web Search
  SERPER_API_KEY: z.string().min(1, 'SERPER_API_KEY is required'),

  // Solana
  SOLANA_RPC_URL: z.string().url().default('https://api.mainnet-beta.solana.com'),

  // Birdeye
  BIRDEYE_API_KEY: z.string().min(1, 'BIRDEYE_API_KEY is required'),

  // Optional
  ADMIN_ROLE_ID: z.string().optional(),
  NODE_ENV: z.enum(['development', 'production']).default('development'),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ Invalid environment variables:');
    for (const issue of result.error.issues) {
      console.error(`   ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
  }

  return result.data;
}

export const env = validateEnv();
