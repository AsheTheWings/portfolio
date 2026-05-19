'use client';

import type React from 'react';
import type { PanelSize } from 'react-resizable-panels';
import { ChessSplitLayout } from './ChessSplitLayout';

type ChessResponsiveLayoutMode = 'mobile' | 'desktop';

interface ChessResponsiveLayoutProps {
  primaryPanelCollapsed: boolean;
  renderBoard: (mode: ChessResponsiveLayoutMode) => React.ReactNode;
  renderPrimaryPanel: (mode: ChessResponsiveLayoutMode) => React.ReactNode;
  secondary: React.ReactNode;
  onBoardResize?: (size: PanelSize) => void;
  onSecondaryResize?: (size: PanelSize) => void;
}

/**
 * Compose chess content into mobile viewport sections or the desktop split layout.
 *
 * @param props - Render functions for shared regions plus desktop resize handlers.
 * @returns Responsive chess layout for mobile and desktop breakpoints.
 */
export function ChessResponsiveLayout({
  primaryPanelCollapsed,
  renderBoard,
  renderPrimaryPanel,
  secondary,
  onBoardResize,
  onSecondaryResize,
}: ChessResponsiveLayoutProps) {
  return (
    <>
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto lg:hidden">
        <section className="h-dvh min-h-0" aria-label="Chess board section">
          {renderBoard('mobile')}
        </section>

        <section className="h-dvh min-h-0" aria-label="Primary chess panel section">
          {renderPrimaryPanel('mobile')}
        </section>

        <section className="h-dvh min-h-0 border-t border-border-subtle bg-surface-1" aria-label="Secondary chess panel">
          {secondary}
        </section>
      </div>

      <div className="hidden lg:flex relative h-full shrink-0">
        {!primaryPanelCollapsed && renderPrimaryPanel('desktop')}
      </div>

      <div className="hidden lg:flex min-h-0 min-w-0 flex-1 flex-col">
        <ChessSplitLayout
          board={renderBoard('desktop')}
          secondary={secondary}
          onBoardResize={onBoardResize}
          onSecondaryResize={onSecondaryResize}
        />
      </div>
    </>
  );
}
