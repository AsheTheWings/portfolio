/**
 * jsdom setup for the "dom" Jest project.
 *
 * - Registers @testing-library/jest-dom matchers (toBeInTheDocument, etc.).
 * - Auto-cleans the React tree after each test.
 * - Polyfills window.matchMedia, which jsdom does not implement but several
 *   components/providers (e.g. ThemeProvider) rely on.
 */
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';

afterEach(() => cleanup());

if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},     // deprecated, kept for older callers
      removeListener: () => {},  // deprecated
      dispatchEvent: () => false,
    }),
  });
}
