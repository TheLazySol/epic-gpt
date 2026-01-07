import { env } from '../config/env.js';
import { isValidSolanaAddress } from './solana.js';

const BIRDEYE_API_BASE = 'https://public-api.birdeye.so';

// Common token symbols to mint addresses
const TOKEN_SYMBOLS: Record<string, string> = {
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  JUP: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
  RAY: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
  ORCA: 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE',
  MNGO: 'MangoCzJ36AjZyKwVj3VnYU4GTonjfVEnJmvvWaxLac',
  STEP: 'StepAscQoEioFxxWGnh2sLBDFp9d8rvKz2Yp39iDpyT',
  SRM: 'SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt',
};

/**
 * Resolve token symbol to mint address
 */
function resolveMint(mintOrSymbol: string): string {
  const upperSymbol = mintOrSymbol.toUpperCase();
  return TOKEN_SYMBOLS[upperSymbol] || mintOrSymbol;
}

/**
 * Get token price from Birdeye API
 */
export async function getTokenPrice(mintOrSymbol: string): Promise<{
  success: boolean;
  price?: number;
  symbol?: string;
  priceChange24h?: number;
  error?: string;
}> {
  const mint = resolveMint(mintOrSymbol);

  // Validate mint address
  if (!isValidSolanaAddress(mint)) {
    return {
      success: false,
      error: 'Invalid token mint address or unknown symbol',
    };
  }

  try {
    const response = await fetch(`${BIRDEYE_API_BASE}/defi/price?address=${mint}`, {
      headers: {
        'X-API-KEY': env.BIRDEYE_API_KEY,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Birdeye API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as {
      success: boolean;
      data?: {
        value: number;
        priceChange24h?: number;
      };
    };

    if (!data.success || !data.data) {
      return {
        success: false,
        error: 'Token price not found',
      };
    }

    // Try to get symbol from reverse lookup
    const symbol = Object.entries(TOKEN_SYMBOLS).find(([, m]) => m === mint)?.[0];

    return {
      success: true,
      price: data.data.value,
      symbol: symbol || mintOrSymbol,
      priceChange24h: data.data.priceChange24h,
    };
  } catch (error) {
    console.error('Failed to get token price:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch token price',
    };
  }
}

export default { getTokenPrice };
