import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../types/command.js';
import { COMMANDS } from '../config/constants.js';
import { requireAdmin } from '../guards/isAdmin.js';
import { ingestUrl } from '../kb/ingestUrl.js';
import { replyWithError } from '../utils/errorHandler.js';

export const kbAddUrlCommand: Command = {
  data: new SlashCommandBuilder()
    .setName(COMMANDS.KB_ADD_URL)
    .setDescription('Add a URL to the knowledge base (Admin only)')
    .addStringOption((option) =>
      option
        .setName('url')
        .setDescription('The URL to add (must be HTTPS)')
        .setRequired(true)
    ),

  adminOnly: true,

  async execute(interaction) {
    // Check admin permissions
    if (!(await requireAdmin(interaction))) {
      return;
    }

    const url = interaction.options.getString('url', true);
    const guildId = interaction.guildId ?? 'dm';
    const userId = interaction.user.id;

    // Basic URL validation
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        await interaction.reply({
          content: '❌ Invalid URL. Please provide an HTTP or HTTPS URL.',
          ephemeral: true,
        });
        return;
      }
    } catch {
      await interaction.reply({
        content: '❌ Invalid URL format.',
        ephemeral: true,
      });
      return;
    }

    // Defer reply since this might take a while
    await interaction.deferReply();

    try {
      const result = await ingestUrl({
        guildId,
        userId,
        url,
      });

      if (!result.success) {
        await interaction.editReply({
          content: `❌ Failed to add URL: ${result.error}`,
        });
        return;
      }

      await interaction.editReply({
        content: `✅ Successfully added **${result.title}** to the knowledge base!\n\nURL: ${url}\nID: \`${result.knowledgeItemId}\``,
      });
    } catch (error) {
      await replyWithError(interaction, error, { command: COMMANDS.KB_ADD_URL });
    }
  },
};

export default kbAddUrlCommand;
