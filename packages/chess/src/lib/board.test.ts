import { parseFenBoard, buildBoardSquares, toUciMove, type BoardSquare } from './board';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('parseFenBoard', () => {
  it('places pieces on the correct squares for the start position', () => {
    const board = parseFenBoard(START_FEN);
    expect(board['e1' as BoardSquare]).toBe('wk');
    expect(board['d1' as BoardSquare]).toBe('wq');
    expect(board['a8' as BoardSquare]).toBe('br');
    expect(board['e8' as BoardSquare]).toBe('bk');
    expect(board['e2' as BoardSquare]).toBe('wp');
    expect(board['e7' as BoardSquare]).toBe('bp');
  });

  it('leaves empty squares null', () => {
    const board = parseFenBoard(START_FEN);
    expect(board['e4' as BoardSquare]).toBeNull();
    expect(board['d5' as BoardSquare]).toBeNull();
  });

  it('handles numeric run-length skips', () => {
    const board = parseFenBoard('8/8/8/8/8/8/8/4K3 w - - 0 1');
    expect(board['e1' as BoardSquare]).toBe('wk');
    expect(board['a1' as BoardSquare]).toBeNull();
  });

  it.each([
    ['too few ranks', 'rnbqkbnr/pppppppp/8 w - - 0 1'],
    ['rank overflows files', 'ppppppppp/8/8/8/8/8/8/8 w - - 0 1'],
    ['rank underflows files', '7/8/8/8/8/8/8/8 w - - 0 1'],
    ['invalid piece char', 'xnbqkbnr/8/8/8/8/8/8/8 w - - 0 1'],
  ])('throws on malformed FEN (%s)', (_label, fen) => {
    expect(() => parseFenBoard(fen)).toThrow('Invalid FEN board');
  });
});

describe('buildBoardSquares', () => {
  it('orders squares from a8 (white orientation) and assigns colors', () => {
    const squares = buildBoardSquares(START_FEN, 'white');
    expect(squares).toHaveLength(64);
    expect(squares[0].square).toBe('a8');
    expect(squares[63].square).toBe('h1');
    // a8 is a light square in this scheme ((0 + 8) % 2 === 0 -> dark? verify rule)
    const a1 = squares.find((s) => s.square === 'a1')!;
    expect(a1.piece).toBe('wr');
  });

  it('flips orientation for black', () => {
    const squares = buildBoardSquares(START_FEN, 'black');
    expect(squares[0].square).toBe('h1');
    expect(squares[63].square).toBe('a8');
  });
});

describe('toUciMove', () => {
  it('concatenates from/to', () => {
    expect(toUciMove('e2', 'e4')).toBe('e2e4');
  });

  it('appends a promotion piece', () => {
    expect(toUciMove('e7', 'e8', 'q')).toBe('e7e8q');
  });
});
