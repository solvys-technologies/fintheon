// [claude-code 2026-03-13] Hyperliquid EIP-712 wallet auth for exchange actions
/**
 * Hyperliquid Auth
 * Derives wallet address from HYPERLIQUID_PRIVATE_KEY and signs
 * exchange actions using EIP-712 typed data (Hyperliquid's phantomAgent domain).
 */

import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { type Hex, encodePacked, keccak256, toHex } from "viem";

// Hyperliquid chain IDs
const MAINNET_CHAIN_ID = 42161; // Arbitrum One
const TESTNET_CHAIN_ID = 421614; // Arbitrum Sepolia

function getChainId(): number {
  return process.env.HYPERLIQUID_TESTNET === "true"
    ? TESTNET_CHAIN_ID
    : MAINNET_CHAIN_ID;
}

let cachedAccount: PrivateKeyAccount | null = null;

function getAccount(): PrivateKeyAccount {
  if (cachedAccount) return cachedAccount;

  const pk = process.env.HYPERLIQUID_PRIVATE_KEY;
  if (!pk) throw new Error("HYPERLIQUID_PRIVATE_KEY not set");

  cachedAccount = privateKeyToAccount(pk as Hex);
  return cachedAccount;
}

export function hasCredentials(): boolean {
  return Boolean(process.env.HYPERLIQUID_PRIVATE_KEY);
}

export function getWalletAddress(): string {
  return getAccount().address;
}

export function getVaultAddress(): string | undefined {
  return process.env.HYPERLIQUID_VAULT_ADDRESS || undefined;
}

/**
 * Compute the connection ID (source + nonce hash) used in Hyperliquid's
 * phantomAgent EIP-712 signing scheme.
 */
function connectionId(
  action: Record<string, unknown>,
  nonce: number,
  vaultAddress?: string,
): Hex {
  const source = vaultAddress
    ? keccak256(
        encodePacked(
          ["address", "address"],
          [(action.type as Hex) ?? "0x0", vaultAddress as Hex],
        ),
      )
    : keccak256(encodePacked(["string"], ["a"]));
  return keccak256(
    encodePacked(["bytes32", "uint64"], [source, BigInt(nonce)]),
  ) as Hex;
}

/**
 * Sign an exchange action using EIP-712 typed data.
 * Returns { r, s, v } signature for the /exchange endpoint.
 */
export async function signAction(
  action: Record<string, unknown>,
  nonce: number,
  vaultAddress?: string,
): Promise<{ r: Hex; s: Hex; v: number }> {
  const account = getAccount();
  const chainId = getChainId();

  const domain = {
    name: "Exchange",
    version: "1",
    chainId,
    verifyingContract: "0x0000000000000000000000000000000000000000" as Hex,
  } as const;

  const types = {
    Agent: [
      { name: "source", type: "string" },
      { name: "connectionId", type: "bytes32" },
    ],
  } as const;

  const cid = connectionId(action, nonce, vaultAddress);

  const signature = await account.signTypedData({
    domain,
    types,
    primaryType: "Agent",
    message: {
      source: vaultAddress
        ? keccak256(
            encodePacked(
              ["address", "address"],
              [(action.type as Hex) ?? "0x0", vaultAddress as Hex],
            ),
          )
        : "a",
      connectionId: cid,
    },
  });

  // Parse r, s, v from the 65-byte signature
  const r = `0x${signature.slice(2, 66)}` as Hex;
  const s = `0x${signature.slice(66, 130)}` as Hex;
  const v = parseInt(signature.slice(130, 132), 16);

  return { r, s, v };
}

/**
 * Generate a nonce for exchange requests (millisecond timestamp).
 */
export function generateNonce(): number {
  return Date.now();
}
