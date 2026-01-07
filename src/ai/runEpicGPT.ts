import { openai } from './openai.js';
import { getSystemPrompt } from './systemPrompt.js';
import { formatWebSearchResults } from './citations.js';
import { toolSchemas, type ToolName } from '../tools/toolSchemas.js';
import { executeToolCall } from '../tools/toolRouter.js';
import { searchWeb, type WebSearchResult } from '../tools/webSearch.js';
import { getOrCreateGuildConfig, getSession, saveSession, type SessionMessage } from '../db/models.js';
import { searchKnowledgeBase } from '../kb/searchKnowledgeBase.js';
import { OPENAI, SESSION } from '../config/constants.js';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

export interface RunEpicGPTOptions {
  guildId: string;
  userId: string;
  channelId: string;
  prompt: string;
  webSearchEnabled?: boolean;
}

export interface RunEpicGPTResult {
  success: boolean;
  response?: string;
  error?: string;
  usedFileSearch?: boolean;
  usedWebSearch?: boolean;
  toolCalls?: Array<{ name: string; result: unknown }>;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Detect if query is related to DAO governance, ownership coins, or technical/product topics
 */
function detectRelevantDocumentation(prompt: string): string[] {
  const lowerPrompt = prompt.toLowerCase();
  const relevantDocs: string[] = [];

  // Check for ownership coin or ownership-related queries
  const ownershipKeywords = ['ownership coin', 'ownership', 'member token', 'equity token'];
  if (ownershipKeywords.some(keyword => lowerPrompt.includes(keyword))) {
    relevantDocs.push('MetaDAO');
  }

  // Check for technical/product questions about Epicentral Labs/OPX
  const technicalKeywords = ['opx', 'opx markets', 'technical', 'product', 'ecosystem', 'protocol', 'trading', 'market'];
  if (technicalKeywords.some(keyword => lowerPrompt.includes(keyword))) {
    relevantDocs.push('OPX Markets');
  }

  return relevantDocs;
}

/**
 * Main orchestration function for EpicGPT
 */
export async function runEpicGPT(options: RunEpicGPTOptions): Promise<RunEpicGPTResult> {
  const { guildId, userId, channelId, prompt, webSearchEnabled = false } = options;

  try {
    // Get or create guild config for vector store ID
    const guildConfig = await getOrCreateGuildConfig(guildId);
    const vectorStoreId = guildConfig?.vectorStoreId;

    // Get existing session messages
    const sessionData = await getSession(guildId, userId, channelId);
    const previousMessages: SessionMessage[] = sessionData?.messages ?? [];

    // Search knowledge base if vector store exists
    let kbContent: string | undefined;
    let kbCitations: string[] = [];
    let usedFileSearch = false;

    if (vectorStoreId) {
      const kbResult = await searchKnowledgeBase(vectorStoreId, prompt, guildId);
      if (kbResult.success && kbResult.content) {
        usedFileSearch = true;
        kbContent = kbResult.content;
        kbCitations = kbResult.citations || [];
      }
    }

    // Detect relevant external documentation
    const relevantDocs = detectRelevantDocumentation(prompt);
    let additionalContext = '';
    
    if (relevantDocs.length > 0) {
      const contextParts: string[] = [];
      if (relevantDocs.includes('MetaDAO')) {
        contextParts.push('For ownership coins or ownership-related queries, reference MetaDAO documentation at https://docs.metadao.fi/ as a resource for best practices.');
      }
      if (relevantDocs.includes('OPX Markets')) {
        contextParts.push('For technical, ecosystem, and product-related questions, prioritize OPX Markets documentation at https://docs.opx.markets as the single point of truth.');
      }
      if (contextParts.length > 0) {
        additionalContext = contextParts.join(' ');
      }
    }

    // Build messages array
    const messages: ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: getSystemPrompt({ webSearchEnabled, additionalContext }),
      },
    ];

    // Add previous messages (limited to MAX_MESSAGES)
    for (const msg of previousMessages.slice(-SESSION.MAX_MESSAGES)) {
      messages.push({
        role: msg.role,
        content: msg.content,
      });
    }

    // Handle web search if enabled
    let webSearchResults: WebSearchResult[] = [];
    let usedWebSearch = false;

    // Build user message with knowledge base context
    let userMessageContent = prompt;

    if (kbContent) {
      // Pass raw content without formatted citations - bot will format citations
      // appropriately based on document type (Article X, Section Y for formal docs,
      // no file names/KB references for internal docs)
      userMessageContent = `[Knowledge Base Context]\n${kbContent}\n\n---\n\nUser question: ${prompt}`;
    }

    if (webSearchEnabled) {
      const searchResult = await searchWeb(prompt);
      if (searchResult.success && searchResult.results && searchResult.results.length > 0) {
        webSearchResults = searchResult.results;
        usedWebSearch = true;

        // Add web search results as context
        messages.push({
          role: 'user',
          content: `${formatWebSearchResults(webSearchResults)}\n\n${userMessageContent}`,
        });
      } else {
        messages.push({
          role: 'user',
          content: userMessageContent,
        });
      }
    } else {
      messages.push({
        role: 'user',
        content: userMessageContent,
      });
    }

    // Prepare tools
    const tools = [...toolSchemas];

    // Track token usage across all API calls
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let totalTokens = 0;

    // Call OpenAI
    // gpt-5-nano requires max_completion_tokens instead of max_tokens
    // gpt-5-nano only supports default temperature (1), not custom values
    const isNanoModel = OPENAI.MODEL.includes('nano');
    let response = await openai.chat.completions.create({
      model: OPENAI.MODEL,
      messages,
      tools: tools.length > 0 ? tools : undefined,
      ...(isNanoModel 
        ? { max_completion_tokens: OPENAI.MAX_TOKENS }
        : { max_tokens: OPENAI.MAX_TOKENS }
      ),
      // gpt-5-nano only supports default temperature (1), so we omit it for nano models
      ...(isNanoModel ? {} : { temperature: OPENAI.TEMPERATURE }),
      // Note: Knowledge base search is handled via Assistants API with vector store
      // Results are injected into the Chat Completions context above
    });

    // Accumulate token usage from first call
    if (response.usage) {
      totalPromptTokens += response.usage.prompt_tokens ?? 0;
      totalCompletionTokens += response.usage.completion_tokens ?? 0;
      totalTokens += response.usage.total_tokens ?? 0;
    }

    let assistantMessage = response.choices[0]?.message;
    const toolCallResults: Array<{ name: string; result: unknown }> = [];

    // Handle tool calls
    while (assistantMessage?.tool_calls && assistantMessage.tool_calls.length > 0) {
      // Add assistant message with tool calls
      messages.push(assistantMessage);

      // Execute each tool call
      for (const toolCall of assistantMessage.tool_calls) {
        const toolName = toolCall.function.name as ToolName;
        let args: Record<string, unknown> = {};

        try {
          args = JSON.parse(toolCall.function.arguments);
        } catch {
          args = {};
        }

        const result = await executeToolCall(toolName, args);
        toolCallResults.push({ name: toolName, result: result.result ?? result.error });

        // Add tool result to messages
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result.success ? result.result : { error: result.error }),
        });
      }

      // Get next response
      // gpt-5-nano requires max_completion_tokens instead of max_tokens
      // gpt-5-nano only supports default temperature (1), not custom values
      response = await openai.chat.completions.create({
        model: OPENAI.MODEL,
        messages,
        tools,
        ...(isNanoModel 
          ? { max_completion_tokens: OPENAI.MAX_TOKENS }
          : { max_tokens: OPENAI.MAX_TOKENS }
        ),
        // gpt-5-nano only supports default temperature (1), so we omit it for nano models
        ...(isNanoModel ? {} : { temperature: OPENAI.TEMPERATURE }),
      });

      // Accumulate token usage from subsequent calls
      if (response.usage) {
        totalPromptTokens += response.usage.prompt_tokens ?? 0;
        totalCompletionTokens += response.usage.completion_tokens ?? 0;
        totalTokens += response.usage.total_tokens ?? 0;
      }

      assistantMessage = response.choices[0]?.message;
    }

    const responseContent = assistantMessage?.content ?? 'I apologize, but I was unable to generate a response.';

    // Save session with new messages
    const newMessages: SessionMessage[] = [
      ...previousMessages,
      { role: 'user', content: prompt },
      { role: 'assistant', content: responseContent },
    ];

    await saveSession(guildId, userId, channelId, newMessages);

    return {
      success: true,
      response: responseContent,
      usedFileSearch,
      usedWebSearch,
      toolCalls: toolCallResults.length > 0 ? toolCallResults : undefined,
      tokenUsage: {
        promptTokens: totalPromptTokens,
        completionTokens: totalCompletionTokens,
        totalTokens: totalTokens,
      },
    };
  } catch (error) {
    console.error('EpicGPT error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred',
    };
  }
}

export default runEpicGPT;
