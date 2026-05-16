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
    <div className="rounded-2xl border border-border-subtle bg-surface-1 shadow-depth-sm">
      <div className="border-b border-border-subtle px-4 py-3">
        <h2 className="text-sm font-semibold">Game controls</h2>
      </div>
      <div className="space-y-4 p-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
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
          <div className="space-y-2">
            <Label>Skill {skillLevel}</Label>
            <Slider value={[skillLevel]} min={0} max={20} step={1} onValueChange={([value]) => setSkillLevel(value ?? 8)} />
          </div>
        </div>

        <Button className="w-full" disabled={isCreating} onClick={() => onCreateGame({ humanColor, skillLevel })}>
          {isCreating ? 'Creating…' : 'New human vs engine game'}
        </Button>

        {game && (
          <div className="space-y-3 rounded-xl bg-surface-2 p-3 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Status</span>
              <span className="font-medium capitalize">{game.status}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Turn</span>
              <span className="font-medium">{colorLabel(game.sideToMove)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Socket</span>
              <span className="font-medium capitalize">{connectionState}</span>
            </div>
            {game.result && (
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Result</span>
                <span className="font-medium">{game.result} · {resultReasonLabel(game.resultReason)}</span>
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <Button variant="secondary" className="flex-1" disabled={game.status !== 'active'} onClick={onResign}>
                Resign
              </Button>
              <Button variant="destructive" className="flex-1" disabled={game.status === 'completed' || game.status === 'aborted'} onClick={onAbort}>
                Abort
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
