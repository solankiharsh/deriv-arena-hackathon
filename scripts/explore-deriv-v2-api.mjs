#!/usr/bin/env node
/**
 * DerivArena — Deriv API V2 Explorer
 *
 * Uses Node 18+ built-in fetch + built-in WebSocket (Node 21+).
 * Node 24 (detected in this repo) supports both natively.
 *
 * Usage:
 *   DERIV_PAT=<token> DERIV_APP_ID=<appId> node scripts/explore-deriv-v2-api.mjs
 *
 * Integrator context: docs/DERIV_V2_API_IMPLEMENTATION.md
 */

"use strict";

const REST_BASE = "https://api.derivws.com";
const WS_PUBLIC = "wss://api.derivws.com/trading/v1/options/ws/public";

// ---------------------------------------------------------------------------
// Config — reads from env; falls back to values provided for local testing.
// ---------------------------------------------------------------------------
function getConfig() {
  const pat = process.env.DERIV_PAT;
  const appId = process.env.DERIV_APP_ID || "1089";

  if (!pat) {
    console.error(
      "Missing DERIV_PAT environment variable.\n" +
        "Set it with: export DERIV_PAT=your_personal_access_token\n" +
        "Or pass inline: DERIV_PAT=... node scripts/explore-deriv-v2-api.mjs"
    );
    process.exit(1);
  }

  return { pat, appId };
}

function authHeaders(pat, appId) {
  return {
    Authorization: `Bearer ${pat}`,
    "Deriv-App-ID": appId,
    "Content-Type": "application/json",
  };
}

// ---------------------------------------------------------------------------
// REST helpers
// ---------------------------------------------------------------------------
async function restGet(path, pat, appId) {
  const url = `${REST_BASE}${path}`;
  const res = await fetch(url, {
    method: "GET",
    headers: authHeaders(pat, appId),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`REST GET ${path} failed (${res.status}): ${body}`);
  }

  return res.json();
}

async function restPost(path, pat, appId, body) {
  const url = `${REST_BASE}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: authHeaders(pat, appId),
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`REST POST ${path} failed (${res.status}): ${text}`);
  }

  return res.json();
}

// ---------------------------------------------------------------------------
// WebSocket helpers (uses Node 21+ global WebSocket)
// ---------------------------------------------------------------------------
function wsConnect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error(`WebSocket connection to ${url} timed out`));
    }, 10_000);

    ws.addEventListener("open", () => {
      clearTimeout(timer);
      resolve(ws);
    });
    ws.addEventListener("error", (ev) => {
      clearTimeout(timer);
      reject(ev.error ?? new Error("WebSocket error"));
    });
  });
}

function wsSend(ws, payload) {
  ws.send(JSON.stringify(payload));
}

function wsWait(ws, predicate, timeoutMs = 15_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("WebSocket response timed out"));
    }, timeoutMs);

    function handler(ev) {
      const msg = JSON.parse(ev.data);
      if (predicate(msg)) {
        cleanup();
        resolve(msg);
      }
    }

    function cleanup() {
      clearTimeout(timer);
      ws.removeEventListener("message", handler);
    }

    ws.addEventListener("message", handler);
  });
}

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------
function divider(title) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${"=".repeat(60)}`);
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------
async function healthCheck() {
  divider("1. HEALTH CHECK");
  const res = await fetch(`${REST_BASE}/v1/health`);
  console.log("Status:", res.status === 200 ? "OK" : `DOWN (${res.status})`);
  try {
    const parsed = await res.json();
    console.log("Response:", JSON.stringify(parsed, null, 2));
  } catch {
    console.log("Response:", await res.text().catch(() => "(empty)"));
  }
}

async function listAccounts(pat, appId) {
  divider("2. LIST ACCOUNTS (REST)");
  const result = await restGet("/trading/v1/options/accounts", pat, appId);
  let accounts = result.data;

  if (!Array.isArray(accounts) || accounts.length === 0) {
    console.log("No accounts found. Creating a demo account...");
    const created = await restPost(
      "/trading/v1/options/accounts",
      pat,
      appId,
      { currency: "USD", group: "row", account_type: "demo" }
    );
    console.log("Created:", JSON.stringify(created.data, null, 2));
    accounts = Array.isArray(created.data) ? created.data : [created.data];
  } else {
    for (const acct of accounts) {
      console.log(
        `  ${acct.account_id} | ${acct.account_type} | ${acct.currency} | ` +
          `$${acct.balance} | ${acct.status}`
      );
    }
    console.log(`Total: ${accounts.length} account(s)`);
  }

  return accounts;
}

async function getOtp(accountId, pat, appId) {
  divider("3. GET OTP FOR WEBSOCKET AUTH");
  const result = await restPost(
    `/trading/v1/options/accounts/${accountId}/otp`,
    pat,
    appId
  );
  const wsUrl = result.data.url;
  console.log("Authenticated WS URL obtained (OTP embedded)");
  return wsUrl;
}

async function publicWsDemo() {
  divider("4. PUBLIC WEBSOCKET — Market Data");
  const ws = await wsConnect(WS_PUBLIC);
  console.log("Connected to public WS");

  try {
    // --- ping ---
    wsSend(ws, { ping: 1, req_id: 1 });
    const pong = await wsWait(ws, (m) => m.msg_type === "ping");
    console.log("Ping/Pong:", JSON.stringify(pong));

    // --- server time ---
    wsSend(ws, { time: 1, req_id: 2 });
    const timeMsg = await wsWait(ws, (m) => m.msg_type === "time");
    console.log(
      "Server time:",
      new Date(timeMsg.time * 1000).toISOString()
    );

    // --- active symbols ---
    wsSend(ws, { active_symbols: "brief", req_id: 3 });
    const symMsg = await wsWait(ws, (m) => m.msg_type === "active_symbols");
    const symList = symMsg.active_symbols ?? [];
    console.log(`\nActive symbols: ${symList.length} total`);
    const synthetics = symList.filter((s) => s.market === "synthetic_index");
    console.log(`Synthetic indices: ${synthetics.length}`);
    for (const s of synthetics.slice(0, 8)) {
      console.log(`  ${s.underlying_symbol} — ${s.underlying_symbol_name}`);
    }
    if (synthetics.length > 8) {
      console.log(`  ... and ${synthetics.length - 8} more`);
    }

    // --- contracts list ---
    wsSend(ws, { contracts_list: 1, req_id: 4 });
    const clMsg = await wsWait(ws, (m) => m.msg_type === "contracts_list");
    const cats = clMsg.contracts_list ?? [];
    console.log(`\nContract categories: ${cats.length}`);
    for (const cat of cats) {
      console.log(`  ${cat.display_name}: ${(cat.contract_types ?? []).join(", ")}`);
    }

    // --- contracts for a specific symbol ---
    const targetSymbol =
      synthetics.length > 0 ? synthetics[0].underlying_symbol : "1HZ100V";
    wsSend(ws, { contracts_for: targetSymbol, req_id: 5 });
    const cForMsg = await wsWait(ws, (m) => m.msg_type === "contracts_for");
    const available = cForMsg.contracts_for?.available ?? [];
    console.log(`\nContracts for ${targetSymbol}: ${available.length} types`);
    const types = [...new Set(available.map((a) => a.contract_type))];
    console.log(`  Types: ${types.join(", ")}`);

    // --- tick subscription (5 ticks) ---
    console.log(`\nSubscribing to ticks for ${targetSymbol} (5 ticks)...`);
    wsSend(ws, { ticks: targetSymbol, subscribe: 1, req_id: 6 });

    let tickCount = 0;
    let subId = "";
    await new Promise((resolve) => {
      function onTick(ev) {
        const msg = JSON.parse(ev.data);
        if (msg.msg_type !== "tick") return;
        tickCount++;
        if (msg.subscription?.id) subId = msg.subscription.id;
        const tick = msg.tick ?? {};
        console.log(
          `  Tick ${tickCount}: ${tick.symbol} = ${tick.quote} @ ${new Date(
            tick.epoch * 1000
          ).toISOString()}`
        );
        if (tickCount >= 5) {
          ws.removeEventListener("message", onTick);
          resolve();
        }
      }
      ws.addEventListener("message", onTick);
    });

    if (subId) {
      wsSend(ws, { forget: subId, req_id: 7 });
      console.log("Unsubscribed from tick stream");
    }

    // --- ticks history ---
    console.log(`\nFetching tick history for ${targetSymbol} (last 10)...`);
    wsSend(ws, {
      ticks_history: targetSymbol,
      adjust_start_time: 1,
      count: 10,
      end: "latest",
      style: "ticks",
      req_id: 8,
    });
    const histMsg = await wsWait(ws, (m) => m.msg_type === "history");
    const prices = histMsg.history?.prices ?? [];
    const times = histMsg.history?.times ?? [];
    console.log(`History points: ${prices.length}`);
    for (let i = 0; i < Math.min(prices.length, 5); i++) {
      console.log(
        `  ${new Date(times[i] * 1000).toISOString()} — ${prices[i]}`
      );
    }
  } finally {
    ws.close();
    console.log("\nPublic WS closed");
  }
}

async function authenticatedWsDemo(wsUrl, accountId) {
  divider("5. AUTHENTICATED WEBSOCKET — Account Data");
  const ws = await wsConnect(wsUrl);
  console.log(`Connected to authenticated WS for ${accountId}`);

  try {
    // --- balance ---
    wsSend(ws, { balance: 1, req_id: 10 });
    const balMsg = await wsWait(ws, (m) => m.msg_type === "balance");
    if (balMsg.error) throw new Error(balMsg.error.message);
    const bal = balMsg.balance ?? {};
    console.log(
      `\nBalance: $${bal.balance} ${bal.currency} (${bal.loginid})`
    );

    // --- portfolio ---
    wsSend(ws, { portfolio: 1, req_id: 11 });
    const portMsg = await wsWait(ws, (m) => m.msg_type === "portfolio");
    const contracts = portMsg.portfolio?.contracts ?? [];
    console.log(`\nOpen positions: ${contracts.length}`);
    if (contracts.length > 0) {
      console.log(JSON.stringify(contracts.slice(0, 3), null, 2));
    }

    // --- profit table ---
    wsSend(ws, {
      profit_table: 1,
      limit: 10,
      description: 1,
      req_id: 12,
    });
    const profMsg = await wsWait(ws, (m) => m.msg_type === "profit_table");
    const profData = profMsg.profit_table ?? {};
    const profTxns = profData.transactions ?? [];
    console.log(`\nProfit table: ${profData.count ?? 0} total trades`);
    for (const tx of profTxns.slice(0, 5)) {
      const pnl = (tx.sell_price ?? 0) - (tx.buy_price ?? 0);
      console.log(
        `  ${tx.contract_type} | buy $${tx.buy_price} → sell $${tx.sell_price} | ` +
          `P&L: ${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)} | ` +
          `${new Date((tx.sell_time ?? 0) * 1000).toLocaleDateString()}`
      );
    }

    // --- statement ---
    wsSend(ws, {
      statement: 1,
      limit: 10,
      description: 1,
      req_id: 13,
    });
    const stmtMsg = await wsWait(ws, (m) => m.msg_type === "statement");
    const stmtData = stmtMsg.statement ?? {};
    const stmtTxns = stmtData.transactions ?? [];
    console.log(`\nStatement: ${stmtData.count ?? 0} total entries`);
    for (const tx of stmtTxns.slice(0, 5)) {
      console.log(
        `  ${tx.action_type} | $${tx.amount} | balance: $${tx.balance_after} | ` +
          `${new Date((tx.transaction_time ?? 0) * 1000).toLocaleDateString()}`
      );
    }

    // --- proposal (no purchase) ---
    console.log("\nPlacing a test proposal (no purchase)...");
    wsSend(ws, {
      proposal: 1,
      amount: 10,
      basis: "stake",
      contract_type: "CALL",
      currency: "USD",
      duration: 5,
      duration_unit: "t",
      underlying_symbol: "1HZ100V",
      req_id: 14,
    });
    const propMsg = await wsWait(ws, (m) => m.msg_type === "proposal");
    if (propMsg.error) {
      console.log("Proposal error:", propMsg.error.message);
    } else {
      const p = propMsg.proposal ?? {};
      console.log(`  Proposal ID: ${p.id}`);
      console.log(`  Ask price:   $${p.ask_price}`);
      console.log(`  Payout:      $${p.payout}`);
      console.log(`  Spot:        ${p.spot}`);
      console.log(`  Description: ${p.longcode}`);
      if (p.id) {
        wsSend(ws, { forget: p.id, req_id: 15 });
        console.log("  Proposal forgotten (not purchased)");
      }
    }
  } finally {
    ws.close();
    console.log("\nAuthenticated WS closed");
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("DerivArena — Deriv API V2 Explorer");
  console.log("===================================\n");

  const { pat, appId } = getConfig();
  console.log(`App ID: ${appId}`);
  console.log(`PAT:    ***${pat.slice(-6)}`);

  await healthCheck();

  let accounts = [];
  try {
    accounts = await listAccounts(pat, appId);
  } catch (err) {
    console.log(`\nAuth error: ${err.message}`);
    console.log(
      "The PAT may be invalid, expired, or missing required scopes (trade).\n" +
        "Generate a new PAT at: https://app.deriv.com/account/api-token\n" +
        "Continuing with public (unauthenticated) endpoints...\n"
    );
  }

  await publicWsDemo();

  const demoAccounts = accounts.filter((a) => a.account_type === "demo");
  if (demoAccounts.length > 0) {
    try {
      const accountId = demoAccounts[0].account_id;
      const wsUrl = await getOtp(accountId, pat, appId);
      await authenticatedWsDemo(wsUrl, accountId);
    } catch (err) {
      console.log(`\nAuth WS error: ${err.message}`);
    }
  } else if (accounts.length === 0) {
    console.log("\nSkipping authenticated WS (no accounts due to auth error).");
  } else {
    console.log("\nNo demo accounts available for authenticated WS test.");
  }

  divider("DONE");
  console.log("V2 API exploration complete.\n");
  console.log("Endpoints exercised:");
  console.log("  REST:  GET  /v1/health");
  if (accounts.length > 0) {
    console.log("  REST:  GET  /trading/v1/options/accounts");
    console.log("  REST:  POST /trading/v1/options/accounts/{id}/otp");
    console.log(
      "  WS:    wss://.../ws/demo?otp=...  (balance, portfolio,\n" +
        "         profit_table, statement, proposal)"
    );
  }
  console.log(
    "  WS:    wss://.../ws/public  (ping, time, active_symbols,\n" +
      "         contracts_list, contracts_for, ticks, history)"
  );
}

main().catch((err) => {
  console.error("\nFatal error:", err.message ?? err);
  process.exit(1);
});
