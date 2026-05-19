'use client';

import Image from 'next/image';
import { CheckIcon } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@portfolio/ui/components/shadcn';
import {
  CHESS_BACKGROUND_THEMES,
  CHESS_BOARD_THEMES,
  CHESS_PIECE_THEMES,
  getBackgroundPreviewUrl,
  getBoardPreviewUrl,
  getBoardTextureUrl,
  getPieceAssetUrl,
  getPiecePreviewUrl,
} from '../lib/chess-assets';
import type { ChessSettings } from '../lib/chess-settings';
import type { BoardPiece } from '../types/chess';
import type { ReactNode } from 'react';

export type ChessThemeSettingsSection = 'boards' | 'pieces' | 'background';

interface ChessThemeSettingsProps {
  activeSection: ChessThemeSettingsSection;
  settings: ChessSettings;
  onSectionChange: (section: ChessThemeSettingsSection) => void;
  onUpdate: (settings: Partial<ChessSettings>) => void;
}

const PREVIEW_PIECES: Array<{ piece: BoardPiece; squareClassName: string }> = [
  { piece: 'bb', squareClassName: 'col-start-1 row-start-1' },
  { piece: 'bq', squareClassName: 'col-start-2 row-start-1' },
  { piece: 'bp', squareClassName: 'col-start-3 row-start-1' },
  { piece: 'wn', squareClassName: 'col-start-1 row-start-3' },
  { piece: 'wk', squareClassName: 'col-start-2 row-start-3' },
  { piece: 'wr', squareClassName: 'col-start-3 row-start-3' },
];

const THEME_SECTIONS: Array<{ value: ChessThemeSettingsSection; label: string }> = [
  { value: 'boards', label: 'Boards' },
  { value: 'pieces', label: 'Pieces' },
  { value: 'background', label: 'Background' },
];

export function ChessThemeSettings({ activeSection, settings, onSectionChange, onUpdate }: ChessThemeSettingsProps) {
  return (
    <section className="flex flex-col gap-6 @[640px]/settings-body:flex-row-reverse">
      <BoardPreview boardSlug={settings.boardSlug} pieceSlug={settings.pieceSlug} />

      <div className="flex min-w-0 flex-col gap-4 @[640px]/settings-body:flex-1">
        <Tabs value={activeSection} onValueChange={(value) => onSectionChange(value as ChessThemeSettingsSection)}>
          <TabsList className="flex h-auto w-full justify-start overflow-x-auto rounded-none border-b border-border-subtle bg-transparent p-0">
            {THEME_SECTIONS.map((section) => (
              <TabsTrigger
                key={section.value}
                value={section.value}
                className="h-auto flex-1 shrink-0 rounded-none border-0 border-b-2 border-transparent bg-transparent px-4 py-3 text-sm font-semibold text-muted-foreground shadow-none transition-colors hover:bg-transparent hover:text-foreground data-[state=active]:border-black data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none dark:data-[state=active]:border-white dark:data-[state=active]:bg-transparent"
              >
                {section.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="h-[420px] overflow-y-auto p-2">
          {activeSection === 'boards' && (
            <AssetGrid columns="grid-cols-[repeat(auto-fill,minmax(92px,1fr))]">
              {CHESS_BOARD_THEMES.map((theme) => (
                <AssetTile
                  key={theme.slug}
                  label={theme.name}
                  selected={settings.boardSlug === theme.slug}
                  onSelect={() => onUpdate({ boardSlug: theme.slug })}
                >
                  <Image src={getBoardPreviewUrl(theme.slug)} alt="" fill unoptimized sizes="96px" className="scale-[1.035] object-cover" />
                </AssetTile>
              ))}
            </AssetGrid>
          )}

          {activeSection === 'pieces' && (
            <AssetGrid columns="grid-cols-[repeat(auto-fill,minmax(84px,1fr))]">
              {CHESS_PIECE_THEMES.map((theme) => (
                <AssetTile
                  key={theme.slug}
                  label={theme.name}
                  selected={settings.pieceSlug === theme.slug}
                  onSelect={() => onUpdate({ pieceSlug: theme.slug })}
                >
                  <div className="flex size-full items-center justify-center bg-surface-2">
                    <Image src={getPiecePreviewUrl(theme.slug)} alt="" width={70} height={70} unoptimized className="object-contain drop-shadow-md" />
                  </div>
                </AssetTile>
              ))}
            </AssetGrid>
          )}

          {activeSection === 'background' && (
            <div className="grid gap-2">
              {CHESS_BACKGROUND_THEMES.map((theme) => (
                <button
                  key={theme.slug}
                  type="button"
                  onClick={() => onUpdate({ backgroundSlug: theme.slug })}
                  className={`group relative flex h-16 items-center overflow-hidden rounded-lg border text-left transition ${
                    settings.backgroundSlug === theme.slug
                      ? 'border-primary ring-2 ring-primary/30'
                      : 'border-border-subtle hover:border-primary/60'
                  }`}
                >
                  {theme.slug === 'default' ? (
                    <div className="absolute inset-0 bg-background" />
                  ) : (
                    <Image src={getBackgroundPreviewUrl(theme)} alt="" fill unoptimized sizes="420px" className="object-cover opacity-70 transition group-hover:opacity-90" />
                  )}
                  <span className={`relative z-10 px-4 text-sm font-semibold ${theme.slug === 'default' ? 'text-foreground' : 'text-white drop-shadow-md'}`}>{theme.name}</span>
                  {settings.backgroundSlug === theme.slug && <SelectionBadge className="right-4 top-1/2 -translate-y-1/2" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

interface AssetGridProps {
  children: ReactNode;
  columns: string;
}

function AssetGrid({ children, columns }: AssetGridProps) {
  return <div className={`grid gap-x-3 gap-y-5 ${columns}`}>{children}</div>;
}

interface AssetTileProps {
  children: ReactNode;
  label: string;
  selected: boolean;
  onSelect: () => void;
}

function AssetTile({ children, label, selected, onSelect }: AssetTileProps) {
  return (
    <button type="button" onClick={onSelect} className="group grid gap-2 text-center">
      <span
        className={`relative aspect-square overflow-hidden rounded-lg border border-border-subtle transition-transform duration-150 group-hover:scale-[1.025] ${
          selected ? 'ring-2 ring-primary/30' : ''
        }`}
      >
        {children}
        {selected && <SelectionBadge className="right-2 top-2" />}
      </span>
      <span className="truncate text-xs font-medium text-muted-foreground group-hover:text-foreground">{label}</span>
    </button>
  );
}

interface SelectionBadgeProps {
  className: string;
}

function SelectionBadge({ className }: SelectionBadgeProps) {
  return (
    <span className={`absolute z-20 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-depth-sm ${className}`}>
      <CheckIcon className="size-4" />
    </span>
  );
}

interface BoardPreviewProps {
  boardSlug: string;
  pieceSlug: string;
}

function BoardPreview({ boardSlug, pieceSlug }: BoardPreviewProps) {
  return (
    <div className="relative aspect-square w-full max-w-[200px] self-center overflow-hidden rounded-xl border border-border-subtle bg-surface-2 shadow-depth-sm @[640px]/settings-body:max-w-[260px]">
      <Image src={getBoardTextureUrl(boardSlug)} alt="" fill unoptimized sizes="(min-width: 640px) 260px, 200px" className="origin-top-left scale-[2.6667] object-cover" />
      <div className="relative z-10 grid size-full grid-cols-3 grid-rows-3">
        {PREVIEW_PIECES.map((previewPiece) => (
          <div key={`${previewPiece.piece}-${previewPiece.squareClassName}`} className={`flex items-center justify-center ${previewPiece.squareClassName}`}>
            <Image
              src={getPieceAssetUrl(pieceSlug, previewPiece.piece)}
              alt=""
              width={104}
              height={104}
              unoptimized
              className="h-[82%] w-[82%] object-contain drop-shadow-lg"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
