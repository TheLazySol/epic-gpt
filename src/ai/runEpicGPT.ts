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
    cachedTokens?: number;
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
    // Optimized for caching: KB content added after system message (dynamic content)
    // System message (static, cached) → Previous messages (dynamic) → KB context + user prompt (dynamic)
    let userMessageContent = prompt;

    if (kbContent) {
      // Pass raw content without formatted citations - bot will format citations
      // appropriately based on document type (Article X, Section Y for formal docs,
      // no file names/KB references for internal docs)
      // KB content is dynamic and comes after static system message for optimal cache hits
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
    let totalCachedTokens = 0;

    // Call OpenAI
    // Message structure optimized for prompt caching (static content first):
    // 1. System message (static - cached across requests)
    // 2. Tools (static - cached across requests)  
    // 3. Previous conversation messages (dynamic)
    // 4. Knowledge base context + user prompt (dynamic)
    // This ensures the static prefix (system + tools) is cached, while dynamic content comes after
    
    // gpt-5 models (nano, mini) require max_completion_tokens instead of max_tokens
    // gpt-5-nano only supports default temperature (1), not custom values
    // gpt-5-mini supports custom temperature
    const isGpt5Model = OPENAI.MODEL.includes('gpt-5');
    const isNanoModel = OPENAI.MODEL.includes('nano');
    // Extended prompt cache retention (24h) is only supported on:
    // - gpt-5.2 variants
    // - gpt-5.1 variants
    // - gpt-4.1 models
    // For other models, omit or use 'in_memory' (default)
    const supportsExtendedCache = 
      OPENAI.MODEL.includes('gpt-5.2') || 
      OPENAI.MODEL.includes('gpt-5.1') || 
      OPENAI.MODEL.includes('gpt-4.1');
    // Use guildId-based cache key for consistent caching across requests
    const promptCacheKey = `epicgpt_${guildId}`;
    let response = await openai.chat.completions.create({
      model: OPENAI.MODEL,
      messages,
      tools: tools.length > 0 ? tools : undefined,
      ...(isGpt5Model 
        ? { max_completion_tokens: OPENAI.MAX_TOKENS }
        : { max_tokens: OPENAI.MAX_TOKENS }
      ),
      // gpt-5-nano only supports default temperature (1), so we omit it for nano models
      ...(isNanoModel ? {} : { temperature: OPENAI.TEMPERATURE }),
      // Prompt caching parameters (not yet in TypeScript types but supported by API)
      prompt_cache_key: promptCacheKey,
      // Only include prompt_cache_retention if the model supports extended retention
      ...(supportsExtendedCache && OPENAI.PROMPT_CACHE_RETENTION === '24h' 
        ? { prompt_cache_retention: OPENAI.PROMPT_CACHE_RETENTION }
        : {}
      ),
    } as any);

    // Accumulate token usage from first call
    if (response.usage) {
      totalPromptTokens += response.usage.prompt_tokens ?? 0;
      totalCompletionTokens += response.usage.completion_tokens ?? 0;
      totalTokens += response.usage.total_tokens ?? 0;
      // Track cached tokens for cache hit monitoring
      const cachedTokens = response.usage.prompt_tokens_details?.cached_tokens ?? 0;
      totalCachedTokens += cachedTokens;
      if (cachedTokens > 0) {
        console.log(`[Cache] Cache hit: ${cachedTokens}/${response.usage.prompt_tokens} tokens cached (${Math.round((cachedTokens / response.usage.prompt_tokens) * 100)}%)`);
      }
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
      // gpt-5 models (nano, mini) require max_completion_tokens instead of max_tokens
      // gpt-5-nano only supports default temperature (1), not custom values
      // gpt-5-mini supports custom temperature
      response = await openai.chat.completions.create({
        model: OPENAI.MODEL,
        messages,
        tools,
        ...(isGpt5Model 
          ? { max_completion_tokens: OPENAI.MAX_TOKENS }
          : { max_tokens: OPENAI.MAX_TOKENS }
        ),
        // gpt-5-nano only supports default temperature (1), so we omit it for nano models
        ...(isNanoModel ? {} : { temperature: OPENAI.TEMPERATURE }),
        // Prompt caching parameters (not yet in TypeScript types but supported by API)
        prompt_cache_key: promptCacheKey,
        // Only include prompt_cache_retention if the model supports extended retention
        ...(supportsExtendedCache && OPENAI.PROMPT_CACHE_RETENTION === '24h' 
          ? { prompt_cache_retention: OPENAI.PROMPT_CACHE_RETENTION }
          : {}
        ),
      } as any);

      // Accumulate token usage from subsequent calls
      if (response.usage) {
        totalPromptTokens += response.usage.prompt_tokens ?? 0;
        totalCompletionTokens += response.usage.completion_tokens ?? 0;
        totalTokens += response.usage.total_tokens ?? 0;
        // Track cached tokens for cache hit monitoring
        const cachedTokens = response.usage.prompt_tokens_details?.cached_tokens ?? 0;
        totalCachedTokens += cachedTokens;
        if (cachedTokens > 0) {
          console.log(`[Cache] Cache hit: ${cachedTokens}/${response.usage.prompt_tokens} tokens cached (${Math.round((cachedTokens / response.usage.prompt_tokens) * 100)}%)`);
        }
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
        cachedTokens: totalCachedTokens > 0 ? totalCachedTokens : undefined,
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
