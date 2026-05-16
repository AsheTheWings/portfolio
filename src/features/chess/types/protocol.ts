import type {
  ChessColor,
  ChessGameSnapshot,
  ChessGameStatus,
  ChessMoveRecord,
  ChessResult,
  ChessResultReason,
  NormalizedEngineLine,
} from './chess';

export type ChessClientMessage =
  | { type: 'subscribe_game'; gameId: string; lastSequence?: number }
  | { type: 'unsubscribe_game'; gameId: string }
  | { type: 'make_move'; gameId: string; move: string; notation: 'uci' | 'san'; expectedPly?: number }
  | { type: 'request_analysis'; gameId: string; multipv?: number; depth?: number; movetimeMs?: number }
  | { type: 'stop_analysis'; gameId: string; analysisId: string }
  | { type: 'resign'; gameId: string; color?: ChessColor }
  | { type: 'abort_game'; gameId: string };

export type ChessServerMessage =
  | { type: 'game_snapshot'; gameId: string; sequence: number; snapshot: ChessGameSnapshot }
  | { type: 'move_applied'; gameId: string; sequence: number; move: ChessMoveRecord; snapshot: ChessGameSnapshot }
  | { type: 'game_status_changed'; gameId: string; sequence: number; status: ChessGameStatus; result?: ChessResult; reason?: ChessResultReason }
  | { type: 'engine_thinking'; gameId: string; sequence: number; color: ChessColor; ply: number }
  | { type: 'engine_analysis_started'; gameId: string; analysisId: string }
  | { type: 'engine_analysis_update'; gameId: string; analysisId: string; lines: NormalizedEngineLine[] }
  | { type: 'engine_analysis_complete'; gameId: string; analysisId: string; lines: NormalizedEngineLine[] }
  | { type: 'error'; gameId?: string; error: string; code?: string };
