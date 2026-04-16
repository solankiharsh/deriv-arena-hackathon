/**
 * Deriv Miles catalog & redemption (maps to list/search/buy preview/confirm flows).
 */

import { API_URL, MAX_AUTO_MILES } from "../config.js";

export const TOOLS = [
  {
    name: "arena_list_miles_catalog",
    description:
      "List redeemable Miles catalog items with tier-adjusted prices (final_cost in miles). Pass user_id for personalized pricing when known.",
    inputSchema: {
      type: "object",
      properties: {
        user_id: {
          type: "string",
          description: "Arena / trader user id for tier-based final_cost",
        },
        category: {
          type: "string",
          description: "Optional category filter (e.g. premium_feature, marketplace_item)",
        },
      },
      required: [],
    },
  },
  {
    name: "arena_search_miles_catalog",
    description: "Search catalog items by keyword in name or description.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        user_id: { type: "string" },
        category: { type: "string" },
      },
      required: ["query"],
    },
  },
  {
    name: "arena_miles_balance",
    description:
      "Get Deriv Miles balance and tier for a user_id (in-app wallet analogue).",
    inputSchema: {
      type: "object",
      properties: {
        user_id: { type: "string" },
      },
      required: ["user_id"],
    },
  },
  {
    name: "arena_preview_miles_redemption",
    description:
      "Preview cost for redeeming a catalog item: final miles cost, user balance, whether they can afford it. Does not spend miles.",
    inputSchema: {
      type: "object",
      properties: {
        user_id: { type: "string" },
        item_id: { type: "string" },
        quantity: { type: "number", description: "Defaults to 1" },
      },
      required: ["user_id", "item_id"],
    },
  },
  {
    name: "arena_redeem_miles",
    description:
      `Redeem miles for a catalog item. SECURITY: only executes when confirm is explicitly true. Refuses if total miles cost exceeds MAX_AUTO_MILES_REDEEM (${MAX_AUTO_MILES}) unless max_miles_override is set higher by the user.`,
    inputSchema: {
      type: "object",
      properties: {
        user_id: { type: "string" },
        item_id: { type: "string" },
        quantity: { type: "number" },
        confirm: {
          type: "boolean",
          description: "Must be true after user confirms in chat",
        },
        max_miles_override: {
          type: "number",
          description: "Optional higher cap when user explicitly agrees",
        },
      },
      required: ["user_id", "item_id", "confirm"],
    },
  },
];

async function fetchJson(path, options = {}) {
  const url = `${API_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    return {
      error: true,
      status: res.status,
      message: typeof data === "string" ? data : data?.message || res.statusText,
      data,
    };
  }
  return data;
}

function parseMiles(v) {
  if (v == null) return 0;
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

async function listCatalog({ user_id = "", category = "" } = {}) {
  const q = new URLSearchParams();
  if (user_id) q.set("user_id", user_id);
  if (category) q.set("category", category);
  const path = `/api/miles/catalog${q.toString() ? `?${q}` : ""}`;
  const data = await fetchJson(path);
  if (data?.error) return data;
  const rows = Array.isArray(data) ? data : [];
  return {
    serverUrl: API_URL,
    count: rows.length,
    items: rows.map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      description: r.description,
      base_cost: r.base_cost,
      final_cost: r.final_cost,
      discount: r.discount,
      available: r.available,
      stock_quantity: r.stock_quantity,
    })),
    note: "Use arena_preview_miles_redemption before arena_redeem_miles; redemption requires confirm:true.",
  };
}

async function searchCatalog({ query, user_id, category }) {
  const listed = await listCatalog({ user_id, category });
  if (listed.error) return listed;
  const q = String(query).toLowerCase();
  const matched = listed.items.filter(
    (it) =>
      String(it.name || "").toLowerCase().includes(q) ||
      String(it.description || "").toLowerCase().includes(q)
  );
  return {
    query,
    count: matched.length,
    items: matched,
    serverUrl: API_URL,
  };
}

async function milesBalance({ user_id }) {
  if (!user_id) return { error: "user_id required" };
  return fetchJson(`/api/miles/balance?user_id=${encodeURIComponent(user_id)}`);
}

async function previewRedemption({ user_id, item_id, quantity = 1 }) {
  if (!user_id || !item_id) {
    return { error: "user_id and item_id required" };
  }
  const qty = quantity > 0 ? quantity : 1;
  const [bal, catalog] = await Promise.all([
    milesBalance({ user_id }),
    listCatalog({ user_id }),
  ]);
  if (bal?.error) return bal;
  if (catalog?.error) return catalog;
  const row = catalog.items.find((i) => i.id === item_id);
  if (!row) {
    return { error: "item not found in catalog", item_id };
  }
  const unit = parseMiles(row.final_cost);
  const total = unit * qty;
  const current = parseMiles(bal.current_balance);
  return {
    preview: true,
    user_id,
    item_id,
    quantity: qty,
    item_name: row.name,
    miles_per_unit: unit,
    miles_total: total,
    current_balance: current,
    tier: bal.tier,
    can_afford: current >= total,
    max_auto_miles: MAX_AUTO_MILES,
    next_step:
      current >= total
        ? "Ask the user to confirm; then call arena_redeem_miles with confirm:true."
        : "Insufficient miles; do not call redeem.",
  };
}

async function redeemMiles(args) {
  const {
    user_id,
    item_id,
    quantity = 1,
    confirm,
    max_miles_override,
  } = args || {};
  if (!confirm) {
    return {
      error:
        "Redemption cancelled: pass confirm:true only after the user explicitly confirms in chat.",
    };
  }
  if (!user_id || !item_id) {
    return { error: "user_id and item_id required" };
  }
  const preview = await previewRedemption({
    user_id,
    item_id,
    quantity,
  });
  if (preview.error) return preview;
  if (!preview.can_afford) {
    return { error: "Insufficient miles", preview };
  }
  const cap =
    typeof max_miles_override === "number" && max_miles_override > 0
      ? max_miles_override
      : MAX_AUTO_MILES;
  if (preview.miles_total > cap) {
    return {
      error: `Total miles ${preview.miles_total} exceeds cap ${cap}. Ask the user to raise max_miles_override if they accept.`,
      preview,
    };
  }
  const qty = quantity > 0 ? quantity : 1;
  return fetchJson("/api/miles/redeem", {
    method: "POST",
    body: JSON.stringify({
      user_id,
      item_id,
      quantity: qty,
      metadata: { source: "mcp-agent" },
    }),
  });
}

export const handlers = {
  arena_list_miles_catalog: (args) => listCatalog(args || {}),
  arena_search_miles_catalog: (args) => searchCatalog(args || {}),
  arena_miles_balance: (args) => milesBalance(args || {}),
  arena_preview_miles_redemption: (args) => previewRedemption(args || {}),
  arena_redeem_miles: (args) => redeemMiles(args || {}),
};
