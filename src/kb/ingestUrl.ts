import { computeContentHash } from './ingestFile.js';
import { getOrCreateVectorStore, uploadAndAttachFile } from './vectorStore.js';
import { createKnowledgeItem, getKnowledgeItemByHash } from '../db/models.js';
import { fetchUrl } from './fetchUrl.js';
import { prepareForUpload } from './convert/chunkText.js';
import { KB } from '../config/constants.js';

/**
 * Validate URL format
 */
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Ingest a URL into the knowledge base
 */
export async function ingestUrl(options: {
  guildId: string;
  userId: string;
  url: string;
}): Promise<{
  success: boolean;
  knowledgeItemId?: string;
  title?: string;
  error?: string;
  duplicate?: boolean;
}> {
  const { guildId, userId, url } = options;

  // Validate URL
  if (!isValidUrl(url)) {
    return {
      success: false,
      error: 'Invalid URL format. Please provide a valid HTTP or HTTPS URL.',
    };
  }

  try {
    // Fetch URL content
    console.log(`🌐 Fetching URL: ${url}`);
    const { content: rawContent, title, usedPlaywright } = await fetchUrl(url);

    if (usedPlaywright) {
      console.log(`🎭 Used Playwright for dynamic content`);
    }

    // Prepare content for upload
    const content = prepareForUpload(rawContent);

    if (content.length < KB.MIN_CONTENT_LENGTH) {
      return {
        success: false,
        error: `URL content too short (${content.length} characters). The page might require JavaScript or be protected.`,
      };
    }

    // Check for duplicates
    const contentHash = computeContentHash(content);
    const existing = await getKnowledgeItemByHash(guildId, contentHash);

    if (existing) {
      return {
        success: false,
        error: `Duplicate content detected. This URL matches: ${existing.title}`,
        duplicate: true,
      };
    }

    // Get or create vector store
    const vectorStoreId = await getOrCreateVectorStore(guildId);

    // Create a clean filename from the URL
    const urlObj = new URL(url);
    const filename = `${urlObj.hostname}${urlObj.pathname.replace(/\//g, '_')}.md`;

    // Create a File object for upload
    const file = new File([content], filename, { type: 'text/markdown' });

    // Upload and attach to vector store
    const { fileId, vectorStoreFileId } = await uploadAndAttachFile(
      vectorStoreId,
      file,
      filename
    );

    // Create knowledge item record
    const knowledgeItem = await createKnowledgeItem({
      guildId,
      kind: 'URL',
      title,
      sourceUrl: url,
      openaiFileId: fileId,
      vectorStoreFileId,
      contentHash,
      createdByDiscordUserId: userId,
    });

    return {
      success: true,
      knowledgeItemId: knowledgeItem.id,
      title,
    };
  } catch (error) {
    console.error('Failed to ingest URL:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

export default ingestUrl;
