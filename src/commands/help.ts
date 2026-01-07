import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { Command } from '../types/command.js';
import { BOT, COMMANDS } from '../config/constants.js';

export const helpCommand: Command = {
  data: new SlashCommandBuilder()
    .setName(COMMANDS.HELP)
    .setDescription('Learn how to use EpicGPT'),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor(BOT.COLOR)
      .setTitle(`${BOT.NAME} - Help`)
      .setDescription(
        `I'm ${BOT.NAME}, your AI assistant for Epicentral Labs! I can answer questions using our knowledge base, search the web, and fetch live blockchain data.`
      )
      .addFields(
        {
          name: '💬 Chat Commands',
          value: [
            '`/chat prompt:<your question>` - Ask me anything! I\'ll search the knowledge base and use available tools.',
            '`/search prompt:<your question>` - Search the web for up-to-date information with citations.',
          ].join('\n'),
        },
        {
          name: '📚 Knowledge Base (Admin)',
          value: [
            '`/kb_add_file` - Upload a file (PDF, MD, TXT) to the knowledge base',
            '`/kb_add_url url:<url>` - Add a webpage to the knowledge base',
            '`/kb_list` - List all knowledge base items',
            '`/kb_remove id:<id>` - Remove an item from the knowledge base',
            '`/kb_refresh id:<id>` - Re-fetch and update a knowledge base item',
          ].join('\n'),
        },
        {
          name: '🔧 Available Tools',
          value: [
            '• **Solana Balance** - Check SOL balance for any wallet',
            '• **Token Supply** - Get total supply of any SPL token',
            '• **Token Price** - Get current price from Birdeye',
          ].join('\n'),
        },
        {
          name: '💡 Tips',
          value: [
            '• Use `/chat` for questions about Epicentral Labs products',
            '• Use `/search` when you need current information from the web',
            '• I maintain conversation context for 1 hour per channel',
            '• Admin commands require "Manage Server" permission',
          ].join('\n'),
        }
      )
      .setFooter({ text: BOT.FOOTER })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};

export default helpCommand;
