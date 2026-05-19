'use client';

import { useState } from 'react';
import { Button, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Slider } from '@portfolio/ui/components/shadcn';
import type { ChessColor, ChessEngineProfile } from '../types/chess';

interface ChessControlsProps {
  engineProfiles: ChessEngineProfile[];
  onCreateGame: (options: { humanColor: ChessColor; engineProfileId: string; skillLevel: number }) => void;
  isCreating: boolean;
}

/**
 * Render new-game controls for the chess primary panel.
 *
 * @param props - Game creation callback and loading state.
 * @returns New-game form controls.
 */
export function ChessControls({ engineProfiles, onCreateGame, isCreating }: ChessControlsProps) {
  const [humanColor, setHumanColor] = useState<ChessColor>('white');
  const [engineProfileId, setEngineProfileId] = useState<string>('');
  const [skillLevel, setSkillLevel] = useState(8);
  const selectedEngineProfileId = engineProfileId || engineProfiles[0]?.id || '';

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
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

      <div className="space-y-1.5">
        <Label>Engine</Label>
        <Select value={selectedEngineProfileId} onValueChange={setEngineProfileId} disabled={engineProfiles.length === 0}>
          <SelectTrigger>
            <SelectValue placeholder="No engines available" />
          </SelectTrigger>
          <SelectContent>
            {engineProfiles.map((profile) => (
              <SelectItem key={profile.id} value={profile.id}>{profile.displayName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        <Label>Skill {skillLevel}</Label>
        <Slider value={[skillLevel]} min={0} max={20} step={1} onValueChange={([value]) => setSkillLevel(value ?? 8)} />
      </div>

      <Button className="w-full" disabled={isCreating || !selectedEngineProfileId} onClick={() => onCreateGame({ humanColor, engineProfileId: selectedEngineProfileId, skillLevel })}>
        {isCreating ? 'Creating…' : 'Create new game'}
      </Button>
    </div>
  );
}
