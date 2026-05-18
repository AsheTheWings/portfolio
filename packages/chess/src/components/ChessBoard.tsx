'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import { buildBoardSquares, toUciMove, type BoardSquare } from '../lib/board';
import { getBoardTextureUrl, getPieceAssetUrl } from '../lib/chess-assets';
import type { ChessSettings } from '../lib/chess-settings';
import type { ChessColor, ChessLegalMove } from '../types/chess';

interface ChessBoardProps {
  fen: string;
  legalMoves: ChessLegalMove[];
  orientation: ChessColor;
  settings: ChessSettings;
  disabled?: boolean;
  onMove: (uci: string) => void;
}

/**
 * Renders the interactive chess board using selected Chess.com visual assets.
 *
 * @param props - Board position, legal moves, orientation, settings, and move callback.
 * @returns Interactive chess board component.
 */
export function ChessBoard({ fen, legalMoves, orientation, settings, disabled = false, onMove }: ChessBoardProps) {
  const [selectedSquare, setSelectedSquare] = useState<BoardSquare | null>(null);
  const squares = useMemo(() => buildBoardSquares(fen, orientation), [fen, orientation]);
  const legalTargets = useMemo(
    () => new Set(legalMoves.filter((move) => move.from === selectedSquare).map((move) => move.to)),
    [legalMoves, selectedSquare],
  );
  const legalSources = useMemo(() => new Set(legalMoves.map((move) => move.from)), [legalMoves]);
  const allowsClickMoves = settings.moveMethod === 'drag-or-click' || settings.moveMethod === 'click-squares';
  const showInsideCoordinates = settings.showCoordinates && settings.coordinatesPosition === 'inside';

  function handleSquareClick(square: BoardSquare) {
    if (disabled || !allowsClickMoves) return;

    if (selectedSquare && legalTargets.has(square)) {
      const move = legalMoves.find((candidate) => candidate.from === selectedSquare && candidate.to === square);
      onMove(toUciMove(selectedSquare, square, move?.promotion));
      setSelectedSquare(null);
      return;
    }

    setSelectedSquare(legalSources.has(square) ? square : null);
  }

  return (
    <div className="aspect-square size-full overflow-hidden rounded-3xl border border-border-subtle bg-surface-1 p-2 shadow-depth-lg">
      <div className="relative aspect-square size-full overflow-hidden rounded-2xl border border-border-subtle">
        <Image
          src={getBoardTextureUrl(settings.boardSlug)}
          alt=""
          fill
          unoptimized
          priority
          draggable={false}
          sizes="(min-width: 1280px) min(100vw, 100vh), calc(100vw - 3rem)"
          className={`object-cover ${orientation === 'black' ? 'rotate-180' : ''}`}
        />
        <div className="relative z-10 grid h-full grid-cols-8 grid-rows-8">
          {squares.map((square) => {
            const selected = square.square === selectedSquare;
            const isTarget = legalTargets.has(square.square);
            return (
              <button
                key={square.square}
                type="button"
                aria-label={square.square}
                onClick={() => handleSquareClick(square.square)}
                className={`relative flex items-center justify-center bg-transparent ${disabled || !allowsClickMoves ? 'cursor-default' : ''}`}
              >
                {settings.highlightMoves && selected && <span className="absolute inset-0 bg-cyan-400/35" />}
                {settings.highlightMoves && isTarget && <span className="absolute h-4 w-4 rounded-full bg-cyan-950/45 dark:bg-cyan-50/55" />}
                {square.piece && (
                  <Image
                    src={getPieceAssetUrl(settings.pieceSlug, square.piece)}
                    alt={`${square.piece} on ${square.square}`}
                    width={96}
                    height={96}
                    unoptimized
                    priority={false}
                    draggable={settings.moveMethod === 'drag-or-click' || settings.moveMethod === 'drag-pieces'}
                    className="relative z-10 h-[82%] w-[82%] object-contain drop-shadow-md"
                  />
                )}
                {showInsideCoordinates && (
                  <>
                    <span className="pointer-events-none absolute bottom-1 left-1 text-[10px] font-semibold text-black/45">
                      {square.file === (orientation === 'white' ? 'a' : 'h') ? square.rank : ''}
                    </span>
                    <span className="pointer-events-none absolute bottom-1 right-1 text-[10px] font-semibold text-black/45">
                      {square.rank === (orientation === 'white' ? 1 : 8) ? square.file : ''}
                    </span>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
