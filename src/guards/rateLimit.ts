import type { ChatInputCommandInteraction } from 'discord.js';
import { RATE_LIMITS } from '../config/constants.js';

interface RateLimitEntry {
  timestamps: number[];
}

// In-memory rate limit store (per user per command type)
const rateLimitStore = new Map<string, RateLimitEntry>();

type RateLimitType = keyof typeof RATE_LIMITS;

/**
 * Check if a user is rate limited
 */
export function isRateLimited(
  userId: string,
  type: RateLimitType
): { limited: boolean; retryAfterMs?: number } {
  const config = RATE_LIMITS[type];
  const key = `${userId}:${type}`;
  const now = Date.now();

  let entry = rateLimitStore.get(key);

  if (!entry) {
    entry = { timestamps: [] };
    rateLimitStore.set(key, entry);
  }

  // Filter out expired timestamps
  entry.timestamps = entry.timestamps.filter(
    (ts) => now - ts < config.windowMs
  );

  // Check if rate limited
  if (entry.timestamps.length >= config.maxRequests) {
    const oldestTimestamp = entry.timestamps[0];
    const retryAfterMs = oldestTimestamp
      ? config.windowMs - (now - oldestTimestamp)
      : config.windowMs;
    return { limited: true, retryAfterMs };
  }

  // Add current timestamp
  entry.timestamps.push(now);

  return { limited: false };
}

/**
 * Middleware to check rate limits and reply with error if limited
 */
export async function checkRateLimit(
  interaction: ChatInputCommandInteraction,
  type: RateLimitType
): Promise<boolean> {
  const { limited, retryAfterMs } = isRateLimited(interaction.user.id, type);

  if (limited) {
    const retryAfterSeconds = Math.ceil((retryAfterMs ?? 0) / 1000);
    await interaction.reply({
      content: `⏳ You're sending requests too fast. Please wait ${retryAfterSeconds} second${retryAfterSeconds === 1 ? '' : 's'} before trying again.`,
      ephemeral: true,
    });
    return false;
  }

  return true;
}

/**
 * Clean up old rate limit entries (call periodically)
 */
export function cleanupRateLimits(): void {
  const now = Date.now();
  const maxWindowMs = Math.max(
    RATE_LIMITS.CHAT.windowMs,
    RATE_LIMITS.SEARCH.windowMs,
    RATE_LIMITS.TOOLS.windowMs
  );

  for (const [key, entry] of rateLimitStore.entries()) {
    entry.timestamps = entry.timestamps.filter(
      (ts) => now - ts < maxWindowMs
    );
    if (entry.timestamps.length === 0) {
      rateLimitStore.delete(key);
    }
  }
}

// Clean up every minute
setInterval(cleanupRateLimits, 60_000);

export default checkRateLimit;
