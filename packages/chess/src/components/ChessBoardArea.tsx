'use client';

import { SettingsIcon } from 'lucide-react';
import { TbLayoutSidebar, TbLayoutSidebarFilled } from 'react-icons/tb';
import { Button } from '@portfolio/ui/components/shadcn';
import { ChessBoard } from './ChessBoard';
import { ChessSettingsDialog } from './ChessSettingsDialog';
import { useChessGame } from '../hooks/useChessGame';
import { useAuthStore } from '@portfolio/auth/stores/authStore';
import { getBackgroundTextureUrlBySlug } from '../lib/chess-assets';
import { STANDARD_CHESS_START_FEN, getFenAtPly } from '../lib/chess-history';
import type { ChessSettings } from '../lib/chess-settings';
import type { ChessColor } from '../types/chess';

interface ChessBoardAreaProps {
  gameId: string | null;
  settings: ChessSettings;
  settingsOpen: boolean;
  viewedPly: number | null;
  primaryPanelCollapsed: boolean;
  onTogglePrimaryPanel: () => void;
  onOpenSettings: () => void;
  onCloseSettings: () => void;
  onSaveSettings: (settings: ChessSettings) => void;
  showPanelButton?: boolean;
}

function inferOrientation(snapshotUserId: string | undefined, whiteRefId: string | undefined, blackRefId: string | undefined): ChessColor {
  if (snapshotUserId && blackRefId === snapshotUserId) return 'black';
  if (snapshotUserId && whiteRefId === snapshotUserId) return 'white';
  return 'white';
}

/**
 * Render the selected chess board area experience.
 *
 * @param props - Selected game id, visual settings, and settings overlay callbacks.
 * @returns Empty, loading, or interactive chess board area state.
 */
export function ChessBoardArea({
  gameId,
  settings,
  settingsOpen,
  viewedPly,
  primaryPanelCollapsed,
  onTogglePrimaryPanel,
  onOpenSettings,
  onCloseSettings,
  onSaveSettings,
  showPanelButton = true,
}: ChessBoardAreaProps) {
  const user = useAuthStore((state) => state.user);
  const { snapshot, engineThinking, isLoading, isSubmittingMove, submitMove } = useChessGame(gameId);

  if (!gameId) {
    return (
      <ChessBoardAreaFrame
        settings={settings}
        settingsOpen={settingsOpen}
        primaryPanelCollapsed={primaryPanelCollapsed}
        onTogglePrimaryPanel={onTogglePrimaryPanel}
        onOpenSettings={onOpenSettings}
        onCloseSettings={onCloseSettings}
        onSaveSettings={onSaveSettings}
        showPanelButton={showPanelButton}
      >
        <div className="aspect-square size-[min(100cqw,100cqh)]">
          <ChessBoard
            fen={STANDARD_CHESS_START_FEN}
            legalMoves={[]}
            orientation="white"
            disabled
            settings={settings}
            onMove={() => {}}
          />
        </div>
      </ChessBoardAreaFrame>
    );
  }

  if (isLoading || !snapshot) {
    return (
      <ChessBoardAreaFrame
        settings={settings}
        settingsOpen={settingsOpen}
        primaryPanelCollapsed={primaryPanelCollapsed}
        onTogglePrimaryPanel={onTogglePrimaryPanel}
        onOpenSettings={onOpenSettings}
        onCloseSettings={onCloseSettings}
        onSaveSettings={onSaveSettings}
        showPanelButton={showPanelButton}
      >
        <div className="flex h-full min-h-[420px] items-center justify-center rounded-3xl border border-border-subtle bg-surface-1/90 p-10 text-center text-muted-foreground backdrop-blur-sm">
          Loading chess board area…
        </div>
      </ChessBoardAreaFrame>
    );
  }

  const orientation = inferOrientation(user?.id, snapshot.game.white.refId, snapshot.game.black.refId);
  const currentPly = snapshot.moves.length;
  const boundedViewedPly = Math.min(Math.max(viewedPly ?? currentPly, 0), currentPly);
  const isViewingLatestPosition = boundedViewedPly === currentPly;
  const boardFen = isViewingLatestPosition ? snapshot.game.currentFen : getFenAtPly(snapshot.game, snapshot.moves, boundedViewedPly);
  const disabled = snapshot.game.status !== 'active' || isSubmittingMove || engineThinking || !isViewingLatestPosition;

  return (
    <ChessBoardAreaFrame
      settings={settings}
      settingsOpen={settingsOpen}
      primaryPanelCollapsed={primaryPanelCollapsed}
      onTogglePrimaryPanel={onTogglePrimaryPanel}
      onOpenSettings={onOpenSettings}
      onCloseSettings={onCloseSettings}
      onSaveSettings={onSaveSettings}
      showPanelButton={showPanelButton}
    >
      <div className="aspect-square size-[min(100cqw,100cqh)]">
        <ChessBoard
          fen={boardFen}
          legalMoves={isViewingLatestPosition ? snapshot.legalMoves : []}
          orientation={orientation}
          disabled={disabled}
          settings={settings}
          onMove={submitMove}
        />
      </div>
    </ChessBoardAreaFrame>
  );
}

interface ChessBoardAreaFrameProps {
  children: React.ReactNode;
  settings: ChessSettings;
  settingsOpen: boolean;
  primaryPanelCollapsed: boolean;
  onTogglePrimaryPanel: () => void;
  onOpenSettings: () => void;
  onCloseSettings: () => void;
  onSaveSettings: (settings: ChessSettings) => void;
  showPanelButton?: boolean;
}

function ChessBoardAreaFrame({
  children,
  settings,
  settingsOpen,
  primaryPanelCollapsed,
  onTogglePrimaryPanel,
  onOpenSettings,
  onCloseSettings,
  onSaveSettings,
  showPanelButton = true,
}: ChessBoardAreaFrameProps) {
  return (
    <div className="relative grid size-full min-h-0 place-items-center overflow-hidden p-12 [container-type:size]">
      <ImageBackground src={getBackgroundTextureUrlBySlug(settings.backgroundSlug)} />
      <ChessBoardAreaControls
        primaryPanelCollapsed={primaryPanelCollapsed}
        settingsOpen={settingsOpen}
        onTogglePrimaryPanel={onTogglePrimaryPanel}
        onOpenSettings={onOpenSettings}
        showPanelButton={showPanelButton}
      />
      <div className="relative z-10 contents">{children}</div>
      <ChessSettingsDialog open={settingsOpen} settings={settings} onClose={onCloseSettings} onSave={onSaveSettings} />
    </div>
  );
}

interface ChessBoardAreaControlsProps {
  primaryPanelCollapsed: boolean;
  settingsOpen: boolean;
  onTogglePrimaryPanel: () => void;
  onOpenSettings: () => void;
  showPanelButton?: boolean;
}

/**
 * Render chess board area controls in the same absolute positioning context.
 *
 * @param props - Panel and settings control state.
 * @returns Chess board area control buttons.
 */
function ChessBoardAreaControls({ primaryPanelCollapsed, settingsOpen, onTogglePrimaryPanel, onOpenSettings, showPanelButton = true }: ChessBoardAreaControlsProps) {
  return (
    <div className="pointer-events-none absolute inset-x-3 top-3 z-30 flex items-center justify-between">
      {showPanelButton && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={primaryPanelCollapsed ? 'Expand primary panel' : 'Collapse primary panel'}
          onClick={onTogglePrimaryPanel}
          className="pointer-events-auto"
        >
          {primaryPanelCollapsed ? <TbLayoutSidebar className="size-4" /> : <TbLayoutSidebarFilled className="size-4" />}
        </Button>
      )}

      <div className={showPanelButton ? '' : 'ml-auto'}>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Open chess settings"
          aria-pressed={settingsOpen}
          onClick={onOpenSettings}
          className="pointer-events-auto"
        >
          <SettingsIcon className="size-4" />
        </Button>
      </div>
    </div>
  );
}

interface ImageBackgroundProps {
  src: string;
}

function ImageBackground({ src }: ImageBackgroundProps) {
  if (!src) {
    return <div className="absolute inset-0 bg-background" />;
  }

  return (
    <>
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${src})` }} />
      <div className="absolute inset-0 bg-background/45 backdrop-blur-[1px]" />
    </>
  );
}
