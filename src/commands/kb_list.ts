import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { Command } from '../types/command.js';
import { COMMANDS, BOT } from '../config/constants.js';
import { requireAdmin } from '../guards/isAdmin.js';
import { getKnowledgeItems } from '../db/models.js';
import { replyWithError } from '../utils/errorHandler.js';

export const kbListCommand: Command = {
  data: new SlashCommandBuilder()
    .setName(COMMANDS.KB_LIST)
    .setDescription('List all knowledge base items (Admin only)'),

  adminOnly: true,

  async execute(interaction) {
    // Check admin permissions
    if (!(await requireAdmin(interaction))) {
      return;
    }

    const guildId = interaction.guildId ?? 'dm';

    try {
      const items = await getKnowledgeItems(guildId);

      if (items.length === 0) {
        await interaction.reply({
          content: '📚 The knowledge base is empty. Use `/kb_add_file` or `/kb_add_url` to add content.',
          ephemeral: true,
        });
        return;
      }

      // Build embed with items
      const embed = new EmbedBuilder()
        .setColor(BOT.COLOR)
        .setTitle('📚 Knowledge Base Items')
        .setDescription(`Found ${items.length} item${items.length === 1 ? '' : 's'}`)
        .setFooter({ text: BOT.FOOTER })
        .setTimestamp();

      // Add items as fields (max 25 fields per embed)
      const displayItems = items.slice(0, 25);

      for (const item of displayItems) {
        const createdDate = item.createdAt.toLocaleDateString();
        const typeEmoji = item.kind === 'FILE' ? '📄' : '🔗';
        const sourceInfo = item.sourceUrl ? `\n[Source](${item.sourceUrl})` : '';

        embed.addFields({
          name: `${typeEmoji} ${item.title}`,
          value: `ID: \`${item.id}\`\nAdded: ${createdDate}${sourceInfo}`,
          inline: true,
        });
      }

      if (items.length > 25) {
        embed.setDescription(
          `Showing 25 of ${items.length} items. Use database tools to view all.`
        );
      }

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      await replyWithError(interaction, error, { command: COMMANDS.KB_LIST });
    }
  },
};

export default kbListCommand;
