/**
 * Competition discovery & join (maps to "list/search resources").
 */

import { API_URL } from "../config.js";

export const TOOLS = [
  {
    name: "arena_list_competitions",
    description:
      "List trading competitions on DerivArena (name, status, duration, starting balance, share URL). Optional status filter: pending, active, ended, cancelled.",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          description: "Filter by status, or omit for all recent competitions",
        },
      },
      required: [],
    },
  },
  {
    name: "arena_search_competitions",
    description:
      "Search competitions by keyword in name (client-side filter on list).",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Substring to match in competition name" },
        status: { type: "string", description: "Optional status filter" },
      },
      required: ["query"],
    },
  },
  {
    name: "arena_get_competition",
    description: "Get one competition by UUID including share_url for the join page.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Competition UUID" },
      },
      required: ["id"],
    },
  },
  {
    name: "arena_join_competition",
    description:
      "Join a competition as a trader. Requires trader_id (stable id for the user). Only call after the user confirms they want to join.",
    inputSchema: {
      type: "object",
      properties: {
        competition_id: { type: "string" },
        trader_id: { type: "string" },
        trader_name: { type: "string", description: "Optional display name" },
      },
      required: ["competition_id", "trader_id"],
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

async function listCompetitions({ status = "" } = {}) {
  const q = new URLSearchParams();
  if (status) q.set("status", status);
  const suffix = q.toString() ? `?${q}` : "";
  const data = await fetchJson(`/api/competitions${suffix}`);
  if (data?.error) return data;
  const rows = Array.isArray(data) ? data : [];
  return {
    serverUrl: API_URL,
    count: rows.length,
    competitions: rows.map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      duration_hours: c.duration_hours,
      starting_balance: c.starting_balance,
      contract_types: c.contract_types,
      share_url: c.share_url,
      partner_name: c.partner_name,
    })),
  };
}

async function searchCompetitions({ query, status }) {
  const listed = await listCompetitions({ status });
  if (listed.error) return listed;
  const q = String(query).toLowerCase();
  const matched = listed.competitions.filter((c) =>
    String(c.name || "").toLowerCase().includes(q)
  );
  return {
    query,
    count: matched.length,
    competitions: matched,
    serverUrl: API_URL,
  };
}

async function getCompetition({ id }) {
  return fetchJson(`/api/competitions/${encodeURIComponent(id)}`);
}

async function joinCompetition({ competition_id, trader_id, trader_name }) {
  return fetchJson(`/api/competitions/${encodeURIComponent(competition_id)}/join`, {
    method: "POST",
    body: JSON.stringify({
      trader_id,
      trader_name: trader_name || "",
    }),
  });
}

export const handlers = {
  arena_list_competitions: (args) => listCompetitions(args || {}),
  arena_search_competitions: (args) => searchCompetitions(args || {}),
  arena_get_competition: (args) => getCompetition(args || {}),
  arena_join_competition: (args) => joinCompetition(args || {}),
};
