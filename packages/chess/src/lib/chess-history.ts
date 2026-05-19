import type { ChessGameRecord, ChessMoveRecord } from '../types/chess';

export const STANDARD_CHESS_START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/**
 * Returns the board FEN for a game at a specific ply in its move history.
 *
 * @param game - Game metadata containing the optional initial FEN.
 * @param moves - Ordered move records for the game.
 * @param ply - Zero-based history cursor where 0 means the initial position.
 * @returns Board FEN at the requested ply.
 */
export function getFenAtPly(game: Pick<ChessGameRecord, 'initialFen'>, moves: ChessMoveRecord[], ply: number): string {
  if (ply <= 0) return game.initialFen ?? STANDARD_CHESS_START_FEN;

  const boundedPly = Math.min(ply, moves.length);
  return moves[boundedPly - 1]?.fenAfter ?? game.initialFen ?? STANDARD_CHESS_START_FEN;
}
