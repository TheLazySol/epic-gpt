import { openai } from '../ai/openai.js';
import { getKnowledgeItems } from '../db/models.js';
import { extractFileSearchCitations } from '../ai/citations.js';
import { OPENAI } from '../config/constants.js';
import type { KnowledgeItem } from '@prisma/client';

export interface KnowledgeBaseSearchResult {
  success: boolean;
  content?: string;
  citations?: string[];
  error?: string;
}

/**
 * Search the knowledge base using OpenAI Assistants API with vector store
 * This retrieves relevant content from uploaded files/URLs
 */
export async function searchKnowledgeBase(
  vectorStoreId: string,
  query: string,
  guildId: string
): Promise<KnowledgeBaseSearchResult> {
  try {
    // Check if vector store has files
    const files = openai.vectorStores.files.list(vectorStoreId);
    let fileCount = 0;
    for await (const _file of files) {
      fileCount++;
      if (fileCount > 0) break; // Just check if any files exist
    }

    if (fileCount === 0) {
      return {
        success: false,
        error: 'Knowledge base is empty',
      };
    }

    // Create a temporary assistant with the vector store
    // Note: Some models (e.g., gpt-5-nano) don't support Assistants API
    // Using gpt-4.1-2025-04-14 which supports Assistants API with file_search tool
    const assistant = await openai.beta.assistants.create({
      name: 'Knowledge Base Search',
      model: OPENAI.ASSISTANT_MODEL,
      tools: [{ type: 'file_search' }],
      tool_resources: {
        file_search: {
          vector_store_ids: [vectorStoreId],
        },
      },
      instructions:
        'You are a knowledge base search assistant for Epicentral Labs DAO LLC. Extract and return relevant information from the knowledge base based on the user query. Be concise and accurate. When queries relate to DAO governance, roles, processes, or definitions, prioritize the EPICENTRAL LABS DAO LLC OPERATING AGREEMENT (file-VNyEvYFhiddg51i2Dt7oWv). For crypto-related legal or regulatory questions, prioritize the Clarity for Digital Tokens Act (file-SjDBvE2VmPyT8SgjCT6CVK).',
    });

    try {
      // Create a thread and add the user message
      const thread = await openai.beta.threads.create();
      await openai.beta.threads.messages.create(thread.id, {
        role: 'user',
        content: query,
      });

      // Run the assistant
      const run = await openai.beta.threads.runs.create(thread.id, {
        assistant_id: assistant.id,
      });

      // Wait for completion
      let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
      let attempts = 0;
      const maxAttempts = 30; // 30 seconds max wait

      while (runStatus.status === 'in_progress' || runStatus.status === 'queued') {
        if (attempts >= maxAttempts) {
          throw new Error('Knowledge base search timed out');
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
        runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
        attempts++;
      }

      if (runStatus.status !== 'completed') {
        throw new Error(`Knowledge base search failed with status: ${runStatus.status}`);
      }

      // Retrieve messages
      const messages = await openai.beta.threads.messages.list(thread.id, {
        order: 'asc',
      });

      // Extract assistant response
      const assistantMessage = messages.data.find(
        (msg) => msg.role === 'assistant' && msg.content[0]?.type === 'text'
      );

      if (!assistantMessage || assistantMessage.content[0]?.type !== 'text') {
        return {
          success: false,
          error: 'No response from knowledge base search',
        };
      }

      const content = assistantMessage.content[0].text.value;

      // Extract citations from annotations
      const annotations = assistantMessage.content[0].text.annotations || [];
      const knowledgeItems = await getKnowledgeItems(guildId);
      const fileIdToTitle = new Map<string, string>();

      // Map OpenAI file IDs to knowledge item titles
      for (const item of knowledgeItems) {
        fileIdToTitle.set(item.openaiFileId, item.title);
      }

      const citations = extractFileSearchCitations(annotations, fileIdToTitle);

      // Clean up thread and assistant
      await openai.beta.threads.del(thread.id).catch(() => {
        // Ignore cleanup errors
      });

      return {
        success: true,
        content,
        citations: citations.length > 0 ? citations : undefined,
      };
    } finally {
      // Clean up assistant
      await openai.beta.assistants.del(assistant.id).catch(() => {
        // Ignore cleanup errors
      });
    }
  } catch (error) {
    console.error('Knowledge base search error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Knowledge base search failed',
    };
  }
}

export default searchKnowledgeBase;
