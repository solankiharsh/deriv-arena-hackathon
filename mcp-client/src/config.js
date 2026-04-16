/**
 * Environment for DerivArena MCP client.
 */

import {
  mainnet,
  sepolia,
  base,
  baseSepolia,
} from "viem/chains";

export const API_URL = (
  process.env.DERIVARENA_API_URL ||
  process.env.DERIVARENA_SERVER ||
  "http://localhost:8090"
).replace(/\/$/, "");

/** Max single redemption (miles) without explicit user override in tool args. */
export const MAX_AUTO_MILES = parseFloat(
  process.env.MAX_AUTO_MILES_REDEEM || "5000"
);

export const WALLET_PRIVATE_KEY = process.env.WALLET_PRIVATE_KEY || "";
export const NETWORK = process.env.X402_CHAIN || process.env.ETH_NETWORK || "base-sepolia";
export const CURRENCY = process.env.X402_CURRENCY || "USDC";
export const TOKEN_ADDRESS = process.env.X402_TOKEN_ADDRESS || "";
export const TOKEN_DECIMALS = (() => {
  if (process.env.X402_TOKEN_DECIMALS) {
    const n = parseInt(process.env.X402_TOKEN_DECIMALS, 10);
    if (!Number.isNaN(n)) return n;
  }
  return CURRENCY === "USDC" || CURRENCY === "USDT" ? 6 : 18;
})();

export const MAX_AUTO_USDC_SEND = parseFloat(
  process.env.MAX_AUTO_USDC_SEND || "10.00"
);

export const CHAINS = {
  mainnet,
  sepolia,
  base,
  "base-sepolia": baseSepolia,
};

export const TOKEN_ADDRESSES = {
  mainnet: { USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" },
  sepolia: { USDC: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238" },
  base: { USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" },
  "base-sepolia": { USDC: "0xa059e27967e5a573a14a62c706ebd1be75333f9a" },
};

export function getTokenContract() {
  if (TOKEN_ADDRESS) return TOKEN_ADDRESS;
  const row = TOKEN_ADDRESSES[NETWORK];
  if (row && row[CURRENCY]) return row[CURRENCY];
  return "0x0000000000000000000000000000000000000000";
}

export const TOKEN_CONTRACT = getTokenContract();

export const ERC20_ABI = [
  {
    name: "transfer",
    type: "function",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    name: "balanceOf",
    type: "function",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
];

export { parseUnits, formatUnits } from "viem";
