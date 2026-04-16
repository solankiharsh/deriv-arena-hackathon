#!/usr/bin/env node
/**
 * DerivArena MCP — STDIO protocol + CLI (mcp-client pattern).
 */

import { createInterface } from "readline";
import { API_URL, MAX_AUTO_MILES, MAX_AUTO_USDC_SEND } from "./config.js";
import { log } from "./tools/onchain.js";

import * as competitions from "./tools/competitions.js";
import * as miles from "./tools/miles.js";
import * as onchain from "./tools/onchain.js";

export const TOOLS = [
  ...competitions.TOOLS,
  ...miles.TOOLS,
  ...onchain.TOOLS,
];

const allHandlers = {
  ...competitions.handlers,
  ...miles.handlers,
  ...onchain.handlers,
};

export async function handleTool(name, args) {
  try {
    const fn = allHandlers[name];
    if (fn) return await fn(args);
    return { error: `Unknown tool: ${name}` };
  } catch (err) {
    log(`Error in ${name}: ${err.message}`);
    return { error: err.message, tool: name };
  }
}

const CLI_MAP = {
  "list-competitions": "arena_list_competitions",
  "search-competitions": "arena_search_competitions",
  "get-competition": "arena_get_competition",
  "join-competition": "arena_join_competition",
  "list-catalog": "arena_list_miles_catalog",
  "search-catalog": "arena_search_miles_catalog",
  "miles-balance": "arena_miles_balance",
  "preview-redeem": "arena_preview_miles_redemption",
  redeem: "arena_redeem_miles",
  "onchain-wallet": "arena_onchain_wallet",
  "send-usdc": "arena_onchain_send_usdc",
};

const cliCommand = process.argv[2];

function parseCliArgs() {
  const raw = process.argv[3];
  let args = {};
  if (raw) {
    try {
      args = JSON.parse(raw);
    } catch {
      for (let i = 3; i < process.argv.length; i++) {
        const [key, ...rest] = process.argv[i].split("=");
        if (key && rest.length) args[key] = rest.join("=");
      }
    }
  } else {
    for (let i = 3; i < process.argv.length; i++) {
      const [key, ...rest] = process.argv[i].split("=");
      if (key && rest.length) args[key] = rest.join("=");
    }
  }
  return args;
}

if (cliCommand && CLI_MAP[cliCommand]) {
  const toolName = CLI_MAP[cliCommand];
  const args = parseCliArgs();
  (async () => {
    try {
      const result = await handleTool(toolName, args);
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    } catch (err) {
      console.error(JSON.stringify({ error: err.message }));
      process.exit(1);
    }
  })();
} else if (cliCommand === "help" || cliCommand === "--help") {
  console.log(`DerivArena agent MCP / CLI

API: ${API_URL}
Miles auto cap: MAX_AUTO_MILES_REDEEM=${MAX_AUTO_MILES}
USDC send cap: MAX_AUTO_USDC_SEND=${MAX_AUTO_USDC_SEND}

Usage: node derivarena-agent.js <command> [json-args]

Commands:
  list-competitions     { "status": "active" }
  search-competitions   { "query": "weekend" }
  get-competition       { "id": "<uuid>" }
  join-competition      { "competition_id": "<uuid>", "trader_id": "…", "trader_name": "…" }
  list-catalog          { "user_id": "…", "category": "" }
  search-catalog        { "query": "coaching", "user_id": "…" }
  miles-balance         { "user_id": "…" }
  preview-redeem        { "user_id": "…", "item_id": "…", "quantity": 1 }
  redeem                { "user_id": "…", "item_id": "…", "confirm": true }
  onchain-wallet        { }
  send-usdc             { "to": "0x…", "amount": "1.0" }

OpenClaw: register this file as an MCP server (see openclaw-example.json).
`);
  process.exit(0);
} else if (cliCommand) {
  console.error(`Unknown command: ${cliCommand}. Use --help.`);
  process.exit(1);
} else {
  const rl = createInterface({ input: process.stdin, terminal: false });

  rl.on("line", async (line) => {
    try {
      const request = JSON.parse(line);
      const { method, params, id } = request;
      let response;

      switch (method) {
        case "initialize": {
          const clientVersion = params?.protocolVersion || "2024-11-05";
          response = {
            jsonrpc: "2.0",
            id,
            result: {
              protocolVersion: clientVersion,
              capabilities: { tools: {} },
              serverInfo: { name: "derivarena-agent", version: "1.0.0" },
            },
          };
          break;
        }
        case "notifications/initialized":
          return;
        case "tools/list":
          response = {
            jsonrpc: "2.0",
            id,
            result: { tools: TOOLS },
          };
          break;
        case "tools/call": {
          const result = await handleTool(
            params.name,
            params.arguments || {}
          );
          response = {
            jsonrpc: "2.0",
            id,
            result: {
              content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
            },
          };
          break;
        }
        default:
          response = {
            jsonrpc: "2.0",
            id,
            error: { code: -32601, message: `Unknown method: ${method}` },
          };
      }
      console.log(JSON.stringify(response));
    } catch {
      console.log(
        JSON.stringify({
          jsonrpc: "2.0",
          id: null,
          error: { code: -32700, message: "Parse error" },
        })
      );
    }
  });

  log("══════════════════════════════════════");
  log(`  DerivArena MCP ready — API ${API_URL}`);
  log("══════════════════════════════════════");
}
