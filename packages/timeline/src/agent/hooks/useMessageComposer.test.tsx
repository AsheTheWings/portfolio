/**
 * Layer 2 — useMessageComposer hook (jsdom).
 *
 * Drives the composer through its public surface: value updates, the @-mention
 * trigger, submit semantics, and external setValue.
 */
import { renderHook, act } from '@testing-library/react';
import { useMessageComposer } from './useMessageComposer';

type ChangeArg = Parameters<ReturnType<typeof useMessageComposer>['onChange']>[0];

/** Build the minimal change event the hook reads (value + caret position). */
const changeEvent = (value: string, selectionStart = value.length) =>
  ({ target: { value, selectionStart } } as unknown as ChangeArg);

describe('useMessageComposer', () => {
  it('starts empty with no content', () => {
    const { result } = renderHook(() => useMessageComposer({ onSend: jest.fn() }));
    expect(result.current.value).toBe('');
    expect(result.current.hasContent).toBe(false);
  });

  it('submits trimmed text, calls onSend, and clears', () => {
    const onSend = jest.fn();
    const { result } = renderHook(() => useMessageComposer({ onSend }));

    act(() => result.current.onChange(changeEvent('  hello  ')));
    expect(result.current.hasContent).toBe(true);

    act(() => result.current.submit());
    expect(onSend).toHaveBeenCalledWith('hello');
    expect(result.current.value).toBe('');
  });

  it('does not submit when empty (and allowEmptySubmit is false)', () => {
    const onSend = jest.fn();
    const { result } = renderHook(() => useMessageComposer({ onSend }));
    act(() => result.current.submit());
    expect(onSend).not.toHaveBeenCalled();
  });

  it('submits empty when allowEmptySubmit is true (e.g. attachments present)', () => {
    const onSend = jest.fn();
    const { result } = renderHook(() => useMessageComposer({ onSend, allowEmptySubmit: true }));
    act(() => result.current.submit());
    expect(onSend).toHaveBeenCalledWith('');
  });

  it('opens the mention dropdown when typing @ at a word boundary', () => {
    const onMentionOpenChange = jest.fn();
    const { result } = renderHook(() =>
      useMessageComposer({ onSend: jest.fn(), onMentionOpenChange }),
    );

    act(() => result.current.onChange(changeEvent('@')));
    expect(result.current.mentionDropdown.isOpen).toBe(true);
    expect(result.current.mentionDropdown.query).toBe('');
    expect(onMentionOpenChange).toHaveBeenCalledWith(true);
  });

  it('does not treat an email-style @ as a mention', () => {
    const { result } = renderHook(() => useMessageComposer({ onSend: jest.fn() }));
    act(() => result.current.onChange(changeEvent('mail me at a@b')));
    expect(result.current.mentionDropdown.isOpen).toBe(false);
  });

  it('setValue updates the value and resets mention state', () => {
    const { result } = renderHook(() => useMessageComposer({ onSend: jest.fn() }));
    act(() => result.current.onChange(changeEvent('@')));
    act(() => result.current.setValue('replaced'));
    expect(result.current.value).toBe('replaced');
    expect(result.current.mentionDropdown.isOpen).toBe(false);
  });
});
