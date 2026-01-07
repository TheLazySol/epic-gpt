import OpenAI from 'openai';
import { env } from '../config/env.js';

// OpenAI client singleton
const globalForOpenAI = globalThis as unknown as {
  openai: OpenAI | undefined;
};

export const openai =
  globalForOpenAI.openai ??
  new OpenAI({
    apiKey: env.OPENAI_API_KEY,
  });

if (process.env.NODE_ENV !== 'production') {
  globalForOpenAI.openai = openai;
}

export default openai;
