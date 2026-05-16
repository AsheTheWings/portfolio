'use client';

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { ChessGameRecord, ChessGameSnapshot, NormalizedEngineLine } from '../types/chess';

interface ChessAnalysisState {
  analysisId: string | null;
  lines: NormalizedEngineLine[];
  isLoading: boolean;
  error: string | null;
}

interface ChessState {
  games: ChessGameRecord[];
  selectedGameId: string | null;
  snapshots: Record<string, ChessGameSnapshot>;
  engineThinkingByGameId: Record<string, boolean>;
  analysisByGameId: Record<string, ChessAnalysisState>;
  error: string | null;
  setGames: (games: ChessGameRecord[]) => void;
  upsertSnapshot: (snapshot: ChessGameSnapshot) => void;
  selectGame: (gameId: string | null) => void;
  setEngineThinking: (gameId: string, isThinking: boolean) => void;
  setAnalysisLoading: (gameId: string, analysisId?: string | null) => void;
  setAnalysisLines: (gameId: string, analysisId: string | null, lines: NormalizedEngineLine[]) => void;
  setAnalysisError: (gameId: string, error: string) => void;
  setError: (error: string | null) => void;
}

const EMPTY_ANALYSIS: ChessAnalysisState = {
  analysisId: null,
  lines: [],
  isLoading: false,
  error: null,
};

/**
 * Client store for chess game snapshots and transient analysis state.
 */
export const useChessStore = create<ChessState>()(
  devtools(
    (set) => ({
      games: [],
      selectedGameId: null,
      snapshots: {},
      engineThinkingByGameId: {},
      analysisByGameId: {},
      error: null,

      setGames: (games) => set({ games }, false, 'chess/setGames'),

      upsertSnapshot: (snapshot) =>
        set(
          (state) => {
            const gamesById = new Map(state.games.map((game) => [game.id, game]));
            gamesById.set(snapshot.game.id, snapshot.game);
            const games = Array.from(gamesById.values()).sort(
              (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
            );

            return {
              games,
              snapshots: { ...state.snapshots, [snapshot.game.id]: snapshot },
              selectedGameId: state.selectedGameId ?? snapshot.game.id,
              engineThinkingByGameId: {
                ...state.engineThinkingByGameId,
                [snapshot.game.id]: snapshot.engineThinking,
              },
            };
          },
          false,
          'chess/upsertSnapshot',
        ),

      selectGame: (gameId) => set({ selectedGameId: gameId }, false, 'chess/selectGame'),

      setEngineThinking: (gameId, isThinking) =>
        set(
          (state) => ({ engineThinkingByGameId: { ...state.engineThinkingByGameId, [gameId]: isThinking } }),
          false,
          'chess/setEngineThinking',
        ),

      setAnalysisLoading: (gameId, analysisId = null) =>
        set(
          (state) => ({
            analysisByGameId: {
              ...state.analysisByGameId,
              [gameId]: { ...(state.analysisByGameId[gameId] ?? EMPTY_ANALYSIS), analysisId, isLoading: true, error: null },
            },
          }),
          false,
          'chess/setAnalysisLoading',
        ),

      setAnalysisLines: (gameId, analysisId, lines) =>
        set(
          (state) => ({
            analysisByGameId: {
              ...state.analysisByGameId,
              [gameId]: { analysisId, lines, isLoading: false, error: null },
            },
          }),
          false,
          'chess/setAnalysisLines',
        ),

      setAnalysisError: (gameId, error) =>
        set(
          (state) => ({
            analysisByGameId: {
              ...state.analysisByGameId,
              [gameId]: { ...(state.analysisByGameId[gameId] ?? EMPTY_ANALYSIS), isLoading: false, error },
            },
          }),
          false,
          'chess/setAnalysisError',
        ),

      setError: (error) => set({ error }, false, 'chess/setError'),
    }),
    { name: 'ChessStore' },
  ),
);
