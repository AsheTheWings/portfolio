import type { BoardPiece, ChessColor } from '../types/chess';

export type BoardSquare = `${'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h'}${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}`;

export interface RenderSquare {
  square: BoardSquare;
  file: string;
  rank: number;
  light: boolean;
  piece: BoardPiece | null;
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const PIECE_MAP: Record<string, BoardPiece> = {
  P: 'wp',
  N: 'wn',
  B: 'wb',
  R: 'wr',
  Q: 'wq',
  K: 'wk',
  p: 'bp',
  n: 'bn',
  b: 'bb',
  r: 'br',
  q: 'bq',
  k: 'bk',
};

export const PIECE_ASSET_PATHS: Record<BoardPiece, string> = {
  wk: '/chess/Chess_klt45.svg',
  wq: '/chess/Chess_qlt45.svg',
  wr: '/chess/Chess_rlt45.svg',
  wb: '/chess/Chess_blt45.svg',
  wn: '/chess/Chess_nlt45.svg',
  wp: '/chess/Chess_plt45.svg',
  bk: '/chess/Chess_kdt45.svg',
  bq: '/chess/Chess_qdt45.svg',
  br: '/chess/Chess_rdt45.svg',
  bb: '/chess/Chess_bdt45.svg',
  bn: '/chess/Chess_ndt45.svg',
  bp: '/chess/Chess_pdt45.svg',
};

/**
 * Parses a FEN board section into a square-to-piece lookup.
 *
 * @param fen - Full FEN string for the position.
 * @returns Mapping from algebraic square to board piece or null.
 * @throws Error when the FEN board section is malformed.
 */
export function parseFenBoard(fen: string): Record<BoardSquare, BoardPiece | null> {
  const boardPart = fen.trim().split(/\s+/)[0];
  const ranks = boardPart?.split('/');
  if (!ranks || ranks.length !== 8) throw new Error('Invalid FEN board');

  const board = Object.fromEntries(
    FILES.flatMap((file) => [1, 2, 3, 4, 5, 6, 7, 8].map((rank) => [`${file}${rank}`, null])),
  ) as Record<BoardSquare, BoardPiece | null>;

  ranks.forEach((rankText, rankIndex) => {
    const rank = 8 - rankIndex;
    let fileIndex = 0;

    for (const char of rankText) {
      if (/^[1-8]$/.test(char)) {
        fileIndex += Number(char);
        continue;
      }

      const piece = PIECE_MAP[char];
      if (!piece || fileIndex > 7) throw new Error('Invalid FEN board');
      board[`${FILES[fileIndex]}${rank}` as BoardSquare] = piece;
      fileIndex += 1;
    }

    if (fileIndex !== 8) throw new Error('Invalid FEN board');
  });

  return board;
}

/**
 * Builds render-ready board squares for the selected orientation.
 *
 * @param fen - Full FEN string for the position.
 * @param orientation - Side displayed at the bottom of the board.
 * @returns Render squares in visual order from top-left to bottom-right.
 */
export function buildBoardSquares(fen: string, orientation: ChessColor): RenderSquare[] {
  const board = parseFenBoard(fen);
  const ranks = orientation === 'white' ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];
  const files = orientation === 'white' ? FILES : [...FILES].reverse();

  return ranks.flatMap((rank) =>
    files.map((file) => {
      const square = `${file}${rank}` as BoardSquare;
      const fileIndex = FILES.indexOf(file);
      return {
        square,
        file,
        rank,
        light: (fileIndex + rank) % 2 === 1,
        piece: board[square],
      };
    }),
  );
}

/**
 * Converts a source and destination square into UCI notation.
 *
 * @param from - Origin square.
 * @param to - Destination square.
 * @param promotion - Optional promotion piece.
 * @returns UCI move text.
 */
export function toUciMove(from: string, to: string, promotion?: string): string {
  return `${from}${to}${promotion ?? ''}`;
}
