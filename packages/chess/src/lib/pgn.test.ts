import { buildMoveText } from './pgn';
import type { ChessMoveRecord } from '../types/chess';

const move = (moveNumber: number, san: string): ChessMoveRecord =>
  ({ moveNumber, san } as unknown as ChessMoveRecord);

describe('buildMoveText', () => {
  it('returns empty string for no moves', () => {
    expect(buildMoveText([])).toBe('');
  });

  it('pairs white and black moves by move number', () => {
    const moves = [move(1, 'e4'), move(1, 'e5'), move(2, 'Nf3'), move(2, 'Nc6')];
    expect(buildMoveText(moves)).toBe('1. e4 e5 2. Nf3 Nc6');
  });

  it('handles a trailing white move with no black reply', () => {
    expect(buildMoveText([move(1, 'e4'), move(1, 'e5'), move(2, 'Nf3')])).toBe('1. e4 e5 2. Nf3');
  });
});
