export type ChessGameStatus = 'draft' | 'active' | 'completed' | 'aborted';
export type ChessColor = 'white' | 'black';
export type ChessActorKind = 'human' | 'engine' | 'agent';
export type ChessMoveActorKind = ChessActorKind | 'system';

export type ChessGameMode =
  | 'human_vs_engine'
  | 'human_vs_agent'
  | 'agent_vs_engine'
  | 'agent_vs_agent'
  | 'engine_vs_engine'
  | 'analysis';

export type ChessResult = '1-0' | '0-1' | '1/2-1/2' | '*';

export type ChessResultReason =
  | 'checkmate'
  | 'stalemate'
  | 'threefold_repetition'
  | 'fifty_move_rule'
  | 'insufficient_material'
  | 'resignation'
  | 'timeout'
  | 'abort'
  | 'manual';

export type ChessPieceKind = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
export type BoardPiece = `${'w' | 'b'}${ChessPieceKind}`;

export interface ChessActor {
  kind: ChessActorKind;
  refId?: string;
  displayName: string;
}

export type ChessEngineFamily = string;
export type ChessEngineProvider = string;

export type ChessEngineCapability =
  | 'play'
  | 'analysis'
  | 'multipv'
  | 'limit_strength'
  | 'uci_options'
  | 'neural_network';

export interface ChessEngineConfig {
  enabled: boolean;
  profileId: string;
  skillLevel?: number;
  limitStrength?: boolean;
  elo?: number;
  movetimeMs?: number;
  depth?: number;
  multipv?: number;
  uciOptions?: Record<string, string | number | boolean>;
}

export interface ChessEngineProfileSnapshot {
  id: string;
  family: ChessEngineFamily;
  name: string;
  version: string | null;
  provider: ChessEngineProvider;
  displayName: string;
}

export interface ChessEngineProfile extends ChessEngineProfileSnapshot {
  capabilities: ChessEngineCapability[];
  defaultConfig: ChessEngineConfig;
}

export interface ChessClockConfig {
  enabled: boolean;
  initialMs: number;
  incrementMs: number;
  delayMs?: number;
}

export interface ChessGameRecord {
  id: string;
  ownerUserId: string;
  status: ChessGameStatus;
  mode: ChessGameMode;
  white: ChessActor;
  black: ChessActor;
  initialFen: string | null;
  currentFen: string;
  pgn: string;
  sideToMove: ChessColor;
  ply: number;
  sequence: number;
  result: ChessResult | null;
  resultReason: ChessResultReason | null;
  engineConfig: ChessEngineConfig;
  engineProfile: ChessEngineProfileSnapshot | null;
  clockConfig: ChessClockConfig | null;
  whiteTimeRemainingMs: number | null;
  blackTimeRemainingMs: number | null;
  lastMoveAt: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  endedAt: string | null;
}

export interface ChessMoveRecord {
  id: string;
  gameId: string;
  ply: number;
  moveNumber: number;
  color: ChessColor;
  uci: string;
  san: string;
  lan: string | null;
  fenAfter: string;
  createdByKind: ChessMoveActorKind;
  createdByRefId: string | null;
  timeSpentMs: number | null;
  comment: string | null;
  nags: string[] | null;
  createdAt: string;
}

export interface ChessLegalMove {
  from: string;
  to: string;
  san: string;
  lan: string;
  before: string;
  after: string;
  flags: string;
  color: 'w' | 'b';
  piece: string;
  captured?: string;
  promotion?: string;
}

export interface ChessGameSnapshot {
  game: ChessGameRecord;
  moves: ChessMoveRecord[];
  legalMoves: ChessLegalMove[];
  engineThinking: boolean;
}

export interface CreateChessGameRequest {
  mode: ChessGameMode;
  white?: ChessActor;
  black?: ChessActor;
  humanColor?: ChessColor;
  initialFen?: string;
  engineProfileId?: string;
  engineConfig?: Partial<ChessEngineConfig>;
  clockConfig?: ChessClockConfig | null;
  autoStart?: boolean;
}

export interface MakeMoveRequest {
  move: string;
  notation: 'uci' | 'san';
  expectedPly?: number;
}

export interface StoredEngineScore {
  raw: {
    perspective: 'side_to_move';
    sideToMove: ChessColor;
    cp?: number;
    mate?: number;
  };
  white: {
    cp?: number;
    mate?: number;
  };
}

export interface NormalizedEngineLine {
  multipv: number;
  depth: number;
  seldepth?: number;
  score: StoredEngineScore;
  pv: string[];
  nodes?: number;
  nps?: number;
  timeMs?: number;
}

export interface ChessAnalysisResult {
  analysisId: string;
  gameId: string;
  ply: number;
  lines: NormalizedEngineLine[];
}
