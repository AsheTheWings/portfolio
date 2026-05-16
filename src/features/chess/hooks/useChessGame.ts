'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { abortChessGame, fetchChessGame, makeChessMove, resignChessGame } from '../lib/chess-api';
import { useChessStore } from '../stores/useChessStore';
import { useChessSocket } from './useChessSocket';
import type { ChessGameSnapshot } from '../types/chess';
import type { ChessServerMessage } from '../types/protocol';

/**
 * Coordinates canonical game snapshot loading, socket events, and move actions.
 *
 * @param gameId - Game id to load and subscribe to.
 * @returns Game state and action handlers.
 */
export function useChessGame(gameId: string | null) {
  const snapshot = useChessStore((state) => (gameId ? state.snapshots[gameId] : undefined));
  const engineThinking = useChessStore((state) => (gameId ? state.engineThinkingByGameId[gameId] ?? false : false));
  const upsertSnapshot = useChessStore((state) => state.upsertSnapshot);
  const setEngineThinking = useChessStore((state) => state.setEngineThinking);
  const setError = useChessStore((state) => state.setError);
  const setAnalysisLines = useChessStore((state) => state.setAnalysisLines);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmittingMove, setIsSubmittingMove] = useState(false);

  useEffect(() => {
    if (!gameId) return;

    let cancelled = false;
    setIsLoading(true);
    fetchChessGame(gameId)
      .then((nextSnapshot) => {
        if (!cancelled) upsertSnapshot(nextSnapshot);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load chess game');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [gameId, setError, upsertSnapshot]);

  const handleSocketMessage = useCallback(
    (message: ChessServerMessage) => {
      switch (message.type) {
        case 'game_snapshot':
        case 'move_applied':
          upsertSnapshot(message.snapshot);
          setEngineThinking(message.gameId, false);
          break;
        case 'engine_thinking':
          setEngineThinking(message.gameId, true);
          break;
        case 'engine_analysis_update':
        case 'engine_analysis_complete':
          setAnalysisLines(message.gameId, message.analysisId, message.lines);
          break;
        case 'error':
          setError(message.error);
          if (message.gameId) setEngineThinking(message.gameId, false);
          break;
        case 'game_status_changed':
        case 'engine_analysis_started':
          break;
      }
    },
    [setAnalysisLines, setEngineThinking, setError, upsertSnapshot],
  );

  const socket = useChessSocket({ gameId, onMessage: handleSocketMessage });

  const submitMove = useCallback(
    async (move: string) => {
      if (!gameId || !snapshot) return;
      setIsSubmittingMove(true);
      try {
        const result = await makeChessMove(gameId, { move, notation: 'uci', expectedPly: snapshot.game.ply });
        upsertSnapshot(result.snapshot);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Move rejected');
        const latest = await fetchChessGame(gameId).catch(() => null);
        if (latest) upsertSnapshot(latest);
      } finally {
        setIsSubmittingMove(false);
      }
    },
    [gameId, setError, snapshot, upsertSnapshot],
  );

  const resign = useCallback(async () => {
    if (!gameId) return;
    const nextSnapshot = await resignChessGame(gameId);
    upsertSnapshot(nextSnapshot);
  }, [gameId, upsertSnapshot]);

  const abort = useCallback(async () => {
    if (!gameId) return;
    const nextSnapshot = await abortChessGame(gameId);
    upsertSnapshot(nextSnapshot);
  }, [gameId, upsertSnapshot]);

  return useMemo(
    () => ({
      snapshot: snapshot as ChessGameSnapshot | undefined,
      engineThinking,
      isLoading,
      isSubmittingMove,
      connectionState: socket.connectionState,
      isConnected: socket.isConnected,
      submitMove,
      resign,
      abort,
    }),
    [abort, engineThinking, isLoading, isSubmittingMove, resign, snapshot, socket.connectionState, socket.isConnected, submitMove],
  );
}
