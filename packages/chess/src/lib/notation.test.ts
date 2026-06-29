import {
  colorLabel,
  resultReasonLabel,
  formatEngineScore,
  formatPrincipalVariation,
} from './notation';
import type { NormalizedEngineLine } from '../types/chess';

// Minimal engine-line builder — only the fields these formatters read.
const line = (partial: {
  cp?: number;
  mate?: number;
  pv?: string[];
}): NormalizedEngineLine =>
  ({
    score: { white: { cp: partial.cp, mate: partial.mate } },
    pv: partial.pv,
  } as unknown as NormalizedEngineLine);

describe('colorLabel', () => {
  it('maps sides to labels', () => {
    expect(colorLabel('white')).toBe('White');
    expect(colorLabel('black')).toBe('Black');
  });
});

describe('resultReasonLabel', () => {
  it('labels known reasons', () => {
    expect(resultReasonLabel('checkmate')).toBe('Checkmate');
    expect(resultReasonLabel('threefold_repetition')).toBe('Threefold repetition');
  });

  it('falls back when reason is null/undefined', () => {
    expect(resultReasonLabel(null)).toBe('Game in progress');
    expect(resultReasonLabel(undefined)).toBe('Game in progress');
  });
});

describe('formatEngineScore', () => {
  it('returns em dash for no line', () => {
    expect(formatEngineScore(null)).toBe('—');
  });

  it('formats centipawns from White perspective with sign', () => {
    expect(formatEngineScore(line({ cp: 35 }))).toBe('+0.35');
    expect(formatEngineScore(line({ cp: -120 }))).toBe('-1.20');
  });

  it('formats mate scores', () => {
    expect(formatEngineScore(line({ mate: 3 }))).toBe('+M3');
    expect(formatEngineScore(line({ mate: -2 }))).toBe('M-2');
  });
});

describe('formatPrincipalVariation', () => {
  it('joins the pv with spaces', () => {
    expect(formatPrincipalVariation(line({ pv: ['e2e4', 'e7e5'] }))).toBe('e2e4 e7e5');
  });

  it('handles an empty/absent pv', () => {
    expect(formatPrincipalVariation(line({ pv: [] }))).toBe('No line available');
    expect(formatPrincipalVariation(null)).toBe('No line available');
  });
});
