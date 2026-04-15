#!/usr/bin/env node
/**
 * Delegates to the frontend smoke script (tsx). Same env as `frontend/scripts/paper-agent-once.ts`.
 * OAuth is deferred; see `frontend/lib/auth/oauthDeferred.ts`.
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const frontendDir = join(root, '..', 'frontend');
const r = spawnSync('npx', ['tsx', 'scripts/paper-agent-once.ts'], {
  cwd: frontendDir,
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: process.env,
});
process.exit(typeof r.status === 'number' ? r.status : 1);
