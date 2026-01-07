import type { ChatCompletionTool } from 'openai/resources/chat/completions';

/**
 * Tool schemas for OpenAI function calling
 */
export const toolSchemas: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_solana_balance',
      description: 'Get the SOL balance for a Solana wallet address',
      parameters: {
        type: 'object',
        properties: {
          address: {
            type: 'string',
            description: 'The Solana wallet address (base58 encoded public key)',
          },
        },
        required: ['address'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_token_supply',
      description: 'Get the total supply of a Solana token by its mint address',
      parameters: {
        type: 'object',
        properties: {
          mint: {
            type: 'string',
            description: 'The token mint address (base58 encoded public key)',
          },
        },
        required: ['mint'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_token_price',
      description: 'Get the current price of a token in USD',
      parameters: {
        type: 'object',
        properties: {
          mintOrSymbol: {
            type: 'string',
            description: 'The token mint address or symbol (e.g., "SOL", "USDC", or a mint address)',
          },
        },
        required: ['mintOrSymbol'],
      },
    },
  },
];

export type ToolName = 'get_solana_balance' | 'get_token_supply' | 'get_token_price';

export default toolSchemas;
