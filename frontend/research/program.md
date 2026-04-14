# Research — auto-improve loop

## Overview

This folder contains a small **local simulation** of an iterative strategy-improvement loop (Brier-style scoring). It is useful for experimentation only and does not call external trading venues.

## Files

| File | Purpose |
|------|---------|
| `auto-improve.ts` | Standard multi-round baseline loop |
| `iterate.ts` | Single round runner |
| `strategy.ts` | Auto-versioned strategy parameters |

## Running

```bash
npm run research:auto
```

## Note

Regime-aware runners and third-party data dependencies were removed so this repository stays self-contained for an initial public commit.
