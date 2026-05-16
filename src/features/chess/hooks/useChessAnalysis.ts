'use client';

import { useCallback } from 'react';
import { requestChessAnalysis } from '../lib/chess-api';
import { useChessStore } from '../stores/useChessStore';

/**
 * Provides transient engine analysis state and request action for a game.
 *
 * @param gameId - Game id.
 * @returns Analysis state and request action.
 */
export function useChessAnalysis(gameId: string | null) {
  const analysis = useChessStore((state) => (gameId ? state.analysisByGameId[gameId] : undefined));
  const setAnalysisLoading = useChessStore((state) => state.setAnalysisLoading);
  const setAnalysisLines = useChessStore((state) => state.setAnalysisLines);
  const setAnalysisError = useChessStore((state) => state.setAnalysisError);

  const requestAnalysis = useCallback(async () => {
    if (!gameId) return;
    setAnalysisLoading(gameId);
    try {
      const result = await requestChessAnalysis(gameId, { multipv: 3, movetimeMs: 1_000 });
      setAnalysisLines(gameId, result.analysisId, result.lines);
    } catch (err) {
      setAnalysisError(gameId, err instanceof Error ? err.message : 'Analysis failed');
    }
  }, [gameId, setAnalysisError, setAnalysisLines, setAnalysisLoading]);

  return {
    analysis: analysis ?? { analysisId: null, lines: [], isLoading: false, error: null },
    requestAnalysis,
  };
}
