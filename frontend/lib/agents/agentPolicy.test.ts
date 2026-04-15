'use strict';

import { describe, expect, it } from 'vitest';
import { DEFAULT_AGENT_POLICY, parseAgentPolicy, randomAgentPolicy } from './agentPolicy';
import { defaultSymbolForAsset, policyToTradingRuntime } from './policyToKnobs';
import { PaperLedger } from '../paper/ledger';

describe('parseAgentPolicy', () => {
  it('fills defaults for garbage input', () => {
    const p = parseAgentPolicy(null);
    expect(p.version).toBe(1);
    expect(p.identity.displayName).toBeTruthy();
  });

  it('clamps paperStartingCash', () => {
    const p = parseAgentPolicy({
      ...DEFAULT_AGENT_POLICY,
      deployment: { ...DEFAULT_AGENT_POLICY.deployment, paperStartingCash: 50 },
    });
    expect(p.deployment.paperStartingCash).toBeGreaterThanOrEqual(100);
  });
});

describe('policyToTradingRuntime', () => {
  it('raises min confidence for patient_observer', () => {
    const policy = parseAgentPolicy({
      ...DEFAULT_AGENT_POLICY,
      identity: { ...DEFAULT_AGENT_POLICY.identity, decisionStyle: 'patient_observer' },
    });
    const rt = policyToTradingRuntime(policy, { winStreak: 0, confidence: 0.5, equityApprox: 10_000 });
    expect(rt.knobs.minConfidenceToTrade).toBeGreaterThanOrEqual(0.42);
  });

  it('keeps smart_scaling stake within maxStake and applies equity cap', () => {
    const policy = parseAgentPolicy({
      ...DEFAULT_AGENT_POLICY,
      deployment: { ...DEFAULT_AGENT_POLICY.deployment, paperStartingCash: 250_000 },
      risk: { moneyApproach: 'smart_scaling', protection: 'flexible' },
    });
    const L = new PaperLedger(250_000);
    const eq = L.snapshot(100).equityApprox;
    const rt = policyToTradingRuntime(policy, { winStreak: 6, confidence: 0.99, equityApprox: eq });
    expect(rt.knobs.defaultStake).toBeLessThanOrEqual(rt.knobs.maxStake);
    expect(rt.knobs.defaultStake).toBeGreaterThanOrEqual(5);
    expect(rt.knobs.defaultStake).toBeLessThanOrEqual(Math.floor(eq * 0.06 * 1.25));
  });
});

describe('randomAgentPolicy', () => {
  it('returns valid policy', () => {
    const p = randomAgentPolicy();
    expect(parseAgentPolicy(p)).toEqual(p);
  });
});

describe('defaultSymbolForAsset', () => {
  it('returns deriv-like symbols', () => {
    expect(defaultSymbolForAsset('forex_pro')).toMatch(/^R_/);
    expect(defaultSymbolForAsset('crypto_rebel')).toMatch(/1HZ/);
  });
});
