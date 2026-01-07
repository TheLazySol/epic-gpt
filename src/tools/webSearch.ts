import { env } from '../config/env.js';
import { WEB_SEARCH } from '../config/constants.js';

const SERPER_API_BASE = 'https://google.serper.dev';

export interface WebSearchResult {
  title: string;
  snippet: string;
  url: string;
}

/**
 * Search the web using Serper.dev API
 */
export async function searchWeb(query: string): Promise<{
  success: boolean;
  results?: WebSearchResult[];
  error?: string;
}> {
  try {
    const response = await fetch(`${SERPER_API_BASE}/search`, {
      method: 'POST',
      headers: {
        'X-API-KEY': env.SERPER_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: query,
        num: WEB_SEARCH.MAX_RESULTS,
      }),
    });

    if (!response.ok) {
      throw new Error(`Serper API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as {
      organic?: Array<{
        title: string;
        snippet: string;
        link: string;
      }>;
    };

    if (!data.organic || data.organic.length === 0) {
      return {
        success: true,
        results: [],
      };
    }

    const results: WebSearchResult[] = data.organic.map((item) => ({
      title: item.title,
      snippet: item.snippet,
      url: item.link,
    }));

    return {
      success: true,
      results,
    };
  } catch (error) {
    console.error('Web search failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to search the web',
    };
  }
}

export default searchWeb;
