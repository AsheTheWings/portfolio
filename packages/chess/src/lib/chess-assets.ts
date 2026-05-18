import type { BoardPiece } from '../types/chess';

export interface ChessBoardTheme {
  name: string;
  slug: string;
  previewUrl: string;
  textureUrl: string;
}

export interface ChessPieceTheme {
  name: string;
  slug: string;
  assetBaseUrl: string;
}

export interface ChessBackgroundTheme {
  name: string;
  slug: string;
  previewUrl: string;
  backgroundUrl: string;
}

export interface ChessSoundTheme {
  name: string;
  slug: string;
}

const LEGACY_BOARD_PREVIEW_BASE_URL = 'https://images.chesscomfiles.com/chess-themes/boards/_previews_/square';
const LEGACY_BOARD_TEXTURE_BASE_URL = 'https://images.chesscomfiles.com/chess-themes/boards';
const LEGACY_PIECE_BASE_URL = 'https://images.chesscomfiles.com/chess-themes/pieces';
const LEGACY_BACKGROUND_PREVIEW_BASE_URL = 'https://images.chesscomfiles.com/chess-themes/backgrounds/_previews_/web';
const ASSET_THEME_BASE_URL = 'https://assets-themes.chess.com/image';

function legacyBoardTheme(name: string, slug: string, assetSlug = slug): ChessBoardTheme {
  return {
    name,
    slug,
    previewUrl: `${LEGACY_BOARD_PREVIEW_BASE_URL}/${assetSlug}.png`,
    textureUrl: `${LEGACY_BOARD_TEXTURE_BASE_URL}/${assetSlug}/200.png`,
  };
}

function assetBoardTheme(name: string, slug: string, assetId: string): ChessBoardTheme {
  return {
    name,
    slug,
    previewUrl: `${ASSET_THEME_BASE_URL}/${assetId}/square_preview.png`,
    textureUrl: `${ASSET_THEME_BASE_URL}/${assetId}/200.png`,
  };
}

function legacyPieceTheme(name: string, slug: string, assetSlug = slug): ChessPieceTheme {
  return {
    name,
    slug,
    assetBaseUrl: `${LEGACY_PIECE_BASE_URL}/${assetSlug}/150`,
  };
}

function assetPieceTheme(name: string, slug: string, assetId: string): ChessPieceTheme {
  return {
    name,
    slug,
    assetBaseUrl: `${ASSET_THEME_BASE_URL}/${assetId}/150`,
  };
}

function backgroundTheme(name: string, slug: string, previewFilename: string): ChessBackgroundTheme {
  const previewUrl = `${LEGACY_BACKGROUND_PREVIEW_BASE_URL}/${previewFilename}`;
  return { name, slug, previewUrl, backgroundUrl: previewUrl };
}

function assetBackgroundTheme(name: string, slug: string, assetId: string): ChessBackgroundTheme {
  const previewUrl = `${ASSET_THEME_BASE_URL}/${assetId}/background_web_preview.png`;
  return { name, slug, previewUrl, backgroundUrl: previewUrl };
}

export const CHESS_BOARD_THEMES: ChessBoardTheme[] = [
  assetBoardTheme('Green', 'green', '9rdwe'),
  legacyBoardTheme('Wood', 'dark_wood'),
  legacyBoardTheme('Glass', 'glass'),
  legacyBoardTheme('Brown', 'brown'),
  legacyBoardTheme('Icy Sea', 'icy_sea'),
  legacyBoardTheme('Newspaper', 'newspaper'),
  legacyBoardTheme('Walnut', 'walnut'),
  legacyBoardTheme('Sky', 'sky'),
  legacyBoardTheme('Lolz', 'lolz'),
  legacyBoardTheme('Stone', 'stone'),
  legacyBoardTheme('Bases', 'bases'),
  legacyBoardTheme('8-Bit', '8_bit'),
  legacyBoardTheme('Marble', 'marble'),
  legacyBoardTheme('Purple', 'purple'),
  legacyBoardTheme('Translucent', 'translucent'),
  legacyBoardTheme('Metal', 'metal'),
  legacyBoardTheme('Tournament', 'tournament'),
  legacyBoardTheme('Dash', 'dash'),
  legacyBoardTheme('Burled Wood', 'burled_wood'),
  legacyBoardTheme('Dark Blue', 'blue'),
  assetBoardTheme('Bubblegum', 'bubblegum', 'zshw9'),
  legacyBoardTheme('Checkers', 'checkers'),
  legacyBoardTheme('Graffiti', 'graffiti'),
  legacyBoardTheme('Light', 'light'),
  legacyBoardTheme('Neon', 'neon'),
  legacyBoardTheme('Orange', 'orange'),
  legacyBoardTheme('Overlay', 'overlay', 'translucent'),
  legacyBoardTheme('Parchment', 'parchment'),
  legacyBoardTheme('Red', 'red'),
  legacyBoardTheme('Sand', 'sand'),
  legacyBoardTheme('Tan', 'tan'),
  assetBoardTheme('Blue', 'blue_asset', '4fs27'),
  assetBoardTheme('Pink', 'pink', 'g715q'),
  assetBoardTheme('Chess The Musical', 'chess_the_musical', 'my2xa'),
  assetBoardTheme('Sky and Sea', 'sky_and_sea', '6m5lc'),
];

export const CHESS_PIECE_THEMES: ChessPieceTheme[] = [
  assetPieceTheme('Neo', 'neo', 'ejgfv'),
  assetPieceTheme('Neo Angle', 'neo_angle', '4ujxj'),
  legacyPieceTheme('Game Room', 'game_room'),
  legacyPieceTheme('Wood', 'wood'),
  legacyPieceTheme('Glass', 'glass'),
  legacyPieceTheme('Gothic', 'gothic'),
  legacyPieceTheme('Classic', 'classic'),
  legacyPieceTheme('Metal', 'metal'),
  legacyPieceTheme('Bases', 'bases'),
  legacyPieceTheme('Neo-Wood', 'neo_wood'),
  legacyPieceTheme('Icy Sea', 'icy_sea'),
  legacyPieceTheme('Club', 'club'),
  legacyPieceTheme('Ocean', 'ocean'),
  legacyPieceTheme('Newspaper', 'newspaper'),
  legacyPieceTheme('Blindfold', 'blindfold'),
  legacyPieceTheme('Space', 'space'),
  legacyPieceTheme('Cases', 'cases'),
  legacyPieceTheme('Condal', 'condal'),
  legacyPieceTheme('3D - ChessKid', '3d_chesskid'),
  legacyPieceTheme('8-Bit', '8_bit'),
  legacyPieceTheme('Marble', 'marble'),
  legacyPieceTheme('Book', 'book'),
  legacyPieceTheme('Alpha', 'alpha'),
  legacyPieceTheme('Bubblegum', 'bubblegum'),
  legacyPieceTheme('Dash', 'dash'),
  legacyPieceTheme('Graffiti', 'graffiti'),
  legacyPieceTheme('Light', 'light'),
  legacyPieceTheme('Lolz', 'lolz'),
  legacyPieceTheme('Luca', 'luca'),
  legacyPieceTheme('Maya', 'maya'),
  legacyPieceTheme('Modern', 'modern'),
  legacyPieceTheme('Nature', 'nature'),
  legacyPieceTheme('Neon', 'neon'),
  legacyPieceTheme('Sky', 'sky'),
  legacyPieceTheme('Tigers', 'tigers'),
  legacyPieceTheme('Tournament', 'tournament'),
  legacyPieceTheme('Vintage', 'vintage'),
  legacyPieceTheme('3D - Wood', '3d_wood'),
  legacyPieceTheme('3D - Staunton', '3d_staunton'),
  legacyPieceTheme('3D - Plastic', '3d_plastic'),
  legacyPieceTheme('Real 3D', 'real_3d', '3d_wood'),
];

export const CHESS_BACKGROUND_THEMES: ChessBackgroundTheme[] = [
  backgroundTheme('Standard', 'dark', 'dark.png'),
  backgroundTheme('Game Room', 'game_room', 'game_room.jpeg'),
  backgroundTheme('Classic', 'classic', 'classic.jpeg'),
  backgroundTheme('Light', 'light', 'light.png'),
  backgroundTheme('Wood', 'wood', 'wood.jpeg'),
  backgroundTheme('Glass', 'glass', 'glass.jpg'),
  backgroundTheme('Tournament', 'tournament', 'tournament.jpg'),
  backgroundTheme('Staunton', 'staunton', 'staunton.jpeg'),
  backgroundTheme('Newspaper', 'newspaper', 'newspaper.jpg'),
  backgroundTheme('Tigers', 'tigers', 'tigers.jpeg'),
  backgroundTheme('Nature', 'nature', 'nature.jpeg'),
  backgroundTheme('Sky', 'sky', 'sky.jpeg'),
  backgroundTheme('Cosmos', 'cosmos', 'space.jpeg'),
  backgroundTheme('Ocean', 'ocean', 'ocean.jpeg'),
  backgroundTheme('Metal', 'metal', 'metal.jpeg'),
  backgroundTheme('Gothic', 'gothic', 'gothic.jpeg'),
  backgroundTheme('Marble', 'marble', 'marble.jpeg'),
  backgroundTheme('Neon', 'neon', 'neon.jpg'),
  backgroundTheme('Graffiti', 'graffiti', 'graffiti.jpeg'),
  backgroundTheme('Bubblegum', 'bubblegum', 'bubblegum.jpeg'),
  backgroundTheme('Lolz', 'lolz', 'lolz.jpeg'),
  backgroundTheme('8-Bit', '8_bit', '8_bit.png'),
  backgroundTheme('Bases', 'bases', 'bases.jpg'),
  backgroundTheme('Blues', 'blues', 'blues.jpg'),
  backgroundTheme('Dash', 'dash', 'dash.jpg'),
  backgroundTheme('Icy Sea', 'icy_sea', 'icy_sea.png'),
  backgroundTheme('Walnut', 'walnut', 'walnut.jpg'),
  assetBackgroundTheme("Bots - Martin's Family", 'bots_martins_family', 'c4wi9'),
  assetBackgroundTheme('Chess The Musical', 'chess_the_musical', '6cob7'),
];

export const CHESS_SOUND_THEMES: ChessSoundTheme[] = [
  { name: 'Default', slug: 'default' },
  { name: 'Nature', slug: 'nature' },
  { name: 'Metal', slug: 'metal' },
  { name: 'Marble', slug: 'marble' },
  { name: 'Space', slug: 'space' },
  { name: 'Beat', slug: 'beat' },
  { name: 'Silly', slug: 'silly' },
  { name: 'Lolz', slug: 'lolz' },
  { name: 'Newspaper', slug: 'newspaper' },
  { name: 'Pebbles', slug: 'pebbles' },
];

export function getBoardPreviewUrl(slug: string) {
  return getBoardTheme(slug).previewUrl;
}

export function getBoardTextureUrl(slug: string) {
  return getBoardTheme(slug).textureUrl;
}

export function getPiecePreviewUrl(slug: string) {
  return getPieceAssetUrl(slug, 'wn');
}

export function getPieceAssetUrl(slug: string, piece: BoardPiece) {
  return `${getPieceTheme(slug).assetBaseUrl}/${piece}.png`;
}

export function getBackgroundPreviewUrl(theme: ChessBackgroundTheme) {
  return theme.previewUrl;
}

export function getBackgroundTextureUrl(theme: ChessBackgroundTheme) {
  return theme.backgroundUrl;
}

export function getBackgroundTextureUrlBySlug(slug: string) {
  return getBackgroundTheme(slug).backgroundUrl;
}

export function getSoundUrl(slug: string, soundName: string) {
  return `https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/${slug}/${soundName}.mp3`;
}

function getBoardTheme(slug: string) {
  return CHESS_BOARD_THEMES.find((theme) => theme.slug === slug) ?? CHESS_BOARD_THEMES[0];
}

function getPieceTheme(slug: string) {
  return CHESS_PIECE_THEMES.find((theme) => theme.slug === slug) ?? CHESS_PIECE_THEMES[6];
}

function getBackgroundTheme(slug: string) {
  return CHESS_BACKGROUND_THEMES.find((theme) => theme.slug === slug) ?? CHESS_BACKGROUND_THEMES[0];
}
