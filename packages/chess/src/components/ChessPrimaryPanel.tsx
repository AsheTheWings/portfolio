'use client';

import { Button, Tabs, TabsContent, TabsList, TabsTrigger } from '@portfolio/ui/components/shadcn';
import { cn } from '@portfolio/ui/lib/utils';
import { ChessControls } from './ChessControls';
import { ChessMoves } from './ChessMoves';
import { colorLabel, resultReasonLabel } from '../lib/notation';
import type { PieceNotation } from '../lib/chess-settings';
import type { ChessColor, ChessGameRecord, ChessGameSnapshot } from '../types/chess';

type ChessPrimaryPanelLayout = 'desktop' | 'mobile';

interface ChessPrimaryPanelProps {
  games: ChessGameRecord[];
  selectedGameId: string | null;
  snapshot: ChessGameSnapshot | undefined;
  connectionState: string;
  engineThinking: boolean;
  isCreating: boolean;
  pieceNotation: PieceNotation;
  viewedPly: number;
  isMovePlaybackRunning: boolean;
  layout?: ChessPrimaryPanelLayout;
  onSelectGame: (gameId: string) => void;
  onCreateGame: (options: { humanColor: ChessColor; skillLevel: number }) => void;
  onFirstMove: () => void;
  onPreviousMove: () => void;
  onToggleMovePlayback: () => void;
  onNextMove: () => void;
  onLastMove: () => void;
  onSelectViewedPly: (ply: number) => void;
  onResign: () => void;
  onAbort: () => void;
}

/**
 * Render the primary chess panel with tabs and game actions.
 *
 * @param props - Game state, creation state, layout mode, and lifecycle callbacks.
 * @returns Primary panel containing Moves, Games, New Game, and action regions.
 */
export function ChessPrimaryPanel({
  games,
  selectedGameId,
  snapshot,
  connectionState,
  engineThinking,
  isCreating,
  pieceNotation,
  viewedPly,
  isMovePlaybackRunning,
  layout = 'desktop',
  onSelectGame,
  onCreateGame,
  onFirstMove,
  onPreviousMove,
  onToggleMovePlayback,
  onNextMove,
  onLastMove,
  onSelectViewedPly,
  onResign,
  onAbort,
}: ChessPrimaryPanelProps) {
  const game = snapshot?.game ?? null;

  const TABS = [
    { value: 'moves', label: 'Moves' },
    { value: 'games', label: 'Games' },
    { value: 'new-game', label: 'New Game' },
  ] as const;

  return (
    <aside
      className={cn(
        'grid h-full min-h-0 shrink-0 grid-rows-[minmax(0,1fr)_180px] overflow-hidden border-border-subtle bg-surface-1 shadow-depth-sm',
        layout === 'mobile' ? 'w-full border-y' : 'w-[340px] border-r',
      )}
    >
      <Tabs defaultValue="moves" className="min-h-0 gap-0 overflow-hidden">
        <TabsList className="grid h-auto w-full grid-cols-3 rounded-none border-b border-border-subtle bg-surface-1 p-0">
          {TABS.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="h-12 rounded-none border-0 border-b-2 border-transparent bg-surface-1 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="moves" className="min-h-0 overflow-hidden p-3">
          <ChessMoves
            moves={snapshot?.moves ?? []}
            pieceNotation={pieceNotation}
            viewedPly={viewedPly}
            isPlaying={isMovePlaybackRunning}
            className="h-full shadow-none"
            onFirstMove={onFirstMove}
            onPreviousMove={onPreviousMove}
            onTogglePlayback={onToggleMovePlayback}
            onNextMove={onNextMove}
            onLastMove={onLastMove}
            onSelectPly={onSelectViewedPly}
          />
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
