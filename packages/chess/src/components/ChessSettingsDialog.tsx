'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { Volume2Icon, XIcon } from 'lucide-react';
import {
  Button,
  Label,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@portfolio/ui/components/shadcn';
import {
  CHESS_MOVE_METHODS,
  getSettingsWithDefaults,
  type ChessMoveMethod,
  type ChessSettings,
} from '../lib/chess-settings';
import { CHESS_SOUND_THEMES, getPieceAssetUrl, getSoundUrl } from '../lib/chess-assets';
import { ChessThemeSettings, type ChessThemeSettingsSection } from './ChessThemeSettings';

interface ChessSettingsDialogProps {
  open: boolean;
  settings: ChessSettings;
  onClose: () => void;
  onSave: (settings: ChessSettings) => void;
}

type SettingsTab = 'board-pieces' | 'gameplay';
type ChessMoveMethodOption = (typeof CHESS_MOVE_METHODS)[number];

const SETTINGS_TABS: Array<{ value: SettingsTab; label: string }> = [
  { value: 'board-pieces', label: 'Board & Pieces' },
  { value: 'gameplay', label: 'Gameplay' },
];

/**
 * Render the chess settings overlay scoped to the board area.
 *
 * @param props - Overlay state, current settings, and save callback.
 * @returns Chess settings overlay.
 */
export function ChessSettingsDialog({ open, settings, onClose, onSave }: ChessSettingsDialogProps) {
  const [draft, setDraft] = useState(() => getSettingsWithDefaults(settings));
  const [activeTab, setActiveTab] = useState<SettingsTab>('board-pieces');
  const [themeSection, setThemeSection] = useState<ChessThemeSettingsSection>('boards');
  const selectedMoveMethod = useMemo(
    () => CHESS_MOVE_METHODS.find((method) => method.value === draft.moveMethod) ?? CHESS_MOVE_METHODS[0],
    [draft.moveMethod],
  );

  useEffect(() => {
    if (open) setDraft(getSettingsWithDefaults(settings));
  }, [open, settings]);

  function updateDraft(nextSettings: Partial<ChessSettings>) {
    setDraft((current) => ({ ...current, ...nextSettings }));
  }

  function saveDraft() {
    onSave(draft);
    onClose();
  }

  if (!open) return null;

  return (
    <div className="@container/settings-body absolute inset-0 z-40 grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden bg-surface-1 text-sm shadow-depth-lg backdrop-blur-xl">
      <div className="flex items-start justify-between gap-4 border-b border-border-subtle px-4 py-4 @[640px]/settings-body:px-6 @[640px]/settings-body:py-5">
        <div>
          <h2 className="text-base font-semibold">Chess Settings</h2>
          <p className="mt-1 text-sm text-muted-foreground">Customize the board, pieces, sounds, and move behavior.</p>
        </div>
        <Button type="button" variant="ghost" size="icon" aria-label="Close chess settings" onClick={onClose}>
          <XIcon className="size-4" />
        </Button>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as SettingsTab)}
        orientation="vertical"
        className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden @[920px]/settings-body:grid-cols-[220px_minmax(0,1fr)] @[920px]/settings-body:grid-rows-1"
      >
        <TabsList className="flex h-auto w-full justify-start overflow-x-auto rounded-none border-b border-border-subtle bg-transparent px-4 py-0 @[640px]/settings-body:px-6 @[920px]/settings-body:w-full @[920px]/settings-body:flex-col @[920px]/settings-body:self-start @[920px]/settings-body:overflow-visible @[920px]/settings-body:border-b-0 @[920px]/settings-body:border-l @[920px]/settings-body:pr-0">
          {SETTINGS_TABS.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="h-auto flex-1 shrink-0 justify-start rounded-none border-0 border-b-2 border-transparent bg-transparent px-4 py-3 text-left text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground data-[state=active]:border-black data-[state=active]:bg-muted/30 data-[state=active]:text-foreground data-[state=active]:shadow-none dark:data-[state=active]:border-white dark:data-[state=active]:bg-input/30 @[920px]/settings-body:w-full @[920px]/settings-body:flex-none @[920px]/settings-body:border-b-0 @[920px]/settings-body:border-l-2 @[920px]/settings-body:pr-0"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="board-pieces" className="min-h-0 overflow-y-auto p-0">
          <BoardPiecesSettings
            activeSection={themeSection}
            draft={draft}
            selectedMoveMethod={selectedMoveMethod}
            onSectionChange={setThemeSection}
            onUpdate={updateDraft}
          />
        </TabsContent>

        <TabsContent value="gameplay" className="min-h-0 overflow-auto p-0">
          <div className="flex flex-col gap-6 p-4 @[640px]/settings-body:p-6">
            <h3 className="text-sm font-semibold">Board Behavior</h3>
            <p className="-mt-5 text-sm text-muted-foreground">Configure coordinates, move highlighting, and how pieces move.</p>

            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <Switch checked={draft.showCoordinates} onCheckedChange={(checked) => updateDraft({ showCoordinates: checked })} id="chess-show-coordinates" />
                <Label htmlFor="chess-show-coordinates" className="font-medium">Show board coordinates</Label>
              </div>

              <RadioGroup
                value={draft.coordinatesPosition}
                onValueChange={(coordinatesPosition) => updateDraft({ coordinatesPosition: coordinatesPosition as ChessSettings['coordinatesPosition'] })}
                className="ml-11 gap-2"
                aria-label="Coordinate position"
              >
                <CoordinateOption value="inside" label="Inside" disabled={!draft.showCoordinates} />
                <CoordinateOption value="outside" label="Outside" disabled={!draft.showCoordinates} />
              </RadioGroup>

              <div className="flex items-center gap-3">
                <Switch checked={draft.highlightMoves} onCheckedChange={(checked) => updateDraft({ highlightMoves: checked })} id="chess-highlight-moves" />
                <Label htmlFor="chess-highlight-moves" className="font-medium">Highlight moves</Label>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-3 border-t border-border-subtle px-4 py-3 @[640px]/settings-body:px-6 @[640px]/settings-body:py-4">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="button" onClick={saveDraft}>Save Settings</Button>
      </div>
    </div>
  );
}

interface BoardPiecesSettingsProps {
  activeSection: ChessThemeSettingsSection;
  draft: ChessSettings;
  selectedMoveMethod: ChessMoveMethodOption;
  onSectionChange: (section: ChessThemeSettingsSection) => void;
  onUpdate: (settings: Partial<ChessSettings>) => void;
}

function BoardPiecesSettings({ activeSection, draft, selectedMoveMethod, onSectionChange, onUpdate }: BoardPiecesSettingsProps) {
  return (
    <div className="flex flex-col gap-6 p-4 @[640px]/settings-body:p-6">
      <h3 className="text-sm font-semibold">Board & Pieces</h3>
      <p className="-mt-5 text-sm text-muted-foreground">Customize the look and feel of your chess set.</p>

      <ChessThemeSettings activeSection={activeSection} settings={draft} onSectionChange={onSectionChange} onUpdate={onUpdate} />

      <h3 className="text-sm font-semibold">Piece Movement</h3>
      <p className="-mt-5 text-sm text-muted-foreground">Choose whether moves are made by dragging, clicking, or both.</p>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="chess-move-method">Move Method</Label>
          <Select value={draft.moveMethod} onValueChange={(moveMethod) => onUpdate({ moveMethod: moveMethod as ChessMoveMethod })}>
            <SelectTrigger id="chess-move-method" className="w-full bg-surface-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CHESS_MOVE_METHODS.map((method) => (
                <SelectItem key={method.value} value={method.value}>{method.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col items-center gap-4">
          <MoveMethodPreview />
          <div className="w-full">
            <h4 className="text-sm font-semibold">{selectedMoveMethod.label}</h4>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">{selectedMoveMethod.description}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col justify-center">
        <h3 className="text-sm font-semibold">Sounds</h3>
        <p className="text-sm text-muted-foreground">Choose a Chess.com sound theme and whether move sounds should play.</p>
        <div className="mt-3 flex items-center gap-3">
          <Switch checked={draft.soundsEnabled} onCheckedChange={(checked) => onUpdate({ soundsEnabled: checked })} id="chess-sounds-enabled" />
          <Label htmlFor="chess-sounds-enabled" className="font-medium">Play sounds</Label>
        </div>
      </div>

      <div className="flex flex-col">
        <Label htmlFor="chess-sound-theme">Sound Theme</Label>
        <div className="mt-3 flex items-center gap-2">
          <Select value={draft.soundSlug} onValueChange={(soundSlug) => onUpdate({ soundSlug })}>
            <SelectTrigger id="chess-sound-theme" className="w-full bg-surface-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CHESS_SOUND_THEMES.map((theme) => (
                <SelectItem key={theme.slug} value={theme.slug}>{theme.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" size="icon" className="shrink-0" aria-label="Preview sound" onClick={() => previewSound(draft.soundSlug)}>
            <Volume2Icon className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

interface CoordinateOptionProps {
  value: ChessSettings['coordinatesPosition'];
  label: string;
  disabled: boolean;
}

function CoordinateOption({ value, label, disabled }: CoordinateOptionProps) {
  return (
    <div className="flex items-center gap-2">
      <RadioGroupItem value={value} id={`coordinate-${value}`} disabled={disabled} />
      <Label htmlFor={`coordinate-${value}`} className={disabled ? 'text-muted-foreground/50' : 'text-muted-foreground'}>
        {label}
      </Label>
    </div>
  );
}

function MoveMethodPreview() {
  return (
    <div className="grid aspect-square w-40 grid-cols-4 grid-rows-4 overflow-hidden rounded-lg border border-border-subtle bg-surface-2">
      {Array.from({ length: 16 }).map((_, index) => (
        <div key={index} className={(index + Math.floor(index / 4)) % 2 === 0 ? 'bg-[#ecf0cf]' : 'bg-[#7a9a59]'}>
          {index === 9 && <div className="size-full bg-yellow-300/80" />}
        </div>
      ))}
      <Image src={getPieceAssetUrl('classic', 'wk')} alt="" width={44} height={44} unoptimized className="col-start-1 row-start-4 place-self-center drop-shadow-md" />
      <Image src={getPieceAssetUrl('classic', 'wb')} alt="" width={44} height={44} unoptimized className="col-start-2 row-start-4 place-self-center drop-shadow-md" />
      <Image src={getPieceAssetUrl('classic', 'wq')} alt="" width={44} height={44} unoptimized className="col-start-3 row-start-4 place-self-center drop-shadow-md" />
      <Image src={getPieceAssetUrl('classic', 'wr')} alt="" width={44} height={44} unoptimized className="col-start-4 row-start-4 place-self-center drop-shadow-md" />
    </div>
  );
}

function previewSound(soundSlug: string) {
  const audio = new Audio(getSoundUrl(soundSlug, 'move-self'));
  void audio.play();
}
