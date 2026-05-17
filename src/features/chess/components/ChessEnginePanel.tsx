'use client';

import { Button } from '@/features/shared/components/shadcn';
import { formatEngineScore, formatPrincipalVariation } from '../lib/notation';
import { useChessAnalysis } from '../hooks/useChessAnalysis';

interface ChessEnginePanelProps {
  gameId: string | null;
  isEngineThinking: boolean;
}

/**
 * Shows engine move/analysis state and bounded analysis results.
 *
 * @param props - Game id and engine thinking state.
 * @returns Engine panel component.
 */
export function ChessEnginePanel({ gameId, isEngineThinking }: ChessEnginePanelProps) {
  const { analysis, requestAnalysis } = useChessAnalysis(gameId);

  return (
    <div className="rounded-2xl border border-border-subtle bg-surface-1 shadow-depth-sm">
      <div className="flex items-center justify-between border-b border-border-subtle px-3 py-2">
        <div>
          <h2 className="text-sm font-semibold">Engine panel</h2>
          <p className="text-xs text-muted-foreground">White-perspective evaluation</p>
        </div>
        <Button size="sm" variant="secondary" disabled={!gameId || analysis.isLoading} onClick={requestAnalysis}>
          {analysis.isLoading ? 'Analyzing…' : 'Analyze'}
        </Button>
      </div>

      <div className="space-y-2 p-3">
        {isEngineThinking && (
          <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-700 dark:text-cyan-200">
            Stockfish is thinking…
          </div>
        )}

        {analysis.error && <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{analysis.error}</div>}

        {analysis.lines.length === 0 && !analysis.error ? (
          <p className="text-sm text-muted-foreground">Run analysis to inspect the current position.</p>
        ) : (
          <div className="max-h-28 space-y-2 overflow-auto">
            {analysis.lines.map((line) => (
              <div key={line.multipv} className="rounded-xl bg-surface-2 p-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold">#{line.multipv}</span>
                  <span className="font-mono text-sm">{formatEngineScore(line)}</span>
                  <span className="text-xs text-muted-foreground">depth {line.depth}</span>
                </div>
                <p className="mt-1 truncate font-mono text-xs text-muted-foreground" title={formatPrincipalVariation(line)}>{formatPrincipalVariation(line)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
