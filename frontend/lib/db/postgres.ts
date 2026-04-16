import { Pool, type PoolConfig } from 'pg';

const hasDb = !!process.env.DATABASE_URL;

const config: PoolConfig = hasDb
  ? {
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
    }
  : {};

const globalPool = globalThis as unknown as { __pgPool?: Pool };

export const pool = hasDb ? (globalPool.__pgPool ?? new Pool(config)) : (null as unknown as Pool);

if (process.env.NODE_ENV !== 'production' && hasDb) {
  globalPool.__pgPool = pool;
}

export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  if (!hasDb) {
    console.warn('[db] DATABASE_URL not configured — query skipped');
    return [];
  }
  const result = await pool.query(text, params);
  return result.rows as T[];
}

export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params?: unknown[],
): Promise<T | null> {
  if (!hasDb) {
    console.warn('[db] DATABASE_URL not configured — queryOne skipped');
    return null;
  }
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

export async function execute(text: string, params?: unknown[]): Promise<number> {
  if (!hasDb) {
    console.warn('[db] DATABASE_URL not configured — execute skipped');
    return 0;
  }
  const result = await pool.query(text, params);
  return result.rowCount ?? 0;
}
