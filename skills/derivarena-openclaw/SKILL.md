---
name: derivarena-openclaw
description: >
  Operate DerivArena from an OpenClaw-backed agent: list/search trading competitions,
  browse Deriv Miles catalog, preview and redeem rewards, optional ETH/USDC wallet tools.
version: 1.0.0
metadata:
  openclaw:
    requires:
      env:
        - DERIVARENA_API_URL
      bins:
        - node
    primaryEnv: DERIVARENA_API_URL
    emoji: "🎯"
    homepage: https://github.com/solankiharsh/deriv-arena-hackathon
---

# DerivArena — OpenClaw / MCP skill

This skill pairs with the MCP server in `mcp-client/derivarena-agent.js`.

For the full **Search / Preview / Confirm / Pay / Deliver** matrix, **CLI command list**, **11-tool MCP table**, **OpenClaw + Claude Desktop JSON samples**, and **demo prompts**, see the repository README section **AI agents: OpenClaw, MCP & Telegram**.

## Natural language → tools (Telegram-style flows)

| User says | Tool |
|-----------|------|
| “What competitions are available?” | `arena_list_competitions` |
| “Search competitions for …” | `arena_search_competitions` |
| “Details on competition …” | `arena_get_competition` |
| “What can I redeem with Miles?” | `arena_list_miles_catalog` (pass `user_id` when known for tier pricing) |
| “Search Miles catalog for …” | `arena_search_miles_catalog` |
| “How many Miles do I have?” | `arena_miles_balance` |
| “Preview redeeming …” | `arena_preview_miles_redemption` |
| “Redeem …” (after explicit yes) | `arena_redeem_miles` with **`confirm: true`** only |
| “Check my on-chain wallet” | `arena_onchain_wallet` (needs `WALLET_PRIVATE_KEY`) |
| “Send USDC to …” | `arena_onchain_send_usdc` (respects caps; user must confirm amount) |

## Safety

- **Miles:** Never call `arena_redeem_miles` unless the user clearly confirmed. The tool rejects `confirm: false` or missing `confirm`.
- **Miles caps:** Redemptions above `MAX_AUTO_MILES_REDEEM` require `max_miles_override` with user consent.
- **USDC:** Sends above `MAX_AUTO_USDC_SEND` require `max_usdc_override` with user consent.
- **Secrets:** Never commit real private keys. Use OpenClaw / gateway env or a secret manager.

## Install into OpenClaw workspace

From the DerivArena repo root (adjust paths if you copy only `skills/` + `mcp-client/`):

```bash
mkdir -p ~/.openclaw/skills/derivarena-openclaw
cp -r skills/derivarena-openclaw/* ~/.openclaw/skills/derivarena-openclaw/
# Keep mcp-client on disk where openclaw.json can point node at it, or copy:
# cp -r mcp-client ~/.openclaw/derivarena-mcp-client
```

Merge `mcpServers.derivarena` from `openclaw-example.json` into your OpenClaw config, fixing `args` to an **absolute** path to `derivarena-agent.js`.

Set `DERIVARENA_API_URL` to your running API (e.g. `http://localhost:8090`).

Then start your gateway (e.g. `openclaw gateway`) and use your Telegram bot that is wired to that gateway.

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `DERIVARENA_API_URL` | Yes | Base URL of the Go API (no trailing slash) |
| `WALLET_PRIVATE_KEY` | No | For `arena_onchain_wallet` / `arena_onchain_send_usdc` |
| `X402_CHAIN` | No | Default `base-sepolia` |
| `X402_CURRENCY` | No | Default `USDC` |
| `MAX_AUTO_MILES_REDEEM` | No | Default `5000` |
| `MAX_AUTO_USDC_SEND` | No | Default `10.00` |

## CLI smoke test

```bash
cd mcp-client && npm install
DERIVARENA_API_URL=http://localhost:8090 node derivarena-agent.js list-competitions
```
