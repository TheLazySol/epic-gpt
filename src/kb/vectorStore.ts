import { openai } from '../ai/openai.js';
import { getOrCreateGuildConfig, updateGuildVectorStoreId } from '../db/models.js';
import { BOT } from '../config/constants.js';

/**
 * Get or create a vector store for a guild
 * Uses a single shared vector store for all guilds (as per plan)
 */
export async function getOrCreateVectorStore(guildId: string): Promise<string> {
  // Check if guild already has a vector store
  const config = await getOrCreateGuildConfig(guildId);

  if (config.vectorStoreId) {
    // Verify the vector store still exists
    try {
      await openai.vectorStores.retrieve(config.vectorStoreId);
      return config.vectorStoreId;
    } catch (error) {
      // Vector store was deleted, create a new one
      console.log(`Vector store ${config.vectorStoreId} not found, creating new one`);
    }
  }

  // Create a new vector store
  const vectorStore = await openai.vectorStores.create({
    name: `${BOT.NAME} Knowledge Base`,
    expires_after: {
      anchor: 'last_active_at',
      days: 365, // Keep for 1 year
    },
  });

  // Save the vector store ID
  await updateGuildVectorStoreId(guildId, vectorStore.id);

  console.log(`✅ Created vector store: ${vectorStore.id}`);

  return vectorStore.id;
}

/**
 * Upload a file to OpenAI and attach it to the vector store
 */
export async function uploadAndAttachFile(
  vectorStoreId: string,
  file: File,
  filename: string
): Promise<{ fileId: string; vectorStoreFileId: string }> {
  // Upload file to OpenAI Files API
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const uploadedFile = await openai.files.create({
    file: file as any,
    purpose: 'assistants',
  });

  console.log(`📤 Uploaded file: ${uploadedFile.id} (${filename})`);

  // Attach file to vector store
  const vectorStoreFile = await openai.vectorStores.files.create(vectorStoreId, {
    file_id: uploadedFile.id,
  });

  console.log(`📎 Attached to vector store: ${vectorStoreFile.id}`);

  // Wait for processing to complete
  let status = vectorStoreFile.status;
  while (status === 'in_progress') {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const updated = await openai.vectorStores.files.retrieve(
      vectorStoreId,
      vectorStoreFile.id
    );
    status = updated.status;
  }

  if (status === 'failed') {
    throw new Error(`Failed to process file: ${filename}`);
  }

  return {
    fileId: uploadedFile.id,
    vectorStoreFileId: vectorStoreFile.id,
  };
}

/**
 * Remove a file from the vector store
 */
export async function removeFileFromVectorStore(
  vectorStoreId: string,
  vectorStoreFileId: string,
  openaiFileId: string
): Promise<void> {
  try {
    // Remove from vector store
    await openai.vectorStores.files.del(vectorStoreId, vectorStoreFileId);
    console.log(`🗑️ Removed from vector store: ${vectorStoreFileId}`);
  } catch (error) {
    console.warn(`Failed to remove from vector store:`, error);
  }

  try {
    // Delete the file from OpenAI
    await openai.files.del(openaiFileId);
    console.log(`🗑️ Deleted file: ${openaiFileId}`);
  } catch (error) {
    console.warn(`Failed to delete file:`, error);
  }
}

/**
 * List all files in a vector store
 */
export async function listVectorStoreFiles(
  vectorStoreId: string
): Promise<Array<{ id: string; status: string }>> {
  const files: Array<{ id: string; status: string }> = [];

  const fileList = await openai.vectorStores.files.list(vectorStoreId);

  for await (const file of fileList) {
    files.push({
      id: file.id,
      status: file.status,
    });
  }

  return files;
}

export default getOrCreateVectorStore;
