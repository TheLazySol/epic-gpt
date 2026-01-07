import { getSolanaBalance, getTokenSupply } from './solana.js';
import { getTokenPrice } from './birdeye.js';
import type { ToolName } from './toolSchemas.js';

export interface ToolCallResult {
  success: boolean;
  result?: unknown;
  error?: string;
}

/**
 * Execute a tool call and return the result
 */
export async function executeToolCall(
  toolName: ToolName,
  args: Record<string, unknown>
): Promise<ToolCallResult> {
  try {
    switch (toolName) {
      case 'get_solana_balance': {
        const address = args.address as string;
        if (!address) {
          return { success: false, error: 'Missing address parameter' };
        }
        const result = await getSolanaBalance(address);
        if (result.success) {
          return {
            success: true,
            result: {
              address,
              balance: result.balance,
              balanceLamports: result.balanceLamports,
              unit: 'SOL',
            },
          };
        }
        return { success: false, error: result.error };
      }

      case 'get_token_supply': {
        const mint = args.mint as string;
        if (!mint) {
          return { success: false, error: 'Missing mint parameter' };
        }
        const result = await getTokenSupply(mint);
        if (result.success) {
          return {
            success: true,
            result: {
              mint,
              supply: result.supply,
              decimals: result.decimals,
            },
          };
        }
        return { success: false, error: result.error };
      }

      case 'get_token_price': {
        const mintOrSymbol = args.mintOrSymbol as string;
        if (!mintOrSymbol) {
          return { success: false, error: 'Missing mintOrSymbol parameter' };
        }
        const result = await getTokenPrice(mintOrSymbol);
        if (result.success) {
          return {
            success: true,
            result: {
              token: result.symbol || mintOrSymbol,
              price: result.price,
              priceUSD: `$${result.price?.toFixed(6)}`,
              priceChange24h: result.priceChange24h
                ? `${result.priceChange24h > 0 ? '+' : ''}${result.priceChange24h.toFixed(2)}%`
                : undefined,
            },
          };
        }
        return { success: false, error: result.error };
      }

      default:
        return { success: false, error: `Unknown tool: ${toolName}` };
    }
  } catch (error) {
    console.error(`Tool execution error (${toolName}):`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Tool execution failed',
    };
  }
}

export default executeToolCall;
