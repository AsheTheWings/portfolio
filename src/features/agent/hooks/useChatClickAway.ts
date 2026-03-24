import { useEffect, RefObject } from 'react';

export type ChatClickAwayMode = 'edit' | 'debug' | 'expansion';

export interface ChatClickAwayOptions {
  mode: ChatClickAwayMode;
  enabled: boolean;
  onClickAway: () => void;
  additionalAllowedSelectors?: string[];
  /** Fully disable click-away (e.g., for background mode where we never want to collapse) */
  disabled?: boolean;
}

export function useChatClickAway(
  ref: RefObject<HTMLElement | null>,
  options: ChatClickAwayOptions
) {
  const { mode, enabled, onClickAway, additionalAllowedSelectors = [], disabled = false } = options;

  useEffect(() => {
    if (!enabled || disabled) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (ref.current && ref.current.contains(target)) return;

      let allowedSelectors: string[] = [];
      switch (mode) {
        case 'edit':
          allowedSelectors = [];
          break;
        case 'debug':
        case 'expansion':
          allowedSelectors = ['.session-component'];
          break;
      }

      const finalSelectors = [...allowedSelectors, ...additionalAllowedSelectors];
      
      // Check if target or any parent matches allowed selectors
      let current: HTMLElement | null = target;
      while (current) {
        for (const selector of finalSelectors) {
          if (current.matches(selector)) {
            return;
          }
        }
        current = current.parentElement;
      }

      onClickAway();
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [mode, enabled, onClickAway, ref, additionalAllowedSelectors]);
}
