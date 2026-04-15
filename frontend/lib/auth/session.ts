import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { cookies } from 'next/headers';
import type { UserRole } from '@/lib/arena-types';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'derivarena-dev-secret-change-in-production',
);

const COOKIE_NAME = 'arena_session';
const MAX_AGE = 7 * 24 * 60 * 60; // 7 days

export interface SessionPayload extends JWTPayload {
  uid: string;
  did: string; // deriv account id
  role: UserRole;
  name: string;
}

export async function createSession(payload: Omit<SessionPayload, 'iat' | 'exp'>): Promise<string> {
  const token = await new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(JWT_SECRET);

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: MAX_AGE,
    path: '/',
  });

  return token;
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');
  return session;
}

export async function requireRole(role: UserRole): Promise<SessionPayload> {
  const session = await requireSession();
  if (session.role !== role && session.role !== 'admin') {
    throw new Error('Forbidden');
  }
  return session;
}
