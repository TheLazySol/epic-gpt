import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../types/command.js';
import { COMMANDS } from '../config/constants.js';
import { requireAdmin } from '../guards/isAdmin.js';
import {
  getKnowledgeItemById,
  updateKnowledgeItem,
  getGuildConfig,
} from '../db/models.js';
import { removeFileFromVectorStore, uploadAndAttachFile } from '../kb/vectorStore.js';
import { fetchUrl } from '../kb/fetchUrl.js';
import { prepareForUpload } from '../kb/convert/chunkText.js';
import { computeContentHash } from '../kb/ingestFile.js';
import { replyWithError } from '../utils/errorHandler.js';

export const kbRefreshCommand: Command = {
  data: new SlashCommandBuilder()
    .setName(COMMANDS.KB_REFRESH)
    .setDescription('Refresh/re-fetch a knowledge base item (Admin only)')
    .addStringOption((option) =>
      option
        .setName('id')
        .setDescription('The ID of the knowledge base item to refresh')
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

      // Only URL items can be refreshed
      if (item.kind !== 'URL' || !item.sourceUrl) {
        await interaction.editReply({
          content: '❌ Only URL items can be refreshed. File items must be re-uploaded.',
        });
        return;
      }

      // Get vector store ID
      const config = await getGuildConfig(guildId);

      if (!config?.vectorStoreId) {
        await interaction.editReply({
          content: '❌ No vector store found for this server.',
        });
        return;
      }

      // Fetch fresh content
      console.log(`🔄 Refreshing URL: ${item.sourceUrl}`);
      const { content: rawContent, title } = await fetchUrl(item.sourceUrl);
      const content = prepareForUpload(rawContent);

      // Check if content has changed
      const newHash = computeContentHash(content);

      if (newHash === item.contentHash) {
        await interaction.editReply({
          content: `ℹ️ No changes detected for **${item.title}**. Content is up to date.`,
        });
        return;
      }

      // Remove old file from vector store
      await removeFileFromVectorStore(
        config.vectorStoreId,
        item.vectorStoreFileId,
        item.openaiFileId
      );

      // Create new filename
      const urlObj = new URL(item.sourceUrl);
      const filename = `${urlObj.hostname}${urlObj.pathname.replace(/\//g, '_')}.md`;

      // Upload new content
      const file = new File([content], filename, { type: 'text/markdown' });
      const { fileId, vectorStoreFileId } = await uploadAndAttachFile(
        config.vectorStoreId,
        file,
        filename
      );

      // Update database record
      await updateKnowledgeItem(id, {
        openaiFileId: fileId,
        vectorStoreFileId,
        contentHash: newHash,
      });

      await interaction.editReply({
        content: `✅ Successfully refreshed **${title}**!\n\nNew content has been indexed.`,
      });
    } catch (error) {
      await replyWithError(interaction, error, { command: COMMANDS.KB_REFRESH });
    }
  },
};

export default kbRefreshCommand;
