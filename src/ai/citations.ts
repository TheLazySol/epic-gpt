/**
 * Canonical file IDs that should be referenced by their file ID directly
 */
const CANONICAL_FILE_IDS = new Set([
  'file-VNyEvYFhiddg51i2Dt7oWv', // EPICENTRAL LABS DAO LLC OPERATING AGREEMENT
  'file-SjDBvE2VmPyT8SgjCT6CVK', // Clarity for Digital Tokens Act
]);

/**
 * Format a knowledge base citation
 */
export function formatKBCitation(title: string): string {
  return `(KB: ${title})`;
}

/**
 * Format a canonical file ID citation
 */
export function formatCanonicalFileCitation(fileId: string): string {
  return `(${fileId})`;
}

/**
 * Format a web source citation
 */
export function formatWebCitation(url: string): string {
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname.replace('www.', '');
    return `(Source: ${domain})`;
  } catch {
    return `(Source: ${url})`;
  }
}

/**
 * Format web search results for injection into context
 */
export function formatWebSearchResults(
  results: Array<{
    title: string;
    snippet: string;
    url: string;
  }>
): string {
  if (results.length === 0) {
    return '[Web Search Results]\nNo relevant results found.';
  }

  const formattedResults = results
    .map((result, index) => {
      return `${index + 1}. **${result.title}**\n   ${result.snippet}\n   URL: ${result.url}`;
    })
    .join('\n\n');

  return `[Web Search Results]\n${formattedResults}`;
}

/**
 * Extract citations from OpenAI file_search annotations
 * Note: Returns empty array as citations should not be displayed to users.
 * Citations are tracked internally but formatted by the bot based on document type.
 */
export function extractFileSearchCitations(
  annotations: Array<{
    type: string;
    file_citation?: {
      file_id: string;
      quote?: string;
    };
    file_path?: {
      file_id: string;
    };
    text?: string;
  }>,
  fileIdToTitle: Map<string, string>
): string[] {
  // Citations are not formatted for display - the bot will format them
  // appropriately based on document type (Article X, Section Y for formal docs,
  // minimal hints for internal docs, no file names/KB references)
  // This function still tracks citations internally but returns empty array
  // to prevent formatted citations from being shown to users.
  return [];
}

export default formatKBCitation;
