import { CHESS_BACKGROUND_THEMES, CHESS_BOARD_THEMES, CHESS_PIECE_THEMES, CHESS_SOUND_THEMES } from './chess-assets';

export type ChessMoveMethod = 'drag-or-click' | 'click-squares' | 'drag-pieces';

export interface ChessSettings {
  boardSlug: string;
  pieceSlug: string;
  backgroundSlug: string;
  soundSlug: string;
  soundsEnabled: boolean;
  showCoordinates: boolean;
  coordinatesPosition: 'inside' | 'outside';
  highlightMoves: boolean;
  moveMethod: ChessMoveMethod;
}

export const CHESS_SETTINGS_STORAGE_KEY = 'portfolio.chess.settings.v1';

export const CHESS_MOVE_METHODS: Array<{ label: string; value: ChessMoveMethod; description: string }> = [
  {
    label: 'Drag or Click',
    value: 'drag-or-click',
    description: 'Move pieces by dragging them or by clicking a source and target square.',
  },
  {
    label: 'Click Squares',
    value: 'click-squares',
    description: 'Move pieces by selecting a source square and then a target square.',
  },
  {
    label: 'Drag Pieces',
    value: 'drag-pieces',
    description: 'Move pieces by dragging them to a desired square.',
  },
];

export const DEFAULT_CHESS_SETTINGS: ChessSettings = {
  boardSlug: 'green',
  pieceSlug: 'classic',
  backgroundSlug: 'dark',
  soundSlug: 'default',
  soundsEnabled: true,
  showCoordinates: true,
  coordinatesPosition: 'inside',
  highlightMoves: true,
  moveMethod: 'drag-or-click',
};

export function getSettingsWithDefaults(value: unknown): ChessSettings {
  if (!value || typeof value !== 'object') return DEFAULT_CHESS_SETTINGS;

  const candidate = value as Partial<ChessSettings>;
  const boardSlug = findThemeSlug(CHESS_BOARD_THEMES, candidate.boardSlug, DEFAULT_CHESS_SETTINGS.boardSlug);
  const pieceSlug = findThemeSlug(CHESS_PIECE_THEMES, candidate.pieceSlug, DEFAULT_CHESS_SETTINGS.pieceSlug);
  const backgroundSlug = findThemeSlug(
    CHESS_BACKGROUND_THEMES,
    candidate.backgroundSlug,
    DEFAULT_CHESS_SETTINGS.backgroundSlug,
  );

  return {
    boardSlug,
    pieceSlug,
    backgroundSlug,
    soundSlug: findThemeSlug(CHESS_SOUND_THEMES, candidate.soundSlug, DEFAULT_CHESS_SETTINGS.soundSlug),
    soundsEnabled: typeof candidate.soundsEnabled === 'boolean' ? candidate.soundsEnabled : DEFAULT_CHESS_SETTINGS.soundsEnabled,
    showCoordinates:
      typeof candidate.showCoordinates === 'boolean' ? candidate.showCoordinates : DEFAULT_CHESS_SETTINGS.showCoordinates,
    coordinatesPosition:
      candidate.coordinatesPosition === 'inside' || candidate.coordinatesPosition === 'outside'
        ? candidate.coordinatesPosition
        : DEFAULT_CHESS_SETTINGS.coordinatesPosition,
    highlightMoves:
      typeof candidate.highlightMoves === 'boolean' ? candidate.highlightMoves : DEFAULT_CHESS_SETTINGS.highlightMoves,
    moveMethod: CHESS_MOVE_METHODS.some((method) => method.value === candidate.moveMethod)
      ? (candidate.moveMethod as ChessMoveMethod)
      : DEFAULT_CHESS_SETTINGS.moveMethod,
  };
}

function findThemeSlug<T extends { slug: string }>(themes: T[], slug: string | undefined, fallback: string): string {
  return slug && themes.some((theme) => theme.slug === slug) ? slug : fallback;
}
