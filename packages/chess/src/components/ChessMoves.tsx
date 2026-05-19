import Image from 'next/image';
import { Button } from '@portfolio/ui/components/shadcn';
import { cn } from '@portfolio/ui/lib/utils';
import { ChevronsLeftIcon, ChevronsRightIcon, PauseIcon, PlayIcon, SkipBackIcon, SkipForwardIcon } from 'lucide-react';
import type { PieceNotation } from '../lib/chess-settings';
import type { ChessColor, ChessMoveRecord, ChessPieceKind } from '../types/chess';

interface ChessMovesProps {
  moves: ChessMoveRecord[];
  pieceNotation: PieceNotation;
  viewedPly: number;
  isPlaying: boolean;
  className?: string;
  onFirstMove: () => void;
  onPreviousMove: () => void;
  onTogglePlayback: () => void;
  onNextMove: () => void;
  onLastMove: () => void;
  onSelectPly: (ply: number) => void;
}

type MoveRow = {
  white: ChessMoveRecord;
  black: ChessMoveRecord | undefined;
};

type SanPieceLetter = 'K' | 'Q' | 'R' | 'B' | 'N';

const SAN_PIECE_TO_KIND: Record<SanPieceLetter, Exclude<ChessPieceKind, 'p'>> = {
  K: 'k',
  Q: 'q',
  R: 'r',
  B: 'b',
  N: 'n',
};

/**
 * Displays move history grouped by move number with replay navigation controls.
 *
 * @param props - Ordered chess moves, piece-notation preference, replay state, and callbacks.
 * @returns Move history table and navigation controls.
 */
export function ChessMoves({
  moves,
  pieceNotation,
  viewedPly,
  isPlaying,
  className = '',
  onFirstMove,
  onPreviousMove,
  onTogglePlayback,
  onNextMove,
  onLastMove,
  onSelectPly,
}: ChessMovesProps) {
  const rows: MoveRow[] = [];
  for (let index = 0; index < moves.length; index += 2) {
    rows.push({ white: moves[index], black: moves[index + 1] });
  }

  const hasMoves = moves.length > 0;
  const isAtFirstMove = viewedPly === 0;
  const isAtLastMove = viewedPly === moves.length;

  return (
    <div className={`grid min-h-0 grid-rows-[minmax(0,1fr)_auto] bg-surface-1 ${className}`}>
      <div className="min-h-0 overflow-auto">
        {rows.length === 0 ? (
          <p className="px-2 pt-2 text-sm text-muted-foreground">No moves yet.</p>
        ) : (
          <div className="grid grid-cols-[3rem_1fr_1fr] text-sm">
            {rows.map(({ white, black }) => (
              <div key={white.id} className="contents">
                <div className="px-2 py-1.5 text-muted-foreground">{white.moveNumber}.</div>
                <MoveCell move={white} pieceNotation={pieceNotation} viewedPly={viewedPly} onSelectPly={onSelectPly} />
                {black ? (
                  <MoveCell move={black} pieceNotation={pieceNotation} viewedPly={viewedPly} onSelectPly={onSelectPly} />
                ) : (
                  <div className="px-2 py-1.5" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-5 gap-1 bg-surface-1 pt-2">
        <Button type="button" variant="ghost" size="icon-sm" aria-label="First Move" disabled={!hasMoves || isAtFirstMove} onClick={onFirstMove}>
          <ChevronsLeftIcon className="size-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Previous Move" disabled={!hasMoves || isAtFirstMove} onClick={onPreviousMove}>
          <SkipBackIcon className="size-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" aria-label={isPlaying ? 'Pause' : 'Play'} disabled={!hasMoves || isAtLastMove} onClick={onTogglePlayback}>
          {isPlaying ? <PauseIcon className="size-4" /> : <PlayIcon className="size-4" />}
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Next Move" disabled={!hasMoves || isAtLastMove} onClick={onNextMove}>
          <SkipForwardIcon className="size-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Last Move" disabled={!hasMoves || isAtLastMove} onClick={onLastMove}>
          <ChevronsRightIcon className="size-4" />
        </Button>
      </div>
    </div>
  );
}

interface MoveCellProps {
  move: ChessMoveRecord;
  pieceNotation: PieceNotation;
  viewedPly: number;
  onSelectPly: (ply: number) => void;
}

function MoveCell({ move, pieceNotation, viewedPly, onSelectPly }: MoveCellProps) {
  const isSelected = move.ply === viewedPly;

  return (
    <button
      type="button"
      onClick={() => onSelectPly(move.ply)}
      className={cn(
        'px-2 py-1.5 text-left font-medium transition-colors hover:text-foreground',
        isSelected ? 'text-foreground' : 'text-muted-foreground',
      )}
    >
      {renderMoveNotation(move, pieceNotation)}
    </button>
  );
}

function renderMoveNotation(move: ChessMoveRecord, pieceNotation: PieceNotation) {
  if (pieceNotation === 'text') return move.san;

  return <span className="inline-flex items-center whitespace-nowrap">{renderFigurineSan(move.san, move.color)}</span>;
}

function renderFigurineSan(san: string, color: ChessColor) {
  return Array.from(san).map((character, index) => {
    if (isFigurinePosition(san, character, index)) {
      return <PieceFigurine key={`${character}-${index}`} piece={character} color={color} />;
    }

    return <span key={`${character}-${index}`}>{character}</span>;
  });
}

function isFigurinePosition(san: string, character: string, index: number): character is SanPieceLetter {
  if (!isSanPieceLetter(character)) return false;
  return index === 0 || san[index - 1] === '=';
}

function isSanPieceLetter(character: string): character is SanPieceLetter {
  return character === 'K' || character === 'Q' || character === 'R' || character === 'B' || character === 'N';
}

interface PieceFigurineProps {
  piece: SanPieceLetter;
  color: ChessColor;
}

function PieceFigurine({ piece, color }: PieceFigurineProps) {
  const tone = color === 'white' ? 'l' : 'd';
  const pieceKind = SAN_PIECE_TO_KIND[piece];

  return (
    <Image
      src={`/chess/Chess_${pieceKind}${tone}t45.svg`}
      alt={piece}
      width={18}
      height={18}
      className="-my-1 inline-block size-[1.1em] shrink-0 align-[-0.18em]"
    />
  );
}
