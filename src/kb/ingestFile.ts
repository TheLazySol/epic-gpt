import { createHash } from 'crypto';
import { getOrCreateVectorStore, uploadAndAttachFile } from './vectorStore.js';
import { createKnowledgeItem, getKnowledgeItemByHash } from '../db/models.js';
import { pdfToText } from './convert/pdfToText.js';
import { prepareForUpload } from './convert/chunkText.js';
import { KB } from '../config/constants.js';

/**
 * Compute SHA-256 hash of content for deduplication
 */
export function computeContentHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Get file extension from filename
 */
function getFileExtension(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop();
  return ext ? `.${ext}` : '';
}

/**
 * Check if file type is supported
 */
export function isFileTypeSupported(filename: string): boolean {
  const ext = getFileExtension(filename);
  return (KB.SUPPORTED_FILE_TYPES as readonly string[]).includes(ext);
}

/**
 * Ingest a file into the knowledge base
 */
export async function ingestFile(options: {
  guildId: string;
  userId: string;
  filename: string;
  buffer: Buffer;
}): Promise<{
  success: boolean;
  knowledgeItemId?: string;
  error?: string;
  duplicate?: boolean;
}> {
  const { guildId, userId, filename, buffer } = options;

  // Check file type
  const ext = getFileExtension(filename);
  if (!isFileTypeSupported(filename)) {
    return {
      success: false,
      error: `Unsupported file type: ${ext}. Supported types: ${KB.SUPPORTED_FILE_TYPES.join(', ')}`,
    };
  }

  // Check file size
  const fileSizeMB = buffer.length / (1024 * 1024);
  if (fileSizeMB > KB.MAX_FILE_SIZE_MB) {
    return {
      success: false,
      error: `File too large: ${fileSizeMB.toFixed(2)}MB. Maximum: ${KB.MAX_FILE_SIZE_MB}MB`,
    };
  }

  try {
    // Extract text content
    let content: string;

    if (ext === '.pdf') {
      content = await pdfToText(buffer);
    } else {
      // For text files (md, txt)
      content = buffer.toString('utf-8');
    }

    // Prepare content for upload
    content = prepareForUpload(content);

    if (content.length < KB.MIN_CONTENT_LENGTH) {
      return {
        success: false,
        error: `File content too short (${content.length} characters). Minimum: ${KB.MIN_CONTENT_LENGTH}`,
      };
    }

    // Check for duplicates
    const contentHash = computeContentHash(content);
    const existing = await getKnowledgeItemByHash(guildId, contentHash);

    if (existing) {
      return {
        success: false,
        error: `Duplicate content detected. This file matches: ${existing.title}`,
        duplicate: true,
      };
    }

    // Get or create vector store
    const vectorStoreId = await getOrCreateVectorStore(guildId);

    // Create a File object for upload
    const file = new File([content], `${filename}.txt`, { type: 'text/plain' });

    // Upload and attach to vector store
    const { fileId, vectorStoreFileId } = await uploadAndAttachFile(
      vectorStoreId,
      file,
      filename
    );

    // Create knowledge item record
    const knowledgeItem = await createKnowledgeItem({
      guildId,
      kind: 'FILE',
      title: filename,
      openaiFileId: fileId,
      vectorStoreFileId,
      contentHash,
      createdByDiscordUserId: userId,
    });

    return {
      success: true,
      knowledgeItemId: knowledgeItem.id,
    };
  } catch (error) {
    console.error('Failed to ingest file:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

export default ingestFile;
