import type { ChatInputCommandInteraction } from 'discord.js';

/**
 * Log error with context and return a user-friendly message
 */
export function handleError(
  error: unknown,
  context: {
    command: string;
    userId: string;
    guildId?: string;
  }
): string {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  // Log detailed error for admins/developers
  console.error('❌ Error occurred:', {
    ...context,
    error: errorMessage,
    stack: errorStack,
    timestamp: new Date().toISOString(),
  });

  // Return generic message for users
  return 'Sorry, something went wrong. Please try again later.';
}

/**
 * Reply with error message, handling already replied/deferred interactions
 */
export async function replyWithError(
  interaction: ChatInputCommandInteraction,
  error: unknown,
  context: { command: string }
): Promise<void> {
  const userMessage = handleError(error, {
    command: context.command,
    userId: interaction.user.id,
    guildId: interaction.guildId ?? undefined,
  });

  const content = `❌ ${userMessage}`;

  try {
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content, ephemeral: true });
    } else {
      await interaction.reply({ content, ephemeral: true });
    }
  } catch (replyError) {
    console.error('Failed to send error reply:', replyError);
  }
}

export default handleError;
