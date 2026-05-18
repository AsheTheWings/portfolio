'use client';

import type { PanelSize } from 'react-resizable-panels';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@portfolio/ui/components/shadcn/resizable';

const BOARD_DEFAULT_SIZE = '50%';
export const BOARD_MIN_SIZE_PX = 560;
const BOARD_MIN_SIZE = `${BOARD_MIN_SIZE_PX}px`;
const SECONDARY_DEFAULT_SIZE = '50%';
export const SECONDARY_MIN_SIZE_PX = 380;
const SECONDARY_MIN_SIZE = `${SECONDARY_MIN_SIZE_PX}px`;

interface ChessSplitLayoutProps {
  board: React.ReactNode;
  secondary: React.ReactNode;
  onBoardResize?: (size: PanelSize) => void;
  onSecondaryResize?: (size: PanelSize) => void;
}

/**
 * Render the board and secondary chess panels with the shared resizable panel primitive.
 *
 * @param props - Board-area and secondary-panel content.
 * @returns Resizable board/secondary split layout.
 */
export function ChessSplitLayout({ board, secondary, onBoardResize, onSecondaryResize }: ChessSplitLayoutProps) {
  return (
    <ResizablePanelGroup orientation="horizontal" className="h-full min-h-0 min-w-0 overflow-hidden">
      <ResizablePanel
        defaultSize={BOARD_DEFAULT_SIZE}
        minSize={BOARD_MIN_SIZE}
        onResize={(size) => onBoardResize?.(size)}
        className="min-h-0 overflow-hidden p-12"
      >
        {board}
      </ResizablePanel>

      <ResizableHandle withHandle className="w-2 bg-transparent" />

      <ResizablePanel
        defaultSize={SECONDARY_DEFAULT_SIZE}
        minSize={SECONDARY_MIN_SIZE}
        onResize={(size) => onSecondaryResize?.(size)}
        className="min-h-0 overflow-hidden"
      >
        <aside className="h-full min-h-0 overflow-hidden border-l border-border-subtle bg-surface-1 shadow-depth-sm">
          {secondary}
        </aside>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
