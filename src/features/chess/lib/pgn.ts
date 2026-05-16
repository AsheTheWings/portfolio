import type { ChessMoveRecord } from '../types/chess';

/**
 * Builds a readable move-text fallback when the backend PGN cache is empty.
 *
 * @param moves - Ordered canonical moves.
 * @returns Basic SAN move text.
 */
export function buildMoveText(moves: ChessMoveRecord[]): string {
  const pairs: string[] = [];
  for (let index = 0; index < moves.length; index += 2) {
    const white = moves[index];
    const black = moves[index + 1];
    if (!white) continue;
    pairs.push(`${white.moveNumber}. ${white.san}${black ? ` ${black.san}` : ''}`);
  }
  return pairs.join(' ');
}
