import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { env } from '../config/env.js';

// Solana connection singleton
let connection: Connection | null = null;

function getConnection(): Connection {
  if (!connection) {
    connection = new Connection(env.SOLANA_RPC_URL, 'confirmed');
  }
  return connection;
}

/**
 * Validate a Solana address (base58 public key)
 */
export function isValidSolanaAddress(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get SOL balance for an address
 */
export async function getSolanaBalance(address: string): Promise<{
  success: boolean;
  balance?: number;
  balanceLamports?: number;
  error?: string;
}> {
  if (!isValidSolanaAddress(address)) {
    return {
      success: false,
      error: 'Invalid Solana address format',
    };
  }

  try {
    const conn = getConnection();
    const publicKey = new PublicKey(address);
    const balanceLamports = await conn.getBalance(publicKey);
    const balance = balanceLamports / LAMPORTS_PER_SOL;

    return {
      success: true,
      balance,
      balanceLamports,
    };
  } catch (error) {
    console.error('Failed to get Solana balance:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch balance',
    };
  }
}

/**
 * Get token supply for a mint address
 */
export async function getTokenSupply(mint: string): Promise<{
  success: boolean;
  supply?: number;
  decimals?: number;
  error?: string;
}> {
  if (!isValidSolanaAddress(mint)) {
    return {
      success: false,
      error: 'Invalid mint address format',
    };
  }

  try {
    const conn = getConnection();
    const publicKey = new PublicKey(mint);
    const supplyInfo = await conn.getTokenSupply(publicKey);

    return {
      success: true,
      supply: supplyInfo.value.uiAmount ?? 0,
      decimals: supplyInfo.value.decimals,
    };
  } catch (error) {
    console.error('Failed to get token supply:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch token supply',
    };
  }
}

export default { getSolanaBalance, getTokenSupply, isValidSolanaAddress };
