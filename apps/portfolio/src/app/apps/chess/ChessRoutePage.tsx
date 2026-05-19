import { ChessGameShell } from '@portfolio/chess';
import { verifyToken } from '@portfolio/auth/lib/cookies';
import { cookies, headers } from 'next/headers';
import {
  CHESS_SETTINGS_COOKIE_KEY,
  parseChessSettingsCookie,
} from '@portfolio/chess/lib/chess-settings';
import {
  fetchServerChessEngineProfiles,
  fetchServerChessGame,
  fetchServerChessGames,
} from '@portfolio/chess/lib/chess-server-api';
import type { ChessGameShellVariant, ChessRouteFamily } from '@portfolio/chess';
import type { ChessEngineProfile, ChessGameRecord, ChessGameSnapshot } from '@portfolio/chess';

interface ChessRoutePageProps {
  gameId?: string;
  routeFamily: ChessRouteFamily;
  variant: ChessGameShellVariant;
}

/**
 * Server-renders chess route state shared by standalone and Timeline paths.
 *
 * @param props - Route family, shell variant, and optional selected game id.
 * @returns Chess shell with server-fetched initial data.
 */
export async function ChessRoutePage({ gameId = undefined, routeFamily, variant }: ChessRoutePageProps) {
  const [payload, cookieStore, headerStore] = await Promise.all([verifyToken(), cookies(), headers()]);
  const initialUser = payload ? { id: payload.userId, username: payload.username } : null;
  const initialSettings = parseChessSettingsCookie(cookieStore.get(CHESS_SETTINGS_COOKIE_KEY)?.value);
  const cookieHeader = headerStore.get('cookie') ?? '';

  let initialGames: ChessGameRecord[] = [];
  let initialEngineProfiles: ChessEngineProfile[] = [];
  let initialSnapshot: ChessGameSnapshot | null = null;

  if (initialUser) {
    try {
      [initialGames, initialEngineProfiles, initialSnapshot] = await Promise.all([
        fetchServerChessGames(cookieHeader),
        fetchServerChessEngineProfiles(cookieHeader),
        gameId ? fetchServerChessGame(cookieHeader, gameId) : Promise.resolve(null),
      ]);
    } catch {
      initialGames = [];
      initialEngineProfiles = [];
      initialSnapshot = null;
    }
  }

  return (
    <ChessGameShell
      initialUser={initialUser}
      variant={variant}
      routeFamily={routeFamily}
      routeGameId={gameId ?? null}
      initialGames={initialGames}
      initialSnapshot={initialSnapshot}
      initialEngineProfiles={initialEngineProfiles}
      initialSettings={initialSettings}
    />
  );
}
