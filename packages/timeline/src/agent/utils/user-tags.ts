/**
 * user-tags — Single source of truth for `<client_user>` / `<developer_user>`
 * turn structure.
 *
 * The backend agreement is that every persisted user-turn message is composed
 * of `<client_user>…</client_user>` and/or `<developer_user>…</developer_user>`
 * blocks (see backend `instructions.ts`). Both the compose path
 * (`useUserInput`) and the render path (`UserMessage`) rely on the helpers
 * here so wrapping and parsing stay symmetric and in one place.
 */

export const CLIENT_TAG = 'client_user';
export const DEVELOPER_TAG = 'developer_user';

export type UserTag = typeof CLIENT_TAG | typeof DEVELOPER_TAG;

// Fresh regexes per call: global regexes carry `lastIndex` state, so we never
// share a single `/g` instance across `.test()`/`.exec()`/`matchAll` calls.
const blockRe = (tag: UserTag) => new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'g');

/**
 * Split a user-turn message into its developer-voice and client-voice parts.
 *
 * Returns:
 *   - `developerText`: concatenation of all `<developer_user>` blocks (or null)
 *   - `userText`     : concatenation of all `<client_user>` blocks (or null)
 *
 * Untagged residue is developer-authored content under the canonical display
 * policy, so no operational fragment is silently dropped from the view.
 */
export function parseTaggedContent(
  message: string,
): { developerText: string | null; userText: string | null } {
  const userBlocks: string[] = [];
  const developerBlocks: string[] = [];

  for (const m of message.matchAll(blockRe(CLIENT_TAG))) userBlocks.push((m[1] ?? '').trim());
  for (const m of message.matchAll(blockRe(DEVELOPER_TAG))) developerBlocks.push((m[1] ?? '').trim());

  const residue = message
    .replace(blockRe(CLIENT_TAG), '')
    .replace(blockRe(DEVELOPER_TAG), '')
    .trim();
  if (residue) developerBlocks.push(residue);

  return {
    developerText: developerBlocks.length ? developerBlocks.join('\n\n') : null,
    userText: userBlocks.length ? userBlocks.join('\n\n') : null,
  };
}

/**
 * True when `text` is already composed entirely of well-formed
 * `<client_user>` / `<developer_user>` blocks — i.e. it contains at least one
 * such block and stripping every block leaves no untagged residue. Such input
 * is passed through verbatim by the wrap helpers instead of being re-wrapped.
 */
export function isAlreadyTagged(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;

  const hasBlock =
    blockRe(CLIENT_TAG).test(trimmed) || blockRe(DEVELOPER_TAG).test(trimmed);
  if (!hasBlock) return false;

  const residue = trimmed
    .replace(blockRe(CLIENT_TAG), '')
    .replace(blockRe(DEVELOPER_TAG), '')
    .trim();
  return residue.length === 0;
}

interface WrapOptions {
  /**
   * Emit an empty block (`<tag>\n\n</tag>`) for whitespace-only input instead
   * of returning ''. Used for attachment-only client turns, where the block
   * must exist to mark the turn as client-voiced even with no text.
   */
  keepEmpty?: boolean;
}

/**
 * Wrap `text` in a `<tag>…</tag>` block. The input is trimmed first, and
 * content that is already correctly tagged (see {@link isAlreadyTagged}) is
 * returned verbatim to avoid nested wrapping. Returns '' for empty input
 * unless `keepEmpty` is set.
 */
export function wrapUserBlock(tag: UserTag, text: string, options: WrapOptions = {}): string {
  const trimmed = text.trim();
  if (!trimmed) return options.keepEmpty ? `<${tag}>\n\n</${tag}>` : '';
  if (isAlreadyTagged(trimmed)) return trimmed;
  return `<${tag}>\n${trimmed}\n</${tag}>`;
}

export const wrapClientUser = (text: string, options?: WrapOptions): string =>
  wrapUserBlock(CLIENT_TAG, text, options);

export const wrapDeveloperUser = (text: string, options?: WrapOptions): string =>
  wrapUserBlock(DEVELOPER_TAG, text, options);
