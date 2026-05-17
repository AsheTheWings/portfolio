'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/features/authentication/stores/authStore';
import { AuthGate } from '@/features/authentication/components/AuthGate';
import { createChessGame, fetchChessGames } from '../lib/chess-api';
import { useChessStore } from '../stores/useChessStore';
import { ChessControls } from './ChessControls';
import { ChessGame } from './ChessGame';
import { useChessGame } from '../hooks/useChessGame';
import type { ChessColor } from '../types/chess';
import type { UserPublic } from '@/features/authentication/types';

interface ChessGameShellProps {
  initialUser: UserPublic | null;
}

/**
 * Page-level composition for the standalone chess feature.
 *
 * @param props - Server-authenticated initial user.
 * @returns Chess product shell.
 */
export function ChessGameShell({ initialUser }: ChessGameShellProps) {
  const { user, isAuthenticated, _hydrated, setUser } = useAuthStore();
  const games = useChessStore((state) => state.games);
  const selectedGameId = useChessStore((state) => state.selectedGameId);
  const snapshot = useChessStore((state) => (selectedGameId ? state.snapshots[selectedGameId] : undefined));
  const error = useChessStore((state) => state.error);
  const setGames = useChessStore((state) => state.setGames);
  const selectGame = useChessStore((state) => state.selectGame);
  const upsertSnapshot = useChessStore((state) => state.upsertSnapshot);
  const setError = useChessStore((state) => state.setError);
  const [isCreating, setIsCreating] = useState(false);
  const controlsGame = useChessGame(selectedGameId);

  useEffect(() => {
    if (initialUser && !user) setUser(initialUser);
  }, [initialUser, setUser, user]);

  const effectiveUser = _hydrated ? user : (user ?? initialUser);
  const effectiveAuth = _hydrated ? isAuthenticated : (isAuthenticated || !!initialUser);

  useEffect(() => {
    if (!effectiveAuth) return;
    let cancelled = false;
    fetchChessGames()
      .then((nextGames) => {
        if (cancelled) return;
        setGames(nextGames);
        if (!selectedGameId && nextGames[0]) selectGame(nextGames[0].id);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load chess games');
      });
    return () => {
      cancelled = true;
    };
  }, [effectiveAuth, selectGame, selectedGameId, setError, setGames]);

  if (!effectiveAuth || !effectiveUser) return <AuthGate />;

  async function handleCreateGame({ humanColor, skillLevel }: { humanColor: ChessColor; skillLevel: number }) {
    setIsCreating(true);
    setError(null);
    try {
      const nextSnapshot = await createChessGame({
        mode: 'human_vs_engine',
        humanColor,
        engineConfig: {
          enabled: true,
          skillLevel,
          movetimeMs: 700,
          multipv: 3,
        },
        autoStart: true,
      });
      upsertSnapshot(nextSnapshot);
      selectGame(nextSnapshot.game.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create game');
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <main className="h-dvh overflow-hidden bg-background pl-20">
      <div className="flex h-full min-h-0 flex-col gap-3 p-3 lg:p-4">
        <ChessControls
          game={snapshot?.game ?? null}
          connectionState={selectedGameId ? controlsGame.connectionState : 'idle'}
          onCreateGame={handleCreateGame}
          onResign={() => void controlsGame.resign()}
          onAbort={() => void controlsGame.abort()}
          isCreating={isCreating}
        />

        {error && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 2xl:grid-cols-[16rem_minmax(0,1fr)]">
          <aside className="hidden min-h-0 overflow-auto rounded-2xl border border-border-subtle bg-surface-1 p-2 shadow-depth-sm 2xl:block">
            <h2 className="mb-2 px-2 text-sm font-semibold">Games</h2>
            {games.length === 0 ? (
              <p className="px-2 py-6 text-sm text-muted-foreground">No saved games yet.</p>
            ) : (
              <div className="space-y-2">
                {games.map((game) => (
                  <button
                    key={game.id}
                    type="button"
                    onClick={() => selectGame(game.id)}
                    className={`w-full rounded-xl px-3 py-2 text-left transition-colors ${game.id === selectedGameId ? 'bg-primary text-primary-foreground' : 'bg-surface-2 hover:bg-muted'}`}
                  >
                    <div className="truncate text-sm font-medium">{game.white.displayName} vs {game.black.displayName}</div>
                    <div className="mt-1 text-xs opacity-75">{game.status} · ply {game.ply}</div>
                  </button>
                ))}
              </div>
            )}
          </aside>

          <section className="min-h-0 overflow-hidden">
            <ChessGame gameId={selectedGameId} />
          </section>
        </div>
      </div>
    </main>
  );
}
