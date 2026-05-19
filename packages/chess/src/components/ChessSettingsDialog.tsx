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
  PIECE_NOTATION_OPTIONS,
  getSettingsWithDefaults,
  type ChessMoveMethod,
  type ChessSettings,
  type PieceNotation,
} from '../lib/chess-settings';
import { CHESS_SOUND_THEMES, getPieceAssetUrl, getSoundUrl } from '../lib/chess-assets';
import { useTheme, type Theme } from '@portfolio/ui/contexts/ThemeContext';
import { ChessThemeSettings, type ChessThemeSettingsSection } from './ChessThemeSettings';

interface ChessSettingsDialogProps {
  open: boolean;
  settings: ChessSettings;
  onClose: () => void;
  onSave: (settings: ChessSettings) => void;
}

type SettingsTab = 'general' | 'gameplay';
type ChessMoveMethodOption = (typeof CHESS_MOVE_METHODS)[number];

const SETTINGS_TABS: Array<{ value: SettingsTab; label: string }> = [
  { value: 'general', label: 'General' },
  { value: 'gameplay', label: 'Gameplay' },
];

const THEME_OPTIONS: Array<{ value: Theme; label: string }> = [
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
];

/**
 * Render the chess settings overlay scoped to the board area.
 *
 * @param props - Overlay state, current settings, and save callback.
 * @returns Chess settings overlay.
 */
export function ChessSettingsDialog({ open, settings, onClose, onSave }: ChessSettingsDialogProps) {
  const { theme, setTheme } = useTheme();
  const [draft, setDraft] = useState(() => getSettingsWithDefaults(settings));
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
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
    <div className="@container/settings-body fixed inset-0 z-40 grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden bg-surface-1 text-sm shadow-depth-lg backdrop-blur-xl lg:absolute">
      <div className="flex items-start justify-between gap-4 border-b border-border-subtle px-4 py-4 @[640px]/settings-body:px-6 @[640px]/settings-body:py-5">
        <div>
          <h2 className="text-base font-semibold md:text-xl">Chess Settings</h2>
          <p className="mt-1 text-xs text-muted-foreground md:text-sm">Customize the board, pieces, sounds, and move behavior.</p>
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
        <TabsList className="flex h-auto w-full justify-start overflow-x-auto rounded-none border-b border-border-subtle bg-transparent p-0 @[920px]/settings-body:ml-6 @[920px]/settings-body:w-[calc(100%-1.5rem)] @[920px]/settings-body:flex-col @[920px]/settings-body:self-start @[920px]/settings-body:overflow-visible @[920px]/settings-body:rounded-none @[920px]/settings-body:border-b-0 @[920px]/settings-body:border-l">
          {SETTINGS_TABS.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="h-auto flex-1 shrink-0 justify-start rounded-none border-0 border-b-2 border-transparent bg-transparent px-4 py-3 text-left text-sm font-semibold text-muted-foreground shadow-none transition-colors hover:bg-transparent hover:text-foreground data-[state=active]:border-black data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none dark:data-[state=active]:border-white dark:data-[state=active]:bg-transparent md:text-base @[920px]/settings-body:w-full @[920px]/settings-body:flex-none @[920px]/settings-body:border-b-0 @[920px]/settings-body:border-l-2"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="general" className="min-h-0 overflow-y-auto p-0">
          <GeneralSettings
            activeSection={themeSection}
            appTheme={theme}
            draft={draft}
            selectedMoveMethod={selectedMoveMethod}
            onAppThemeChange={setTheme}
            onSectionChange={setThemeSection}
            onUpdate={updateDraft}
          />
        </TabsContent>

        <TabsContent value="gameplay" className="min-h-0 overflow-auto p-0">
          <div className="flex flex-col gap-6 p-4 @[640px]/settings-body:p-6">
            <div className="flex flex-col">
              <h3 className="text-sm font-semibold md:text-base">Board Behavior</h3>
              <p className="text-xs text-muted-foreground">Configure coordinates, move highlighting, and how pieces move.</p>

              <div className="mt-3 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <Switch checked={draft.showCoordinates} onCheckedChange={(checked) => updateDraft({ showCoordinates: checked })} id="chess-show-coordinates" />
                  <Label htmlFor="chess-show-coordinates" className="text-xs font-medium md:text-sm">Show board coordinates</Label>
                </div>

                <RadioGroup
                  value={draft.coordinatesPosition}
                  onValueChange={(coordinatesPosition) => updateDraft({ coordinatesPosition: coordinatesPosition as ChessSettings['coordinatesPosition'] })}
                  className="ml-11 gap-3"
                  aria-label="Coordinate position"
                >
                  <CoordinateOption value="inside" label="Inside" disabled={!draft.showCoordinates} />
                  <CoordinateOption value="outside" label="Outside" disabled={!draft.showCoordinates} />
                </RadioGroup>

                <div className="flex items-center gap-3">
                  <Switch checked={draft.highlightMoves} onCheckedChange={(checked) => updateDraft({ highlightMoves: checked })} id="chess-highlight-moves" />
                  <Label htmlFor="chess-highlight-moves" className="text-xs font-medium md:text-sm">Highlight moves</Label>
                </div>
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

interface GeneralSettingsProps {
  activeSection: ChessThemeSettingsSection;
  appTheme: Theme;
  draft: ChessSettings;
  selectedMoveMethod: ChessMoveMethodOption;
  onAppThemeChange: (theme: Theme) => void;
  onSectionChange: (section: ChessThemeSettingsSection) => void;
  onUpdate: (settings: Partial<ChessSettings>) => void;
}

function GeneralSettings({ activeSection, appTheme, draft, selectedMoveMethod, onAppThemeChange, onSectionChange, onUpdate }: GeneralSettingsProps) {
  return (
    <div className="flex flex-col gap-6 p-4 @[640px]/settings-body:p-6">
      <div className="flex flex-col">
        <h3 className="text-sm font-semibold md:text-base">Theme</h3>
        <p className="text-xs text-muted-foreground">Choose how the interface adapts to your display preference.</p>

        <div className="mt-3">
          <RadioGroup value={appTheme} onValueChange={(value) => onAppThemeChange(value as Theme)} className="grid grid-cols-3 gap-2" aria-label="Interface theme">
            {THEME_OPTIONS.map((option) => (
              <Label
                key={option.value}
                className="flex cursor-pointer items-center justify-center rounded-lg border border-border-subtle px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-muted/40 has-[[data-state=checked]]:text-foreground dark:has-[[data-state=checked]]:bg-input/30 md:text-sm"
              >
                <RadioGroupItem value={option.value} className="sr-only" />
                {option.label}
              </Label>
            ))}
          </RadioGroup>
        </div>
      </div>

      <div className="flex flex-col">
        <h3 className="text-sm font-semibold md:text-base">Board & Pieces</h3>
        <p className="text-xs text-muted-foreground">Customize the look and feel of your chess set.</p>

        <div className="mt-3">
          <ChessThemeSettings activeSection={activeSection} settings={draft} onSectionChange={onSectionChange} onUpdate={onUpdate} />
        </div>
      </div>

      <div className="flex flex-col">
        <h3 className="text-sm font-semibold md:text-base">Piece Movement</h3>
        <p className="text-xs text-muted-foreground">Choose whether moves are made by dragging, clicking, or both.</p>

        <div className="mt-3 flex flex-col gap-3">
          <div className="grid gap-3 @[640px]/settings-body:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="chess-move-method" className="text-xs md:text-sm">Move Method</Label>
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

            <div className="flex flex-col gap-2">
              <Label htmlFor="chess-piece-notation" className="text-xs md:text-sm">Piece Notation</Label>
              <Select value={draft.pieceNotation} onValueChange={(pieceNotation) => onUpdate({ pieceNotation: pieceNotation as PieceNotation })}>
                <SelectTrigger id="chess-piece-notation" className="w-full bg-surface-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PIECE_NOTATION_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col items-center gap-4">
            <MoveMethodPreview />
            <div className="w-full">
              <h4 className="text-xs font-semibold md:text-sm">{selectedMoveMethod.label}</h4>
              <p className="text-xs text-muted-foreground">{selectedMoveMethod.description}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col">
        <h3 className="text-sm font-semibold md:text-base">Sounds</h3>
        <p className="text-xs text-muted-foreground">Choose a Chess.com sound theme and whether move sounds should play.</p>

        <div className="mt-3 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Switch checked={draft.soundsEnabled} onCheckedChange={(checked) => onUpdate({ soundsEnabled: checked })} id="chess-sounds-enabled" />
            <Label htmlFor="chess-sounds-enabled" className="text-xs font-medium md:text-sm">Play sounds</Label>
          </div>

          <div className="flex flex-col">
            <Label htmlFor="chess-sound-theme" className="text-xs md:text-sm">Sound Theme</Label>
            <div className="mt-3 flex items-center gap-3">
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
      <Label htmlFor={`coordinate-${value}`} className={`text-xs ${disabled ? 'text-muted-foreground/50' : 'text-muted-foreground'} md:text-sm`}>
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
