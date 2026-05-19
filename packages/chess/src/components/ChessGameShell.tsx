'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuthStore } from '@portfolio/auth/stores/authStore';
import { AuthGate } from '@portfolio/auth/components/AuthGate';
import { createChessGame, fetchChessEngineProfiles, fetchChessGames } from '../lib/chess-api';
import {
  CHESS_SETTINGS_COOKIE_KEY,
  CHESS_SETTINGS_MAX_AGE_SECONDS,
  DEFAULT_CHESS_SETTINGS,
  getSettingsWithDefaults,
  serializeChessSettingsCookie,
  type ChessSettings,
} from '../lib/chess-settings';
import { useChessStore } from '../stores/useChessStore';
import { ChessBoardArea } from './ChessBoardArea';
import { ChessPrimaryPanel } from './ChessPrimaryPanel';
import { ChessResponsiveLayout } from './ChessResponsiveLayout';
import { BOARD_MIN_SIZE_PX, SECONDARY_MIN_SIZE_PX } from './ChessSplitLayout';
import { useChessGame } from '../hooks/useChessGame';
import type { ChessColor, ChessEngineProfile, ChessGameRecord, ChessGameSnapshot } from '../types/chess';
import type { PanelSize } from 'react-resizable-panels';
import type { UserPublic } from '@portfolio/auth/types';

export type ChessGameShellVariant = 'standalone' | 'timeline-embedded';
export type ChessRouteFamily = 'standalone' | 'timeline';

type PrimaryPanelMode = 'open' | 'auto-collapsed' | 'manual-collapsed' | 'manual-open';

const PANEL_AUTO_THRESHOLD_PERCENT = 40;

function isPanelAtAutoThreshold(size: PanelSize, minSizePx: number) {
  return size.asPercentage <= PANEL_AUTO_THRESHOLD_PERCENT || size.inPixels <= minSizePx;
}

interface ChessGameShellProps {
  initialUser: UserPublic | null;
  variant?: ChessGameShellVariant;
  routeFamily?: ChessRouteFamily;
  routeGameId?: string | null;
  initialGames?: ChessGameRecord[];
  initialSnapshot?: ChessGameSnapshot | null;
  initialEngineProfiles?: ChessEngineProfile[];
  initialSettings?: ChessSettings;
}

function gameHref(routeFamily: ChessRouteFamily, gameId: string | null): string {
  const base = routeFamily === 'timeline' ? '/apps/timeline/chess' : '/apps/chess';
  return gameId ? `${base}/${gameId}` : base;
}

/**
 * Compose the chess experience for standalone and Timeline-embedded routes.
 *
 * @param props - Server-authenticated initial user, route state, and presentation variant.
 * @returns Chess product shell.
 */
export function ChessGameShell({
  initialUser,
  variant = 'standalone',
  routeFamily = variant === 'timeline-embedded' ? 'timeline' : 'standalone',
  routeGameId = null,
  initialGames = [],
  initialSnapshot = null,
  initialEngineProfiles = [],
  initialSettings = DEFAULT_CHESS_SETTINGS,
}: ChessGameShellProps) {
  const router = useRouter();
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
  const [settings, setSettings] = useState<ChessSettings>(() => getSettingsWithDefaults(initialSettings));
  const [engineProfiles, setEngineProfiles] = useState<ChessEngineProfile[]>(initialEngineProfiles);
  const [viewedPlyByGameId, setViewedPlyByGameId] = useState<Record<string, number>>({});
  const [isMovePlaybackRunning, setIsMovePlaybackRunning] = useState(false);
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
    setGames(initialGames);
    selectGame(routeGameId);
    if (initialSnapshot) upsertSnapshot(initialSnapshot);
  }, [initialGames, initialSnapshot, routeGameId, selectGame, setGames, upsertSnapshot]);

  function saveSettings(nextSettings: ChessSettings) {
    const settingsWithDefaults = getSettingsWithDefaults(nextSettings);
    setSettings(settingsWithDefaults);
    document.cookie = `${CHESS_SETTINGS_COOKIE_KEY}=${serializeChessSettingsCookie(settingsWithDefaults)}; Path=/; Max-Age=${CHESS_SETTINGS_MAX_AGE_SECONDS}; SameSite=Lax`;
  }

  const selectedMoveCount = snapshot?.moves.length ?? 0;
  const viewedPly = selectedGameId ? (viewedPlyByGameId[selectedGameId] ?? selectedMoveCount) : 0;

  function setSelectedViewedPly(nextPly: number) {
    if (!selectedGameId) return;
    const boundedPly = Math.min(Math.max(nextPly, 0), selectedMoveCount);
    setViewedPlyByGameId((current) => ({ ...current, [selectedGameId]: boundedPly }));
  }

  const effectiveUser = _hydrated ? user : (user ?? initialUser);
  const effectiveAuth = _hydrated ? isAuthenticated : (isAuthenticated || !!initialUser);

  useEffect(() => {
    if (!selectedGameId) {
      setIsMovePlaybackRunning(false);
      return;
    }

    setViewedPlyByGameId((current) => {
      const currentViewedPly = current[selectedGameId];
      if (currentViewedPly === undefined || currentViewedPly > selectedMoveCount) {
        return { ...current, [selectedGameId]: selectedMoveCount };
      }

      return current;
    });
  }, [selectedGameId, selectedMoveCount]);

  useEffect(() => {
    if (!isMovePlaybackRunning || !selectedGameId) return;
    if (viewedPly >= selectedMoveCount) {
      setIsMovePlaybackRunning(false);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setSelectedViewedPly(viewedPly + 1);
    }, 1000);

    return () => window.clearTimeout(timeoutId);
  }, [isMovePlaybackRunning, selectedGameId, selectedMoveCount, viewedPly]);

  useEffect(() => {
    if (!effectiveAuth) return;
    let cancelled = false;
    fetchChessEngineProfiles()
      .then((nextProfiles) => {
        if (!cancelled) setEngineProfiles(nextProfiles);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load chess engines');
      });
    return () => {
      cancelled = true;
    };
  }, [effectiveAuth, setError]);

  useEffect(() => {
    if (!effectiveAuth) return;
    let cancelled = false;
    fetchChessGames()
      .then((nextGames) => {
        if (cancelled) return;
        setGames(nextGames);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load chess games');
      });
    return () => {
      cancelled = true;
    };
  }, [effectiveAuth, setError, setGames]);

  if (!effectiveAuth || !effectiveUser) return <AuthGate />;

  async function handleCreateGame({ humanColor, engineProfileId, skillLevel }: { humanColor: ChessColor; engineProfileId: string; skillLevel: number }) {
    setIsCreating(true);
    setError(null);
    try {
      const nextSnapshot = await createChessGame({
        mode: 'human_vs_engine',
        humanColor,
        engineProfileId,
        engineConfig: {
          enabled: true,
          skillLevel,
          movetimeMs: 700,
          multipv: 3,
        },
        autoStart: true,
      });
      upsertSnapshot(nextSnapshot);
      router.push(gameHref(routeFamily, nextSnapshot.game.id));
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
    ? 'relative flex h-full min-h-0 gap-0 flex-col lg:flex-row'
    : 'relative flex h-full min-h-0 w-full gap-0 flex-col lg:flex-row';

  return (
    <main className={rootClassName}>
      <div className={contentClassName}>
        <ChessResponsiveLayout
          primaryPanelCollapsed={primaryPanelCollapsed}
          renderBoard={(layout) => (
            <ChessBoardArea
              gameId={selectedGameId}
              settings={settings}
              settingsOpen={settingsOpen}
              viewedPly={viewedPly}
              primaryPanelCollapsed={layout === 'desktop' ? primaryPanelCollapsed : false}
              onTogglePrimaryPanel={layout === 'desktop' ? (primaryPanelCollapsed ? expandPrimaryPanel : collapsePrimaryPanel) : () => {}}
              onOpenSettings={() => setSettingsOpen(true)}
              onCloseSettings={() => setSettingsOpen(false)}
              onSaveSettings={saveSettings}
              showPanelButton={layout === 'desktop'}
            />
          )}
          renderPrimaryPanel={(layout) => (
            <ChessPrimaryPanel
              games={games}
              selectedGameId={selectedGameId}
              snapshot={snapshot}
              engineProfiles={engineProfiles}
              connectionState={selectedGameId ? controlsGame.connectionState : 'idle'}
              engineThinking={controlsGame.engineThinking}
              pieceNotation={settings.pieceNotation}
              viewedPly={viewedPly}
              isMovePlaybackRunning={isMovePlaybackRunning}
              layout={layout}
              onCreateGame={handleCreateGame}
              onSelectGame={(gameId) => {
                router.push(gameHref(routeFamily, gameId));
                selectGame(gameId);
              }}
              onFirstMove={() => {
                setIsMovePlaybackRunning(false);
                setSelectedViewedPly(0);
              }}
              onPreviousMove={() => {
                setIsMovePlaybackRunning(false);
                setSelectedViewedPly(viewedPly - 1);
              }}
              onToggleMovePlayback={() => setIsMovePlaybackRunning((current) => !current)}
              onNextMove={() => {
                setIsMovePlaybackRunning(false);
                setSelectedViewedPly(viewedPly + 1);
              }}
              onLastMove={() => {
                setIsMovePlaybackRunning(false);
                setSelectedViewedPly(selectedMoveCount);
              }}
              onSelectViewedPly={(ply) => {
                setIsMovePlaybackRunning(false);
                setSelectedViewedPly(ply);
              }}
              onResign={() => void controlsGame.resign()}
              onAbort={() => void controlsGame.abort()}
              isCreating={isCreating}
            />
          )}
          secondary={<div className="h-full" aria-label="Secondary chess panel" />}
          onBoardResize={handleBoardResize}
          onSecondaryResize={handleSecondaryResize}
        />
      </div>
    </main>
  );
}
