'use client';

/**
 * Asset Picker Panel
 * System component for selecting library assets to attach to agent messages
 * 
 * Features:
 * - Browse library and add items to context
 * - View/manage items already in context
 * - Toggle between library and context views
 */

import { useCallback, useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardAction, Button } from '@/features/shared/components/shadcn';
import { Plus, ArrowLeft, Layers, CheckSquare, X } from 'lucide-react';
import { useAgent } from '../hooks/useAgent';
import { LibraryPicker, useLibraryStore, type Asset } from '@/features/library';

export function AssetPickerPanel() {
  const { removeComponent, uiInterface, addPendingLibraryItems, pendingLibraryItemIds, removePendingLibraryItem, clearPendingLibraryItems } = useAgent();
  const selectedIds = useLibraryStore((state) => state.selectedIds);
  const clearSelection = useLibraryStore((state) => state.clearSelection);
  
  // Context view state
  const [isContextView, setIsContextView] = useState(false);
  
  // Selection mode state (for manual multi-select without drag)
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  
  const hasSelection = selectedIds.size > 0;
  const contextCount = pendingLibraryItemIds.length;
  
  // Close panel and clear all pending items
  const handleClose = useCallback(() => {
    clearSelection();
    clearPendingLibraryItems();
    removeComponent('asset-picker-panel');
  }, [clearSelection, clearPendingLibraryItems, removeComponent]);
  
  // Add selected items to context (don't close panel)
  const handleAddToContext = useCallback(() => {
    if (selectedIds.size > 0) {
      addPendingLibraryItems(Array.from(selectedIds));
    }
    clearSelection();
    setIsSelectionMode(false);
  }, [selectedIds, addPendingLibraryItems, clearSelection]);
  
  // Clear selection and exit selection mode
  const handleClearSelection = useCallback(() => {
    clearSelection();
    setIsSelectionMode(false);
  }, [clearSelection]);
  
  // Enter selection mode
  const handleEnterSelectionMode = useCallback(() => {
    setIsSelectionMode(true);
  }, []);
  
  // Handle selection confirmation from Library (double-click)
  const handleSelectionConfirm = useCallback((selectedAssets: Asset[]) => {
    if (selectedAssets.length > 0) {
      addPendingLibraryItems(selectedAssets.map(a => a.id));
    }
    clearSelection();
    // Don't close panel - allow user to continue adding
  }, [addPendingLibraryItems, clearSelection]);
  
  // Toggle context view
  const handleToggleContextView = useCallback(() => {
    clearSelection();
    setIsContextView(prev => !prev);
  }, [clearSelection]);
  
  // Remove item from context
  const handleRemoveFromContext = useCallback((id: string) => {
    removePendingLibraryItem(id);
  }, [removePendingLibraryItem]);
  
  const isStandalone = uiInterface === 'chat';
  
  return (
    <Card className={isStandalone ? "w-md mx-0 pd-0 min-w-[320px] lg:h-[76vh] lg:w-full" : "w-full border-none shadow-none bg-transparent"}>
      <CardHeader>
        <CardTitle>{isContextView ? 'Context Items' : 'Select Assets'}</CardTitle>
        <CardDescription>
          {isContextView 
            ? `${contextCount} item${contextCount !== 1 ? 's' : ''} added to context`
            : 'Choose folders or files from your library to add to context'
          }
        </CardDescription>
        <CardAction>
          <button
            onClick={handleClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-1"
            aria-label="Close panel"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </CardAction>
      </CardHeader>

      <CardContent className="px-0 h-full flex flex-col overflow-hidden">
        <LibraryPicker
          contextItemIds={pendingLibraryItemIds}
          isContextView={isContextView}
          onRemoveFromContext={handleRemoveFromContext}
          isSelectionMode={isSelectionMode}
          onSelectionConfirm={handleSelectionConfirm}
          className="flex-1 min-h-0"
        />
        
        {/* Actions */}
        <div className="flex-shrink-0 flex items-center justify-end border-t border-border gap-3 pt-3 pr-5">
          {contextCount > 0 && !isContextView && !isSelectionMode && (
            <Button
              variant="outline"
              onClick={handleToggleContextView}
              className="flex text-sm items-center gap-2"
            >
              <Layers className="w-4 h-4" />
              <span>{contextCount}</span>
            </Button>
          )}

          {isContextView ? (
            // Context view: Back to Library button
            <Button
              variant="ghost"
              onClick={handleToggleContextView}
              className="flex text-sm items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Library
            </Button>
          ) : (
            <>
              {/* Selection mode buttons */}
              {isSelectionMode ? (
                <>
                  <Button
                    variant="ghost"
                    onClick={handleClearSelection}
                    className="flex text-sm items-center gap-2 !transition-none"
                  >
                    <X className="w-4 h-4" />
                    Clear
                  </Button>
                {/* Add to Context button */}
                <Button
                  onClick={handleAddToContext}
                  disabled={!hasSelection}
                  className="flex text-sm items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add to Context
                  {hasSelection && <span>({selectedIds.size})</span>}
                </Button>
                </>
              ) : (
                <Button
                  onClick={handleEnterSelectionMode}
                  className="flex text-sm items-center gap-2 px-8"
                >
                  <CheckSquare className="w-4 h-4" />
                  Select
                </Button>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
