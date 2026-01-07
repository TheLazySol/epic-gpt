import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../types/command.js';
import { COMMANDS } from '../config/constants.js';
import { checkRateLimit } from '../guards/rateLimit.js';
import { runEpicGPT } from '../ai/runEpicGPT.js';
import { replyWithError } from '../utils/errorHandler.js';
import { splitMessage } from '../utils/messageSplitter.js';
import { getOrCreateGuildConfig, createRequestLog } from '../db/models.js';

export const searchCommand: Command = {
  data: new SlashCommandBuilder()
    .setName(COMMANDS.SEARCH)
    .setDescription('Search the web for up-to-date information with citations')
    .addStringOption((option) =>
      option
        .setName('prompt')
        .setDescription('Your search query')
        .setRequired(true)
        .setMaxLength(2000)
    ),

  async execute(interaction) {
    // Check rate limit (stricter for search)
    if (!(await checkRateLimit(interaction, 'SEARCH'))) {
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
        webSearchEnabled: true,
      });

      // Log the request
      await createRequestLog({
        guildId,
        userId,
        command: 'search',
        usedFileSearch: result.usedFileSearch,
        usedWebSearch: result.usedWebSearch,
        toolCalls: result.toolCalls,
        error: result.error,
      });

      if (!result.success || !result.response) {
        await interaction.editReply({
          content: `❌ ${result.error ?? 'Failed to search. Please try again.'}`,
        });
        return;
      }

      // Add search indicator
      let response = result.response;
      if (result.usedWebSearch) {
        response = `🔍 *Web search results:*\n\n${response}`;
      }

      // Format token usage info
      let tokenInfo = '';
      if (result.tokenUsage) {
        const { promptTokens, completionTokens, totalTokens } = result.tokenUsage;
        tokenInfo = `\n\n**Token Usage:** \`${totalTokens.toLocaleString()}\` total (\`${promptTokens.toLocaleString()}\` prompt + \`${completionTokens.toLocaleString()}\` completion)`;
      }

      // Split long messages
      const chunks = splitMessage(response + tokenInfo);

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
      await replyWithError(interaction, error, { command: COMMANDS.SEARCH });
    }
  },
};

export default searchCommand;
