'use client';

import type {
  ChessAnalysisResult,
  ChessGameRecord,
  ChessGameSnapshot,
  CreateChessGameRequest,
  MakeMoveRequest,
} from '../types/chess';

const BASE = '/api/chess';

async function json<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : `Request failed: ${res.status}`);
  }
  return data as T;
}

/**
 * Fetches games owned by the authenticated user.
 *
 * @returns Ordered chess game records.
 */
export async function fetchChessGames(): Promise<ChessGameRecord[]> {
  const res = await fetch(`${BASE}/games`, { credentials: 'include' });
  const data = await json<{ games: ChessGameRecord[] }>(res);
  return data.games;
}

/**
 * Fetches a full game snapshot.
 *
 * @param gameId - Game id.
 * @returns Canonical game snapshot.
 */
export async function fetchChessGame(gameId: string): Promise<ChessGameSnapshot> {
  const res = await fetch(`${BASE}/games/${gameId}`, { credentials: 'include' });
  const data = await json<{ snapshot: ChessGameSnapshot }>(res);
  return data.snapshot;
}

/**
 * Creates a chess game through the backend domain API.
 *
 * @param input - Game creation request.
 * @returns Created game snapshot.
 */
export async function createChessGame(input: CreateChessGameRequest): Promise<ChessGameSnapshot> {
  const res = await fetch(`${BASE}/games`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const data = await json<{ snapshot: ChessGameSnapshot }>(res);
  return data.snapshot;
}

/**
 * Starts a draft chess game.
 *
 * @param gameId - Game id.
 * @returns Updated snapshot.
 */
export async function startChessGame(gameId: string): Promise<ChessGameSnapshot> {
  const res = await fetch(`${BASE}/games/${gameId}/start`, {
    method: 'POST',
    credentials: 'include',
  });
  const data = await json<{ snapshot: ChessGameSnapshot }>(res);
  return data.snapshot;
}

/**
 * Submits a move to the canonical backend referee.
 *
 * @param gameId - Game id.
 * @param input - Move request.
 * @returns Updated snapshot and move.
 */
export async function makeChessMove(gameId: string, input: MakeMoveRequest): Promise<{ snapshot: ChessGameSnapshot }> {
  const res = await fetch(`${BASE}/games/${gameId}/moves`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return json<{ snapshot: ChessGameSnapshot }>(res);
}

/**
 * Resigns the user's controlled side.
 *
 * @param gameId - Game id.
 * @returns Updated snapshot.
 */
export async function resignChessGame(gameId: string): Promise<ChessGameSnapshot> {
  const res = await fetch(`${BASE}/games/${gameId}/resign`, {
    method: 'POST',
    credentials: 'include',
  });
  const data = await json<{ snapshot: ChessGameSnapshot }>(res);
  return data.snapshot;
}

/**
 * Aborts a draft or active game.
 *
 * @param gameId - Game id.
 * @returns Updated snapshot.
 */
export async function abortChessGame(gameId: string): Promise<ChessGameSnapshot> {
  const res = await fetch(`${BASE}/games/${gameId}/abort`, {
    method: 'POST',
    credentials: 'include',
  });
  const data = await json<{ snapshot: ChessGameSnapshot }>(res);
  return data.snapshot;
}

/**
 * Requests bounded engine analysis through the backend.
 *
 * @param gameId - Game id.
 * @param options - Analysis limits.
 * @returns Normalized engine lines.
 */
export async function requestChessAnalysis(
  gameId: string,
  options: { multipv?: number; depth?: number; movetimeMs?: number } = {},
): Promise<ChessAnalysisResult> {
  const res = await fetch(`${BASE}/games/${gameId}/analysis`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  });
  return json<ChessAnalysisResult>(res);
}

/**
 * Fetches a one-time chess WebSocket ticket.
 *
 * @returns Ticket string.
 */
export async function fetchChessWsTicket(): Promise<string> {
  const res = await fetch(`${BASE}/ws-ticket`, { method: 'POST', credentials: 'include' });
  const data = await json<{ ticket: string }>(res);
  return data.ticket;
}
