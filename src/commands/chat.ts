import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../types/command.js';
import { COMMANDS } from '../config/constants.js';
import { checkRateLimit } from '../guards/rateLimit.js';
import { runEpicGPT } from '../ai/runEpicGPT.js';
import { replyWithError } from '../utils/errorHandler.js';
import { splitMessage } from '../utils/messageSplitter.js';
import { getOrCreateGuildConfig, createRequestLog } from '../db/models.js';

export const chatCommand: Command = {
  data: new SlashCommandBuilder()
    .setName(COMMANDS.CHAT)
    .setDescription('Chat with EpicGPT using the knowledge base')
    .addStringOption((option) =>
      option
        .setName('prompt')
        .setDescription('Your question or message')
        .setRequired(true)
        .setMaxLength(2000)
    ),

  async execute(interaction) {
    // Check rate limit
    if (!(await checkRateLimit(interaction, 'CHAT'))) {
      return;
    }

    const prompt = interaction.options.getString('prompt', true);
    const guildId = interaction.guildId ?? 'dm';
    const userId = interaction.user.id;
    const channelId = interaction.channelId;

    // Defer reply since this might take a while
    await interaction.deferReply();

    try {
      // Ensure guild config exists before proceeding
      await getOrCreateGuildConfig(guildId);

      const result = await runEpicGPT({
        guildId,
        userId,
        channelId,
        prompt,
        webSearchEnabled: false,
      });

      // Log the request
      await createRequestLog({
        guildId,
        userId,
        command: 'chat',
        usedFileSearch: result.usedFileSearch,
        usedWebSearch: false,
        toolCalls: result.toolCalls,
        error: result.error,
      });

      if (!result.success || !result.response) {
        await interaction.editReply({
          content: `❌ ${result.error ?? 'Failed to generate a response. Please try again.'}`,
        });
        return;
      }

      // Format token usage info
      let tokenInfo = '';
      if (result.tokenUsage) {
        const { promptTokens, completionTokens, totalTokens } = result.tokenUsage;
        tokenInfo = `\n\n**Token Usage:** \`${totalTokens.toLocaleString()}\` total (\`${promptTokens.toLocaleString()}\` prompt + \`${completionTokens.toLocaleString()}\` completion)`;
      }

      // Split long messages
      let responseWithTokens = result.response + tokenInfo;
      const chunks = splitMessage(responseWithTokens);

      // Send first chunk as edit
      await interaction.editReply({ content: chunks[0] });

      // Send remaining chunks as follow-ups
      for (let i = 1; i < chunks.length; i++) {
        const chunk = chunks[i];
        if (chunk) {
          await interaction.followUp({ content: chunk });
        }
      }
    } catch (error) {
      await replyWithError(interaction, error, { command: COMMANDS.CHAT });
    }
  },
};

export default chatCommand;
