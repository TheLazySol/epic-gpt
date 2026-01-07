import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { OPENAI } from '../../config/constants.js';

/**
 * Split text into chunks for vector store ingestion
 */
export async function chunkText(
  text: string,
  options?: {
    chunkSize?: number;
    chunkOverlap?: number;
  }
): Promise<string[]> {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: options?.chunkSize ?? OPENAI.CHUNK_SIZE,
    chunkOverlap: options?.chunkOverlap ?? OPENAI.CHUNK_OVERLAP,
    separators: ['\n\n', '\n', '. ', ' ', ''],
  });

  const chunks = await splitter.splitText(text);

  return chunks;
}

/**
 * Combine chunks back into a single document for upload
 * OpenAI vector store handles chunking internally, so we just clean the text
 */
export function prepareForUpload(text: string): string {
  // Clean up the text
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export default chunkText;
