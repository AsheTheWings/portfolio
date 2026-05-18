'use client';

import { ChessBoard } from './ChessBoard';
import { useChessGame } from '../hooks/useChessGame';
import { useAuthStore } from '@portfolio/auth/stores/authStore';
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
 * Render the centered board area for the selected chess game.
 *
 * @param props - Selected game id.
 * @returns Empty, loading, or interactive chess board state.
 */
export function ChessGame({ gameId }: ChessGameProps) {
  const user = useAuthStore((state) => state.user);
  const { snapshot, engineThinking, isLoading, isSubmittingMove, submitMove } = useChessGame(gameId);

  if (!gameId) {
    return (
      <div className="flex h-full min-h-[420px] items-center justify-center rounded-3xl border border-dashed border-border bg-surface-1 p-10 text-center text-muted-foreground">
        Create a game to start playing Stockfish.
      </div>
    );
  }

  if (isLoading || !snapshot) {
    return (
      <div className="flex h-full min-h-[420px] items-center justify-center rounded-3xl border border-border-subtle bg-surface-1 p-10 text-center text-muted-foreground">
        Loading chess game…
      </div>
    );
  }

  const orientation = inferOrientation(user?.id, snapshot.game.white.refId, snapshot.game.black.refId);
  const disabled = snapshot.game.status !== 'active' || isSubmittingMove || engineThinking;

  return (
    <div className="grid size-full min-h-0 place-items-center overflow-hidden p-4 [container-type:size]">
      <div className="aspect-square size-[min(100cqw,100cqh)]">
        <ChessBoard
          fen={snapshot.game.currentFen}
          legalMoves={snapshot.legalMoves}
          orientation={orientation}
          disabled={disabled}
          onMove={submitMove}
        />
      </div>
    </div>
  );
}
