'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import { buildBoardSquares, PIECE_ASSET_PATHS, toUciMove, type BoardSquare } from '../lib/board';
import type { ChessColor, ChessLegalMove } from '../types/chess';

interface ChessBoardProps {
  fen: string;
  legalMoves: ChessLegalMove[];
  orientation: ChessColor;
  disabled?: boolean;
  onMove: (uci: string) => void;
}

/**
 * Renders the interactive chess board using SVG assets from public/chess.
 *
 * @param props - Board position, legal moves, orientation, and move callback.
 * @returns Interactive chess board component.
 */
export function ChessBoard({ fen, legalMoves, orientation, disabled = false, onMove }: ChessBoardProps) {
  const [selectedSquare, setSelectedSquare] = useState<BoardSquare | null>(null);
  const squares = useMemo(() => buildBoardSquares(fen, orientation), [fen, orientation]);
  const legalTargets = useMemo(
    () => new Set(legalMoves.filter((move) => move.from === selectedSquare).map((move) => move.to)),
    [legalMoves, selectedSquare],
  );
  const legalSources = useMemo(() => new Set(legalMoves.map((move) => move.from)), [legalMoves]);

  function handleSquareClick(square: BoardSquare) {
    if (disabled) return;

    if (selectedSquare && legalTargets.has(square)) {
      const move = legalMoves.find((candidate) => candidate.from === selectedSquare && candidate.to === square);
      onMove(toUciMove(selectedSquare, square, move?.promotion));
      setSelectedSquare(null);
      return;
    }

    setSelectedSquare(legalSources.has(square) ? square : null);
  }

  return (
    <div className="w-full max-w-[min(76vh,760px)] overflow-hidden rounded-3xl border border-border-subtle bg-surface-1 p-3 shadow-depth-lg">
      <div className="grid aspect-square grid-cols-8 overflow-hidden rounded-2xl border border-border-subtle">
        {squares.map((square) => {
          const selected = square.square === selectedSquare;
          const isTarget = legalTargets.has(square.square);
          return (
            <button
              key={square.square}
              type="button"
              aria-label={square.square}
              onClick={() => handleSquareClick(square.square)}
              className={`relative flex items-center justify-center ${square.light ? 'bg-[#e7d9c4]' : 'bg-[#8f5f3f]'} ${disabled ? 'cursor-default' : ''}`}
            >
              {selected && <span className="absolute inset-0 bg-cyan-400/35" />}
              {isTarget && <span className="absolute h-4 w-4 rounded-full bg-cyan-950/45 dark:bg-cyan-50/55" />}
              {square.piece && (
                <Image
                  src={PIECE_ASSET_PATHS[square.piece]}
                  alt={`${square.piece} on ${square.square}`}
                  width={96}
                  height={96}
                  priority={false}
                  draggable={false}
                  className="relative z-10 h-[82%] w-[82%] object-contain drop-shadow-md"
                />
              )}
              <span className="pointer-events-none absolute bottom-1 left-1 text-[10px] font-semibold text-black/45">
                {square.file === (orientation === 'white' ? 'a' : 'h') ? square.rank : ''}
              </span>
              <span className="pointer-events-none absolute bottom-1 right-1 text-[10px] font-semibold text-black/45">
                {square.rank === (orientation === 'white' ? 1 : 8) ? square.file : ''}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
