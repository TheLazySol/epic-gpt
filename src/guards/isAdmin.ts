import type { ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { PermissionFlagsBits } from 'discord.js';
import { env } from '../config/env.js';

/**
 * Check if a user has admin permissions
 * Uses "Manage Guild" permission by default, or ADMIN_ROLE_ID if set
 */
export function isAdmin(interaction: ChatInputCommandInteraction): boolean {
  const member = interaction.member as GuildMember | null;

  if (!member) {
    return false;
  }

  // Check for ADMIN_ROLE_ID if configured
  if (env.ADMIN_ROLE_ID) {
    if (member.roles.cache.has(env.ADMIN_ROLE_ID)) {
      return true;
    }
  }

  // Check for "Manage Guild" permission
  if (member.permissions.has(PermissionFlagsBits.ManageGuild)) {
    return true;
  }

  return false;
}

/**
 * Middleware to check admin permissions and reply with error if not authorized
 */
export async function requireAdmin(
  interaction: ChatInputCommandInteraction
): Promise<boolean> {
  if (!isAdmin(interaction)) {
    await interaction.reply({
      content: '❌ You need the "Manage Server" permission to use this command.',
      ephemeral: true,
    });
    return false;
  }
  return true;
}

export default isAdmin;
