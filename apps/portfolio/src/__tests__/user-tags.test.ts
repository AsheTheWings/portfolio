import {
  isAlreadyTagged,
  parseTaggedContent,
  wrapClientUser,
  wrapDeveloperUser,
} from '@portfolio/timeline/agent/utils/user-tags';

describe('user-tags wrapping', () => {
  it('wraps plain client text and trims boundaries', () => {
    expect(wrapClientUser('  hello  ')).toBe('<client_user>\nhello\n</client_user>');
  });

  it('wraps plain developer text and trims boundaries', () => {
    expect(wrapDeveloperUser('\n do X \n')).toBe('<developer_user>\ndo X\n</developer_user>');
  });

  it('returns empty string for whitespace-only input', () => {
    expect(wrapClientUser('   ')).toBe('');
    expect(wrapDeveloperUser('')).toBe('');
  });

  it('keepEmpty emits an empty client block (attachment-only turn)', () => {
    expect(wrapClientUser('   ', { keepEmpty: true })).toBe('<client_user>\n\n</client_user>');
  });

  it('passes through content already tagged as client', () => {
    const input = '<client_user>\nhello\n</client_user>';
    expect(wrapClientUser(input)).toBe(input);
    // ...even when wrapped via the other voice helper
    expect(wrapDeveloperUser(input)).toBe(input);
  });

  it('passes through content already tagged as developer', () => {
    const input = '<developer_user>do X</developer_user>';
    expect(wrapDeveloperUser(input)).toBe(input);
    expect(wrapClientUser(input)).toBe(input);
  });

  it('passes through a combined client + developer structure', () => {
    const input = '<developer_user>do X</developer_user>\n<client_user>please do X</client_user>';
    expect(wrapClientUser(input)).toBe(input);
  });

  it('trims outer whitespace around an already-tagged block', () => {
    const input = '  <client_user>hello</client_user>  ';
    expect(wrapClientUser(input)).toBe('<client_user>hello</client_user>');
  });

  it('wraps when there is untagged residue around a block (not fully structured)', () => {
    const input = 'noise <client_user>hello</client_user>';
    expect(wrapClientUser(input)).toBe('<client_user>\nnoise <client_user>hello</client_user>\n</client_user>');
  });
});

describe('isAlreadyTagged', () => {
  it.each([
    ['<client_user>a</client_user>', true],
    ['<developer_user>a</developer_user>', true],
    ['<developer_user>a</developer_user>\n<client_user>b</client_user>', true],
    ['  <client_user>a</client_user>  ', true],
    ['plain text', false],
    ['', false],
    ['   ', false],
    ['prefix <client_user>a</client_user>', false],
    ['<client_user>unclosed', false],
  ])('isAlreadyTagged(%j) === %s', (input, expected) => {
    expect(isAlreadyTagged(input)).toBe(expected);
  });
});

describe('parseTaggedContent', () => {
  it('splits client and developer blocks', () => {
    const { developerText, userText } = parseTaggedContent(
      '<developer_user>dev</developer_user>\n<client_user>cli</client_user>',
    );
    expect(developerText).toBe('dev');
    expect(userText).toBe('cli');
  });

  it('treats untagged residue as developer text', () => {
    const { developerText, userText } = parseTaggedContent('legacy message');
    expect(developerText).toBe('legacy message');
    expect(userText).toBeNull();
  });
});
