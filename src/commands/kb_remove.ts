import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../types/command.js';
import { COMMANDS } from '../config/constants.js';
import { requireAdmin } from '../guards/isAdmin.js';
import { getKnowledgeItemById, deleteKnowledgeItem, getGuildConfig } from '../db/models.js';
import { removeFileFromVectorStore } from '../kb/vectorStore.js';
import { replyWithError } from '../utils/errorHandler.js';

export const kbRemoveCommand: Command = {
  data: new SlashCommandBuilder()
    .setName(COMMANDS.KB_REMOVE)
    .setDescription('Remove an item from the knowledge base (Admin only)')
    .addStringOption((option) =>
      option
        .setName('id')
        .setDescription('The ID of the knowledge base item to remove')
        .setRequired(true)
    ),

  adminOnly: true,

  async execute(interaction) {
    // Check admin permissions
    if (!(await requireAdmin(interaction))) {
      return;
    }

    const id = interaction.options.getString('id', true);
    const guildId = interaction.guildId ?? 'dm';

    // Defer reply since this might take a while
    await interaction.deferReply({ ephemeral: true });

    try {
      // Find the knowledge item
      const item = await getKnowledgeItemById(id);

      if (!item) {
        await interaction.editReply({
          content: `❌ Knowledge base item not found: \`${id}\``,
        });
        return;
      }

      // Check if item belongs to this guild
      if (item.guildId !== guildId) {
        await interaction.editReply({
          content: '❌ This item does not belong to this server.',
        });
        return;
      }

      // Get vector store ID
      const config = await getGuildConfig(guildId);

      if (config?.vectorStoreId) {
        // Remove from vector store
        await removeFileFromVectorStore(
          config.vectorStoreId,
          item.vectorStoreFileId,
          item.openaiFileId
        );
      }

      // Delete from database
      await deleteKnowledgeItem(id);

      await interaction.editReply({
        content: `✅ Successfully removed **${item.title}** from the knowledge base.`,
      });
    } catch (error) {
      await replyWithError(interaction, error, { command: COMMANDS.KB_REMOVE });
    }
  },
};

export default kbRemoveCommand;
