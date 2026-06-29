/**
 * renderWithProviders — render a component inside the app's real providers.
 *
 * Wraps the tree in ThemeProvider and a FRESH React Query QueryClient per
 * render (retries disabled for deterministic tests). Re-exports everything
 * from @testing-library/react so tests import from one place.
 *
 * See ../../docs/testing.md (Layer 2).
 */
import { type ReactElement, type ReactNode, useState } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@portfolio/ui/contexts/ThemeContext';

function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>{children}</ThemeProvider>
    </QueryClientProvider>
  );
}

export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) {
  return render(ui, { wrapper: Providers, ...options });
}

// Re-export the testing-library surface for convenience.
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
