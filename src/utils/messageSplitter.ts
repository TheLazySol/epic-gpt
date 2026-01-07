import { DISCORD } from '../config/constants.js';

/**
 * Split a long message into chunks that fit within Discord's message limit
 */
export function splitMessage(
  content: string,
  maxLength: number = DISCORD.MAX_MESSAGE_LENGTH
): string[] {
  if (content.length <= maxLength) {
    return [content];
  }

  const chunks: string[] = [];
  let remaining = content;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    // Find a good break point
    let breakPoint = maxLength;

    // Try to break at a newline
    const lastNewline = remaining.lastIndexOf('\n', maxLength);
    if (lastNewline > maxLength * 0.5) {
      breakPoint = lastNewline + 1;
    } else {
      // Try to break at a space
      const lastSpace = remaining.lastIndexOf(' ', maxLength);
      if (lastSpace > maxLength * 0.5) {
        breakPoint = lastSpace + 1;
      }
    }

    chunks.push(remaining.slice(0, breakPoint));
    remaining = remaining.slice(breakPoint);
  }

  return chunks;
}

/**
 * Send a potentially long message as multiple messages
 */
export async function sendLongMessage(
  reply: (content: string) => Promise<unknown>,
  followUp: (content: string) => Promise<unknown>,
  content: string
): Promise<void> {
  const chunks = splitMessage(content);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (!chunk) continue;
    
    if (i === 0) {
      await reply(chunk);
    } else {
      await followUp(chunk);
    }
  }
}

export default splitMessage;
