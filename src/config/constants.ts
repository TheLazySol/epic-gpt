// Command names
export const COMMANDS = {
  CHAT: 'chat',
  SEARCH: 'search',
  HELP: 'help',
  KB_ADD_FILE: 'kb_add_file',
  KB_ADD_URL: 'kb_add_url',
  KB_LIST: 'kb_list',
  KB_REMOVE: 'kb_remove',
  KB_REFRESH: 'kb_refresh',
} as const;

// Rate limiting (lenient settings)
export const RATE_LIMITS = {
  CHAT: {
    maxRequests: 10,
    windowMs: 10_000, // 10 seconds
  },
  SEARCH: {
    maxRequests: 10,
    windowMs: 10_000, // 10 seconds
  },
  TOOLS: {
    maxRequests: 30,
    windowMs: 60_000, // 1 minute
  },
} as const;

// Session settings
export const SESSION = {
  TTL_MS: 60 * 60 * 1000, // 1 hour
  MAX_MESSAGES: 10, // Last 10 messages in context
} as const;

// Discord limits
export const DISCORD = {
  MAX_MESSAGE_LENGTH: 2000,
  MAX_EMBED_DESCRIPTION: 4096,
} as const;

// OpenAI settings
// OpenAI (LLM & Embedding) configuration constants
export const OPENAI = {
  // Main chat model for completions (default, fast & concise)
  MODEL: 'gpt-5-mini', // Main chat model for completions (default, fast & concise)
  ASSISTANT_MODEL: 'gpt-4.1-2025-04-14', // Assistant model for knowledge base search
  MAX_TOKENS: 2048, // Maximum tokens to generate per response (Reduced for faster, more concise responses)
  TEMPERATURE: 1,// Sampling temperature for creative/strictness balance
  CHUNK_SIZE: 1000, // Number of tokens per chunk for KB/document splitting
  CHUNK_OVERLAP: 200, // Token overlap between chunks for document splitting
  PROMPT_CACHE_RETENTION: '24h' as const, // Retention duration for cached prompts (for improved cache hit rates)
} as const;

// Web search settings
export const WEB_SEARCH = {
  MAX_RESULTS: 5,
} as const;

// Knowledge base settings
export const KB = {
  SUPPORTED_FILE_TYPES: ['.pdf', '.md', '.txt', '.docx'],
  MAX_FILE_SIZE_MB: 25,
  MIN_CONTENT_LENGTH: 100, // Minimum chars for cheerio before Playwright fallback
} as const;

// Bot branding
export const BOT = {
  NAME: 'EpicGPT',
  COLOR: 0x7c3aed, // Purple
  FOOTER: 'Powered by Epicentral Labs',
} as const;
