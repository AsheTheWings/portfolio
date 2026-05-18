'use client';

import { Button, Tabs, TabsContent, TabsList, TabsTrigger } from '@portfolio/ui/components/shadcn';
import { ChessControls } from './ChessControls';
import { ChessMoveList } from './ChessMoveList';
import { colorLabel, resultReasonLabel } from '../lib/notation';
import type { ChessColor, ChessGameRecord, ChessGameSnapshot } from '../types/chess';

interface ChessPrimaryPanelProps {
  games: ChessGameRecord[];
  selectedGameId: string | null;
  snapshot: ChessGameSnapshot | undefined;
  connectionState: string;
  engineThinking: boolean;
  isCreating: boolean;
  onSelectGame: (gameId: string) => void;
  onCreateGame: (options: { humanColor: ChessColor; skillLevel: number }) => void;
  onResign: () => void;
  onAbort: () => void;
}

/**
 * Render the fixed-width primary chess panel with tabs and game actions.
 *
 * @param props - Game state, creation state, and lifecycle callbacks.
 * @returns Primary panel containing Moves, Games, New Game, and action regions.
 */
export function ChessPrimaryPanel({
  games,
  selectedGameId,
  snapshot,
  connectionState,
  engineThinking,
  isCreating,
  onSelectGame,
  onCreateGame,
  onResign,
  onAbort,
}: ChessPrimaryPanelProps) {
  const game = snapshot?.game ?? null;

  return (
    <aside className="grid h-full min-h-0 w-[340px] shrink-0 grid-rows-[minmax(0,1fr)_180px] overflow-hidden border-r border-border-subtle bg-surface-1 shadow-depth-sm">
      <Tabs defaultValue="moves" className="min-h-0 gap-0 overflow-hidden">
        <div className="border-b border-border-subtle p-3">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="moves">Moves</TabsTrigger>
            <TabsTrigger value="games">Games</TabsTrigger>
            <TabsTrigger value="new-game">New Game</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="moves" className="min-h-0 overflow-hidden p-3">
          <ChessMoveList moves={snapshot?.moves ?? []} className="h-full shadow-none" />
        </TabsContent>

        <TabsContent value="games" className="min-h-0 overflow-auto p-3">
          {games.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No saved games yet.</p>
          ) : (
            <div className="space-y-2">
              {games.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  onClick={() => onSelectGame(candidate.id)}
                  className={`w-full rounded-xl px-3 py-2 text-left transition-colors ${candidate.id === selectedGameId ? 'bg-primary text-primary-foreground' : 'bg-surface-2 hover:bg-muted'}`}
                >
                  <div className="truncate text-sm font-medium">{candidate.white.displayName} vs {candidate.black.displayName}</div>
                  <div className="mt-1 text-xs opacity-75">{candidate.status} · ply {candidate.ply}</div>
                </button>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="new-game" className="min-h-0 overflow-auto p-3">
          <ChessControls onCreateGame={onCreateGame} isCreating={isCreating} />
        </TabsContent>
      </Tabs>

      <div className="border-t border-border-subtle bg-surface-2 p-3">
        {game ? (
          <div className="flex h-full flex-col justify-between gap-3">
            <div className="space-y-1 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Turn</span>
                <span className="font-medium">{colorLabel(game.sideToMove)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Status</span>
                <span className="font-medium capitalize">{game.status}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Socket</span>
                <span className="font-medium capitalize">{connectionState}</span>
              </div>
              {game.result && (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Result</span>
                  <span className="text-right font-medium">{game.result} · {resultReasonLabel(game.resultReason)}</span>
                </div>
              )}
              {engineThinking && <p className="rounded-full bg-cyan-500/10 px-3 py-1 text-center text-xs font-medium text-cyan-700 dark:text-cyan-200">Engine thinking</p>}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button size="sm" variant="secondary" disabled={game.status !== 'active'} onClick={onResign}>
                Resign
              </Button>
              <Button size="sm" variant="destructive" disabled={game.status === 'completed' || game.status === 'aborted'} onClick={onAbort}>
                Abort
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
            Create or select a game.
          </div>
        )}
      </div>
    </aside>
  );
}
