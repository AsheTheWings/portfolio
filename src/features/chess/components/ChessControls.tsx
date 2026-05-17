'use client';

import { useState } from 'react';
import { Button, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Slider } from '@/features/shared/components/shadcn';
import type { ChessColor, ChessGameRecord } from '../types/chess';
import { colorLabel, resultReasonLabel } from '../lib/notation';

interface ChessControlsProps {
  game: ChessGameRecord | null;
  connectionState: string;
  onCreateGame: (options: { humanColor: ChessColor; skillLevel: number }) => void;
  onResign: () => void;
  onAbort: () => void;
  isCreating: boolean;
}

/**
 * Renders game creation and lifecycle controls.
 *
 * @param props - Current game and callbacks.
 * @returns Chess controls panel.
 */
export function ChessControls({ game, connectionState, onCreateGame, onResign, onAbort, isCreating }: ChessControlsProps) {
  const [humanColor, setHumanColor] = useState<ChessColor>('white');
  const [skillLevel, setSkillLevel] = useState(8);

  return (
    <div className="rounded-2xl border border-border-subtle bg-surface-1 p-3 shadow-depth-sm">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-32 space-y-1.5">
          <Label>Play as</Label>
          <Select value={humanColor} onValueChange={(value) => setHumanColor(value as ChessColor)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="white">White</SelectItem>
              <SelectItem value="black">Black</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-44 flex-1 space-y-1.5">
          <Label>Skill {skillLevel}</Label>
          <Slider value={[skillLevel]} min={0} max={20} step={1} onValueChange={([value]) => setSkillLevel(value ?? 8)} />
        </div>

        <Button disabled={isCreating} onClick={() => onCreateGame({ humanColor, skillLevel })}>
          {isCreating ? 'Creating…' : 'New game'}
        </Button>

        {game && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl bg-surface-2 px-3 py-2 text-sm">
            <span><span className="text-muted-foreground">Status</span> <span className="font-medium capitalize">{game.status}</span></span>
            <span><span className="text-muted-foreground">Turn</span> <span className="font-medium">{colorLabel(game.sideToMove)}</span></span>
            <span><span className="text-muted-foreground">Socket</span> <span className="font-medium capitalize">{connectionState}</span></span>
            {game.result && <span><span className="text-muted-foreground">Result</span> <span className="font-medium">{game.result} · {resultReasonLabel(game.resultReason)}</span></span>}
            <Button size="sm" variant="secondary" disabled={game.status !== 'active'} onClick={onResign}>
              Resign
            </Button>
            <Button size="sm" variant="destructive" disabled={game.status === 'completed' || game.status === 'aborted'} onClick={onAbort}>
              Abort
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
