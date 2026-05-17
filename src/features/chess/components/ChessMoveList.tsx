import type { ChessMoveRecord } from '../types/chess';

interface ChessMoveListProps {
  moves: ChessMoveRecord[];
  className?: string;
}

/**
 * Displays canonical move history grouped by move number.
 *
 * @param props - Ordered chess moves and optional layout class name.
 * @returns Move list table.
 */
export function ChessMoveList({ moves, className = '' }: ChessMoveListProps) {
  const rows = [];
  for (let index = 0; index < moves.length; index += 2) {
    rows.push({ white: moves[index], black: moves[index + 1] });
  }

  return (
    <div className={`grid overflow-hidden rounded-2xl border border-border-subtle bg-surface-1 shadow-depth-sm ${className}`}>
      <div className="border-b border-border-subtle px-3 py-2">
        <h2 className="text-sm font-semibold">Move list</h2>
      </div>
      <div className="min-h-0 overflow-auto p-2">
        {rows.length === 0 ? (
          <p className="px-2 py-8 text-center text-sm text-muted-foreground">No moves yet.</p>
        ) : (
          <div className="grid grid-cols-[3rem_1fr_1fr] gap-y-1 text-sm">
            {rows.map(({ white, black }) => (
              <div key={white.id} className="contents">
                <div className="rounded-l-lg bg-surface-2 px-2 py-1.5 text-muted-foreground">{white.moveNumber}.</div>
                <div className="bg-surface-2 px-2 py-1.5 font-medium">{white.san}</div>
                <div className="rounded-r-lg bg-surface-2 px-2 py-1.5 font-medium">{black?.san ?? ''}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
