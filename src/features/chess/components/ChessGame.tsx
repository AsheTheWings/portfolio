'use client';

import { ChessBoard } from './ChessBoard';
import { ChessMoveList } from './ChessMoveList';
import { ChessEnginePanel } from './ChessEnginePanel';
import { useChessGame } from '../hooks/useChessGame';
import { useAuthStore } from '@/features/authentication/stores/authStore';
import { buildMoveText } from '../lib/pgn';
import type { ChessColor } from '../types/chess';

interface ChessGameProps {
  gameId: string | null;
}

function inferOrientation(snapshotUserId: string | undefined, whiteRefId: string | undefined, blackRefId: string | undefined): ChessColor {
  if (snapshotUserId && blackRefId === snapshotUserId) return 'black';
  if (snapshotUserId && whiteRefId === snapshotUserId) return 'white';
  return 'white';
}

/**
 * Reusable embedded chess game view.
 *
 * @param props - Selected game id.
 * @returns Board, move list, engine panel, and FEN/PGN display.
 */
export function ChessGame({ gameId }: ChessGameProps) {
  const user = useAuthStore((state) => state.user);
  const { snapshot, engineThinking, isLoading, isSubmittingMove, connectionState, submitMove } = useChessGame(gameId);

  if (!gameId) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center rounded-3xl border border-dashed border-border bg-surface-1 p-10 text-center text-muted-foreground">
        Create a game to start playing Stockfish.
      </div>
    );
  }

  if (isLoading || !snapshot) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center rounded-3xl border border-border-subtle bg-surface-1 p-10 text-center text-muted-foreground">
        Loading chess game…
      </div>
    );
  }

  const orientation = inferOrientation(user?.id, snapshot.game.white.refId, snapshot.game.black.refId);
  const disabled = snapshot.game.status !== 'active' || isSubmittingMove || engineThinking;
  const pgn = snapshot.game.pgn || buildMoveText(snapshot.moves);

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-3 xl:grid-cols-[minmax(420px,1fr)_minmax(360px,420px)]">
      <div className="flex min-h-0 items-start justify-center">
        <ChessBoard
          fen={snapshot.game.currentFen}
          legalMoves={snapshot.legalMoves}
          orientation={orientation}
          disabled={disabled}
          onMove={submitMove}
        />
      </div>

      <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto_auto] gap-3 overflow-hidden pr-1">
        <div className="rounded-2xl border border-border-subtle bg-surface-1 p-3 shadow-depth-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{snapshot.game.white.displayName} vs {snapshot.game.black.displayName}</p>
              <p className="text-xs text-muted-foreground">Ply {snapshot.game.ply} · {connectionState}</p>
            </div>
            {engineThinking && <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-700 dark:text-cyan-200">Engine thinking</span>}
          </div>
        </div>

        <ChessMoveList moves={snapshot.moves} className="min-h-0" />
        <ChessEnginePanel gameId={gameId} isEngineThinking={engineThinking} />

        <div className="rounded-2xl border border-border-subtle bg-surface-1 shadow-depth-sm">
          <div className="border-b border-border-subtle px-3 py-2">
            <h2 className="text-sm font-semibold">FEN / PGN</h2>
          </div>
          <div className="space-y-2 p-3">
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">FEN</p>
              <code className="block truncate rounded-xl bg-surface-2 p-2 font-mono text-xs" title={snapshot.game.currentFen}>{snapshot.game.currentFen}</code>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">PGN</p>
              <code className="block max-h-16 overflow-auto whitespace-pre-wrap rounded-xl bg-surface-2 p-2 font-mono text-xs">{pgn || '—'}</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
