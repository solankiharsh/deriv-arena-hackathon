'use strict';

import { DEFAULT_AGENT_POLICY, parseAgentPolicy, type AgentPolicy } from './agentPolicy';

export const AGENT_POLICY_STORAGE_KEY = 'derivarena-agent-policy-v1';
const LEGACY_PERSONALITY_KEY = 'derivarena-paper-personality-v1';

export function loadAgentPolicyFromStorage(): AgentPolicy {
  if (typeof window === 'undefined') return { ...DEFAULT_AGENT_POLICY };
  try {
    const raw = window.localStorage.getItem(AGENT_POLICY_STORAGE_KEY);
    if (raw) {
      return parseAgentPolicy(JSON.parse(raw));
    }
    const legacy = window.localStorage.getItem(LEGACY_PERSONALITY_KEY);
    if (legacy) {
      const o = JSON.parse(legacy) as Record<string, unknown>;
      const merged = {
        ...DEFAULT_AGENT_POLICY,
        identity: {
          ...DEFAULT_AGENT_POLICY.identity,
          displayName: typeof o.archetype === 'string' && o.archetype ? String(o.archetype).slice(0, 64) : DEFAULT_AGENT_POLICY.identity.displayName,
        },
        preferences: {
          ...DEFAULT_AGENT_POLICY.preferences,
          strategyNotes: typeof o.strategyNotes === 'string' ? String(o.strategyNotes).slice(0, 500) : '',
        },
      };
      return parseAgentPolicy(merged);
    }
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_AGENT_POLICY };
}

export function saveAgentPolicyToStorage(policy: AgentPolicy): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(AGENT_POLICY_STORAGE_KEY, JSON.stringify(parseAgentPolicy(policy)));
  } catch {
    /* quota */
  }
}
