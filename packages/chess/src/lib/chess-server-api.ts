import type { ChessEngineProfile, ChessGameRecord, ChessGameSnapshot } from '../types/chess';

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3001';

async function json<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : `Request failed: ${res.status}`);
  }
  return data as T;
}

function headersWithCookie(cookieHeader: string): HeadersInit {
  return cookieHeader ? { cookie: cookieHeader } : {};
}

/**
 * Fetches authenticated chess games from the backend during server rendering.
 *
 * @param cookieHeader - Incoming request cookie header.
 * @returns Ordered chess games.
 */
export async function fetchServerChessGames(cookieHeader: string): Promise<ChessGameRecord[]> {
  const res = await fetch(`${BACKEND_URL}/chess/games`, {
    headers: headersWithCookie(cookieHeader),
    cache: 'no-store',
  });
  const data = await json<{ games: ChessGameRecord[] }>(res);
  return data.games;
}

/**
 * Fetches one authenticated chess snapshot from the backend during server rendering.
 *
 * @param cookieHeader - Incoming request cookie header.
 * @param gameId - Opaque chess game id.
 * @returns Canonical game snapshot.
 */
export async function fetchServerChessGame(cookieHeader: string, gameId: string): Promise<ChessGameSnapshot> {
  const res = await fetch(`${BACKEND_URL}/chess/games/${gameId}`, {
    headers: headersWithCookie(cookieHeader),
    cache: 'no-store',
  });
  const data = await json<{ snapshot: ChessGameSnapshot }>(res);
  return data.snapshot;
}

/**
 * Fetches backend-owned chess engine profiles during server rendering.
 *
 * @param cookieHeader - Incoming request cookie header.
 * @returns Available engine profiles.
 */
export async function fetchServerChessEngineProfiles(cookieHeader: string): Promise<ChessEngineProfile[]> {
  const res = await fetch(`${BACKEND_URL}/chess/engine-profiles`, {
    headers: headersWithCookie(cookieHeader),
    cache: 'no-store',
  });
  const data = await json<{ profiles: ChessEngineProfile[] }>(res);
  return data.profiles;
}
