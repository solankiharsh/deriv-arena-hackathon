/**
 * Optional on-chain ETH / USDC wallet.
 */

import {
  createPublicClient,
  createWalletClient,
  http,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  CHAINS,
  NETWORK,
  CURRENCY,
  WALLET_PRIVATE_KEY,
  API_URL,
  TOKEN_CONTRACT,
  TOKEN_DECIMALS,
  MAX_AUTO_USDC_SEND,
  ERC20_ABI,
  formatUnits,
  parseUnits,
} from "../config.js";

export function log(message) {
  console.error(`[derivarena-agent] ${message}`);
}

export function getExplorerUrl(txHash) {
  const map = {
    mainnet: `https://etherscan.io/tx/${txHash}`,
    sepolia: `https://sepolia.etherscan.io/tx/${txHash}`,
    base: `https://basescan.org/tx/${txHash}`,
    "base-sepolia": `https://sepolia.basescan.org/tx/${txHash}`,
  };
  return map[NETWORK] || `https://basescan.org/tx/${txHash}`;
}

let wallet = null;
let publicClient = null;
let walletClient = null;

if (WALLET_PRIVATE_KEY) {
  try {
    const chain = CHAINS[NETWORK] || CHAINS["base-sepolia"];
    const pk = WALLET_PRIVATE_KEY.startsWith("0x")
      ? WALLET_PRIVATE_KEY
      : `0x${WALLET_PRIVATE_KEY}`;
    wallet = privateKeyToAccount(pk);
    publicClient = createPublicClient({ chain, transport: http() });
    walletClient = createWalletClient({
      account: wallet,
      chain,
      transport: http(),
    });
    log(`Wallet loaded ${wallet.address.slice(0, 10)}… on ${NETWORK}`);
  } catch (e) {
    log(`Invalid WALLET_PRIVATE_KEY: ${e.message}`);
    wallet = null;
  }
} else {
  log("No WALLET_PRIVATE_KEY — on-chain tools return guidance only");
}

export const TOOLS = [
  {
    name: "arena_onchain_wallet",
    description:
      "Show ETH and USDC (or X402_CURRENCY) balances for the agent wallet. Requires WALLET_PRIVATE_KEY in the MCP server env.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "arena_onchain_send_usdc",
    description:
      `Send USDC (payment token) to an address. Refuses if amount > MAX_AUTO_USDC_SEND (${MAX_AUTO_USDC_SEND}) unless max_usdc_override is set with user consent.`,
    inputSchema: {
      type: "object",
      properties: {
        to: { type: "string", description: "0x recipient" },
        amount: { type: "string", description: "Human amount e.g. 1.25" },
        max_usdc_override: { type: "number" },
      },
      required: ["to", "amount"],
    },
  },
];

async function getWalletBalance() {
  if (!wallet || !publicClient) {
    return {
      error:
        "No on-chain wallet configured. Set WALLET_PRIVATE_KEY for the MCP process",
      derivarena_api: API_URL,
      hint: "For in-app balances use arena_miles_balance with user_id.",
    };
  }
  const nativeBalance = await publicClient.getBalance({
    address: wallet.address,
  });
  let tokenBalance = 0n;
  const isNative =
    TOKEN_CONTRACT === "0x0000000000000000000000000000000000000000" ||
    CURRENCY === "ETH";
  if (!isNative) {
    tokenBalance = await publicClient.readContract({
      address: TOKEN_CONTRACT,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [wallet.address],
    });
  }
  const ethDisplay = formatUnits(nativeBalance, 18);
  const tokenDisplay = isNative ? null : formatUnits(tokenBalance, TOKEN_DECIMALS);
  return {
    wallet: wallet.address,
    network: NETWORK,
    payment_currency: CURRENCY,
    token_contract: TOKEN_CONTRACT,
    balances: {
      ETH: ethDisplay,
      ...(tokenDisplay != null ? { [CURRENCY]: tokenDisplay } : {}),
    },
    max_auto_usdc_send: MAX_AUTO_USDC_SEND,
    derivarena_api: API_URL,
  };
}

async function sendUsdc({ to, amount, max_usdc_override }) {
  if (!wallet || !walletClient || !publicClient) {
    return { error: "No wallet configured" };
  }
  const amt = parseFloat(String(amount));
  if (!Number.isFinite(amt) || amt <= 0) {
    return { error: "Invalid amount" };
  }
  const cap =
    typeof max_usdc_override === "number" && max_usdc_override > 0
      ? max_usdc_override
      : MAX_AUTO_USDC_SEND;
  if (amt > cap) {
    return {
      error: `Amount ${amt} exceeds cap ${cap}. User must explicitly allow max_usdc_override.`,
    };
  }
  if (
    TOKEN_CONTRACT === "0x0000000000000000000000000000000000000000" ||
    CURRENCY === "ETH"
  ) {
    return { error: "arena_onchain_send_usdc requires ERC20 USDC configuration" };
  }
  const value = parseUnits(String(amt), TOKEN_DECIMALS);
  log(`Sending ${amt} ${CURRENCY} to ${to}`);
  const txHash = await walletClient.writeContract({
    address: TOKEN_CONTRACT,
    abi: ERC20_ABI,
    functionName: "transfer",
    args: [to, value],
  });
  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
    timeout: 60_000,
  });
  if (receipt.status === "reverted") {
    return { success: false, error: "Transaction reverted", txHash };
  }
  return {
    success: true,
    to,
    amount: amt,
    currency: CURRENCY,
    txHash,
    explorer: getExplorerUrl(txHash),
    network: NETWORK,
  };
}

export const handlers = {
  arena_onchain_wallet: () => getWalletBalance(),
  arena_onchain_send_usdc: (args) => sendUsdc(args || {}),
};
