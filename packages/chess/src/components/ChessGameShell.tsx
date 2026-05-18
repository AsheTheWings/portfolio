'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useAuthStore } from '@portfolio/auth/stores/authStore';
import { AuthGate } from '@portfolio/auth/components/AuthGate';
import { createChessGame, fetchChessGames } from '../lib/chess-api';
import {
  CHESS_SETTINGS_STORAGE_KEY,
  DEFAULT_CHESS_SETTINGS,
  getSettingsWithDefaults,
  type ChessSettings,
} from '../lib/chess-settings';
import { useChessStore } from '../stores/useChessStore';
import { ChessBoardArea } from './ChessBoardArea';
import { ChessPrimaryPanel } from './ChessPrimaryPanel';
import { BOARD_MIN_SIZE_PX, ChessSplitLayout, SECONDARY_MIN_SIZE_PX } from './ChessSplitLayout';
import { useChessGame } from '../hooks/useChessGame';
import type { ChessColor } from '../types/chess';
import type { PanelSize } from 'react-resizable-panels';
import type { UserPublic } from '@portfolio/auth/types';

export type ChessGameShellVariant = 'standalone' | 'timeline-embedded';

type PrimaryPanelMode = 'open' | 'auto-collapsed' | 'manual-collapsed' | 'manual-open';

const PANEL_AUTO_THRESHOLD_PERCENT = 40;

function isPanelAtAutoThreshold(size: PanelSize, minSizePx: number) {
  return size.asPercentage <= PANEL_AUTO_THRESHOLD_PERCENT || size.inPixels <= minSizePx;
}

interface ChessGameShellProps {
  initialUser: UserPublic | null;
  variant?: ChessGameShellVariant;
}

/**
 * Compose the chess experience for standalone and Timeline-embedded routes.
 *
 * @param props - Server-authenticated initial user and route presentation variant.
 * @returns Chess product shell.
 */
export function ChessGameShell({ initialUser, variant = 'standalone' }: ChessGameShellProps) {
  const { user, isAuthenticated, _hydrated, setUser } = useAuthStore();
  const games = useChessStore((state) => state.games);
  const selectedGameId = useChessStore((state) => state.selectedGameId);
  const snapshot = useChessStore((state) => (selectedGameId ? state.snapshots[selectedGameId] : undefined));
  const error = useChessStore((state) => state.error);
  const setGames = useChessStore((state) => state.setGames);
  const selectGame = useChessStore((state) => state.selectGame);
  const upsertSnapshot = useChessStore((state) => state.upsertSnapshot);
  const setError = useChessStore((state) => state.setError);
  const [isCreating, setIsCreating] = useState(false);
  const [primaryPanelMode, setPrimaryPanelMode] = useState<PrimaryPanelMode>('open');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<ChessSettings>(DEFAULT_CHESS_SETTINGS);
  const controlsGame = useChessGame(selectedGameId);
  const lastToastedErrorRef = useRef<string | null>(null);
  const primaryPanelCollapsed = primaryPanelMode === 'auto-collapsed' || primaryPanelMode === 'manual-collapsed';

  const handleBoardResize = useCallback((size: PanelSize) => {
    const boardAtCollapseThreshold = isPanelAtAutoThreshold(size, BOARD_MIN_SIZE_PX);

    setPrimaryPanelMode((currentMode) => {
      if (currentMode === 'manual-collapsed') return currentMode;
      if (currentMode === 'manual-open') return boardAtCollapseThreshold ? currentMode : 'open';
      if (currentMode === 'open' && boardAtCollapseThreshold) return 'auto-collapsed';
      return currentMode;
    });
  }, []);

  const handleSecondaryResize = useCallback((size: PanelSize) => {
    const secondaryAtExpandThreshold = isPanelAtAutoThreshold(size, SECONDARY_MIN_SIZE_PX);

    setPrimaryPanelMode((currentMode) => {
      if (currentMode !== 'auto-collapsed') return currentMode;
      return secondaryAtExpandThreshold ? 'open' : currentMode;
    });
  }, []);

  function collapsePrimaryPanel() {
    setPrimaryPanelMode('manual-collapsed');
  }

  function expandPrimaryPanel() {
    setPrimaryPanelMode('manual-open');
  }

  useEffect(() => {
    if (!error) {
      lastToastedErrorRef.current = null;
      return;
    }

    if (lastToastedErrorRef.current === error) return;
    lastToastedErrorRef.current = error;
    toast.error('Chess error', { description: error });
  }, [error]);

  useEffect(() => {
    if (initialUser && !user) setUser(initialUser);
  }, [initialUser, setUser, user]);

  useEffect(() => {
    const rawSettings = window.localStorage.getItem(CHESS_SETTINGS_STORAGE_KEY);
    if (!rawSettings) return;

    try {
      setSettings(getSettingsWithDefaults(JSON.parse(rawSettings)));
    } catch {
      setSettings(DEFAULT_CHESS_SETTINGS);
    }
  }, []);

  function saveSettings(nextSettings: ChessSettings) {
    const settingsWithDefaults = getSettingsWithDefaults(nextSettings);
    setSettings(settingsWithDefaults);
    window.localStorage.setItem(CHESS_SETTINGS_STORAGE_KEY, JSON.stringify(settingsWithDefaults));
  }

  const effectiveUser = _hydrated ? user : (user ?? initialUser);
  const effectiveAuth = _hydrated ? isAuthenticated : (isAuthenticated || !!initialUser);

  useEffect(() => {
    if (!effectiveAuth) return;
    let cancelled = false;
    fetchChessGames()
      .then((nextGames) => {
        if (cancelled) return;
        setGames(nextGames);
        if (!selectedGameId && nextGames[0]) selectGame(nextGames[0].id);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load chess games');
      });
    return () => {
      cancelled = true;
    };
  }, [effectiveAuth, selectGame, selectedGameId, setError, setGames]);

  if (!effectiveAuth || !effectiveUser) return <AuthGate />;

  async function handleCreateGame({ humanColor, skillLevel }: { humanColor: ChessColor; skillLevel: number }) {
    setIsCreating(true);
    setError(null);
    try {
      const nextSnapshot = await createChessGame({
        mode: 'human_vs_engine',
        humanColor,
        engineConfig: {
          enabled: true,
          skillLevel,
          movetimeMs: 700,
          multipv: 3,
        },
        autoStart: true,
      });
      upsertSnapshot(nextSnapshot);
      selectGame(nextSnapshot.game.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create game');
    } finally {
      setIsCreating(false);
    }
  }

  const isTimelineEmbedded = variant === 'timeline-embedded';
  const rootClassName = isTimelineEmbedded
    ? 'h-dvh overflow-hidden bg-background pl-20'
    : 'h-dvh overflow-hidden bg-background';
  const contentClassName = isTimelineEmbedded
    ? 'relative flex h-full min-h-0 gap-0'
    : 'relative flex h-full min-h-0 w-full gap-0';

  return (
    <main className={rootClassName}>
      <div className={contentClassName}>
        <div className="relative flex h-full shrink-0">
          {!primaryPanelCollapsed && (
            <ChessPrimaryPanel
              games={games}
              selectedGameId={selectedGameId}
              snapshot={snapshot}
              connectionState={selectedGameId ? controlsGame.connectionState : 'idle'}
              engineThinking={controlsGame.engineThinking}
              onCreateGame={handleCreateGame}
              onSelectGame={selectGame}
              onResign={() => void controlsGame.resign()}
              onAbort={() => void controlsGame.abort()}
              isCreating={isCreating}
            />
          )}
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <ChessSplitLayout
            board={
              <ChessBoardArea
                gameId={selectedGameId}
                settings={settings}
                settingsOpen={settingsOpen}
                primaryPanelCollapsed={primaryPanelCollapsed}
                onTogglePrimaryPanel={primaryPanelCollapsed ? expandPrimaryPanel : collapsePrimaryPanel}
                onOpenSettings={() => setSettingsOpen(true)}
                onCloseSettings={() => setSettingsOpen(false)}
                onSaveSettings={saveSettings}
              />
            }
            secondary={<div className="h-full" aria-label="Secondary chess panel" />}
            onBoardResize={handleBoardResize}
            onSecondaryResize={handleSecondaryResize}
          />
        </div>
      </div>
    </main>
  );
}
