# DerivArena documentation

| Document | Purpose |
|----------|---------|
| [ROADMAP.md](./ROADMAP.md) | Full product / hackathon plan and technical depth |
| [HUMANS_AND_AGENTS.md](./HUMANS_AND_AGENTS.md) | Humans + bots in one competition; single trade path; compare results |
| [SATORI_X_CROSSWALK.md](./SATORI_X_CROSSWALK.md) | Satori-X (Traders View) patterns → DerivArena |
| [PHASE_CHECKLIST.md](./PHASE_CHECKLIST.md) | Master delivery checklist (all phases) |
| [DERIV_V2_API_IMPLEMENTATION.md](./DERIV_V2_API_IMPLEMENTATION.md) | **Integrators:** PAT/OTP flow, reference script, what to build next |
| [DERIV_PUBLIC_WEBSOCKET.md](./DERIV_PUBLIC_WEBSOCKET.md) | Public WS verification and payload notes |

Repeatable scripts (run from repo root):

```bash
# Full V2 smoke: REST (accounts, OTP) + public WS + authenticated WS (needs DERIV_PAT, DERIV_APP_ID)
DERIV_PAT='…' DERIV_APP_ID='…' node scripts/explore-deriv-v2-api.mjs

# Public WS only (no credentials)
node scripts/verify-deriv-public-ws.mjs
```

See [DERIV_V2_API_IMPLEMENTATION.md](./DERIV_V2_API_IMPLEMENTATION.md) for environment variables and security notes.
