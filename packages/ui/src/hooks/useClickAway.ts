/**
 * useClickAway Hook
 * Simple click-away handler that triggers callback when clicking outside allowed areas
 * 
 * The parent component defines what areas are "safe":
 * Clicks in gaps/outer space trigger the callback.
 */

import { useEffect, RefObject } from 'react';

export interface ClickAwayOptions {
  /**
   * Whether the click-away handler is active
   */
  enabled: boolean;
  
  /**
   * Callback when click outside allowed areas is detected
   */
  onClickAway: () => void;
  
  /**
   * CSS selectors for elements that should NOT trigger click-away
   * Typically provided by parent component (e.g., AgentPlayground)
   * 
   * Example: ['.session-component', '.chat-input']
   */
  allowedSelectors?: string[];
}

/**
 * Hook to handle click-away behavior
 * 
 * @param ref - Reference to the component container (always excluded from click-away)
 * @param options - Configuration options
 */
export function useClickAway(
  ref: RefObject<HTMLElement | null>,
  options: ClickAwayOptions
) {
  const { enabled, onClickAway, allowedSelectors = [] } = options;

  useEffect(() => {
    if (!enabled) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      // Don't close if clicking inside this component
      if (ref.current && ref.current.contains(target)) {
        return;
      }
      
      // Don't close if clicking inside any allowed area
      for (const selector of allowedSelectors) {
        if (target.closest(selector)) {
          return;
        }
      }
      
      // Click is in gaps/outer space - trigger callback
      onClickAway();
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [enabled, onClickAway, ref, allowedSelectors]);
}
