import {
  parseLibraryPaths,
  parseLibraryPathsWithPositions,
  segmentContent,
  encodeLibraryPath,
  decodeLibraryPath,
  formatLibraryPath,
} from './libraryMentionParser';

describe('parseLibraryPaths', () => {
  it('returns [] for empty input', () => {
    expect(parseLibraryPaths('')).toEqual([]);
  });

  it('extracts and decodes a single path', () => {
    expect(parseLibraryPaths('see @library/Photos/sunset.jpg here')).toEqual(['Photos/sunset.jpg']);
  });

  it('decodes URL-encoded segments', () => {
    expect(parseLibraryPaths('@library/My%20Docs/file.txt')).toEqual(['My Docs/file.txt']);
  });

  it('deduplicates repeated mentions', () => {
    expect(parseLibraryPaths('@library/a/b.png and again @library/a/b.png')).toEqual(['a/b.png']);
  });

  it('ignores @ that is not a library mention', () => {
    expect(parseLibraryPaths('email me @ alice or @notlibrary/x')).toEqual([]);
  });
});

describe('parseLibraryPathsWithPositions', () => {
  it('reports the full match and indices', () => {
    const content = 'x @library/a.png y';
    const [m] = parseLibraryPathsWithPositions(content);
    expect(m.fullMatch).toBe('@library/a.png');
    expect(m.path).toBe('a.png');
    expect(content.slice(m.startIndex, m.endIndex)).toBe('@library/a.png');
  });
});

describe('segmentContent', () => {
  it('splits text and library-path segments in order', () => {
    expect(segmentContent('hi @library/a.png bye')).toEqual([
      { type: 'text', value: 'hi ' },
      { type: 'library-path', value: '@library/a.png', path: 'a.png' },
      { type: 'text', value: ' bye' },
    ]);
  });

  it('returns a single text segment when there is no mention', () => {
    expect(segmentContent('plain text')).toEqual([{ type: 'text', value: 'plain text' }]);
  });
});

describe('encode/decode/format round-trip', () => {
  it('formatLibraryPath prefixes and encodes spaces', () => {
    expect(formatLibraryPath('My Docs/file.txt')).toBe('@library/My%20Docs/file.txt');
  });

  it('strips a leading slash before formatting', () => {
    expect(formatLibraryPath('/a/b.txt')).toBe('@library/a/b.txt');
  });

  it('encode then decode is identity for a path with spaces', () => {
    const path = 'A B/c d.txt';
    expect(decodeLibraryPath(encodeLibraryPath(path))).toBe(path);
  });

  it('decodeLibraryPath returns input unchanged when not decodable', () => {
    expect(decodeLibraryPath('%')).toBe('%');
  });
});
