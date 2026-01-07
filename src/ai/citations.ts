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
  const citations: string[] = [];

  for (const annotation of annotations) {
    let fileId: string | undefined;

    if (annotation.type === 'file_citation' && annotation.file_citation) {
      fileId = annotation.file_citation.file_id;
    } else if (annotation.type === 'file_path' && annotation.file_path) {
      fileId = annotation.file_path.file_id;
    }

    if (fileId) {
      // Check if this is a canonical file ID that should be referenced directly
      if (CANONICAL_FILE_IDS.has(fileId)) {
        citations.push(formatCanonicalFileCitation(fileId));
      } else {
        // Use title-based citation for other files
        const title = fileIdToTitle.get(fileId);
        if (title) {
          citations.push(formatKBCitation(title));
        }
      }
    }
  }

  return [...new Set(citations)]; // Remove duplicates
}

export default formatKBCitation;
