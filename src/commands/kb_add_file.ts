import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../types/command.js';
import { COMMANDS, KB } from '../config/constants.js';
import { requireAdmin } from '../guards/isAdmin.js';
import { ingestFile, isFileTypeSupported } from '../kb/ingestFile.js';
import { replyWithError } from '../utils/errorHandler.js';

export const kbAddFileCommand: Command = {
  data: new SlashCommandBuilder()
    .setName(COMMANDS.KB_ADD_FILE)
    .setDescription('Upload a file to the knowledge base (Admin only)')
    .addAttachmentOption((option) =>
      option
        .setName('file')
        .setDescription(`File to upload (${KB.SUPPORTED_FILE_TYPES.join(', ')})`)
        .setRequired(true)
    ),

  adminOnly: true,

  async execute(interaction) {
    // Check admin permissions
    if (!(await requireAdmin(interaction))) {
      return;
    }

    const attachment = interaction.options.getAttachment('file', true);
    const guildId = interaction.guildId ?? 'dm';
    const userId = interaction.user.id;

    // Validate file type
    if (!isFileTypeSupported(attachment.name)) {
      await interaction.reply({
        content: `❌ Unsupported file type. Supported types: ${KB.SUPPORTED_FILE_TYPES.join(', ')}`,
        ephemeral: true,
      });
      return;
    }

    // Check file size
    const fileSizeMB = attachment.size / (1024 * 1024);
    if (fileSizeMB > KB.MAX_FILE_SIZE_MB) {
      await interaction.reply({
        content: `❌ File too large (${fileSizeMB.toFixed(2)}MB). Maximum: ${KB.MAX_FILE_SIZE_MB}MB`,
        ephemeral: true,
      });
      return;
    }

    // Defer reply since this might take a while
    await interaction.deferReply();

    try {
      // Download the file
      const response = await fetch(attachment.url);
      if (!response.ok) {
        throw new Error('Failed to download file');
      }

      const buffer = Buffer.from(await response.arrayBuffer());

      // Ingest the file
      const result = await ingestFile({
        guildId,
        userId,
        filename: attachment.name,
        buffer,
      });

      if (!result.success) {
        await interaction.editReply({
          content: `❌ Failed to add file: ${result.error}`,
        });
        return;
      }

      await interaction.editReply({
        content: `✅ Successfully added **${attachment.name}** to the knowledge base!\n\nID: \`${result.knowledgeItemId}\``,
      });
    } catch (error) {
      await replyWithError(interaction, error, { command: COMMANDS.KB_ADD_FILE });
    }
  },
};

export default kbAddFileCommand;
