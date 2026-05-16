import type { ChessColor, ChessResultReason, NormalizedEngineLine } from '../types/chess';

const RESULT_REASON_LABELS: Record<ChessResultReason, string> = {
  checkmate: 'Checkmate',
  stalemate: 'Stalemate',
  threefold_repetition: 'Threefold repetition',
  fifty_move_rule: 'Fifty-move rule',
  insufficient_material: 'Insufficient material',
  resignation: 'Resignation',
  timeout: 'Timeout',
  abort: 'Abort',
  manual: 'Manual result',
};

/**
 * Converts a chess color into a display label.
 *
 * @param color - Chess side.
 * @returns Human-readable side name.
 */
export function colorLabel(color: ChessColor): string {
  return color === 'white' ? 'White' : 'Black';
}

/**
 * Formats a game-ending reason for display.
 *
 * @param reason - Domain result reason.
 * @returns Human-readable result reason.
 */
export function resultReasonLabel(reason: ChessResultReason | null | undefined): string {
  return reason ? RESULT_REASON_LABELS[reason] : 'Game in progress';
}

/**
 * Formats a normalized Stockfish score from White's perspective.
 *
 * @param line - Engine analysis line.
 * @returns Display score such as +0.35 or M3.
 */
export function formatEngineScore(line: NormalizedEngineLine | null | undefined): string {
  if (!line) return '—';
  if (line.score.white.mate !== undefined) {
    const mate = line.score.white.mate;
    return `${mate && mate > 0 ? '+' : ''}M${mate}`;
  }
  if (line.score.white.cp !== undefined) {
    const pawns = line.score.white.cp / 100;
    return pawns > 0 ? `+${pawns.toFixed(2)}` : pawns.toFixed(2);
  }
  return '—';
}

/**
 * Formats a principal variation for display.
 *
 * @param line - Engine analysis line.
 * @returns Space-delimited UCI principal variation.
 */
export function formatPrincipalVariation(line: NormalizedEngineLine | null | undefined): string {
  return line?.pv?.length ? line.pv.join(' ') : 'No line available';
}
