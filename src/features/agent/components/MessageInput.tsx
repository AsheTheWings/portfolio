'use client';

/**
 * MessageInput - Message input field for agent chat
 * Supports text input, library asset attachments, and @library/path mentions
 */

import { useRef, useState, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react';
import { Button } from '@/features/shared/components/shadcn';
import { Plus, Keyboard } from 'lucide-react';
import IconSend from '@/features/shared/icons/IconSend';
import IconPause from '@/features/shared/icons/IconPause';
import { useAgent } from '../hooks/useAgent';
import { useMessageComposer } from '../hooks/useMessageComposer';
import { LibraryPathBrowser } from '@/features/library';

interface MessageInputProps {
  onSend: (message: string, assetIds?: string[]) => void;
  onInsert?: (text: string) => void;  // User mode: stage text without submitting
  onStop?: () => void;
  isProcessing: boolean;
  isThinking?: boolean;
  isToolCalling?: boolean;
  isResponding?: boolean;
  disabled?: boolean;
  placeholder?: string;
  onMentionOpenChange?: (isOpen: boolean) => void;
  collapsed?: boolean;
  onExpand?: () => void;
  isAnimating?: boolean;
  viewMode?: 'user' | 'client';        // Timeline: affects placeholder + Insert action
  hasStagedMessage?: boolean;          // Timeline: staged user text is pending
}

export interface MessageInputRef {
  focus: () => void;
  setValue: (value: string) => void;
  getValue: () => string;
  clearAssets: () => void;
}

export const MessageInput = forwardRef<MessageInputRef, MessageInputProps>(
  ({ onSend, onInsert, onStop, isProcessing, isThinking, isToolCalling, isResponding, disabled, placeholder = 'Type your message...', onMentionOpenChange, collapsed, onExpand, isAnimating, viewMode, hasStagedMessage }, ref) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  
  // Get pending library items from agent store
  const { pendingLibraryItemIds, clearPendingLibraryItems, upsertSystemPanel } = useAgent();
  
  // Message composer hook - owns input state and mention logic
  const handleSend = useCallback((message: string) => {
    const libraryItemIds = pendingLibraryItemIds.length > 0 ? pendingLibraryItemIds : undefined;
    onSend(message, libraryItemIds);
    clearPendingLibraryItems();
  }, [onSend, pendingLibraryItemIds, clearPendingLibraryItems]);
  
  const {
    value,
    inputRef,
    onChange,
    onKeyDown,
    mentionDropdown,
    submit,
    setValue,
    focus,
    hasContent: hasTextContent,
  } = useMessageComposer({
    onSend: handleSend,
    onMentionOpenChange,
    disabled: isProcessing || disabled,
    allowEmptySubmit: pendingLibraryItemIds.length > 0,
  });

  // Expose methods to parent for history navigation
  useImperativeHandle(ref, () => ({
    focus,
    setValue,
    getValue: () => value,
    clearAssets: () => clearPendingLibraryItems(),
  }));

  // Open asset picker panel
  const openAssetPicker = () => {
    upsertSystemPanel('asset-picker-panel', 'asset-picker-panel');
  };

  // Auto-focus input when processing state changes
  useEffect(() => {
    focus();
  }, [isProcessing, focus]);

  // Handle form submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submit();
  };

  // Get contextual processing message based on agent state
  const getProcessingMessage = () => {
    if (isProcessing) {
      if (isThinking) return 'Agent is thinking...';
      if (isToolCalling) return 'Agent is calling tools...';
      if (isResponding) return 'Agent is responding...';
      return 'Agent is processing...';
    }
    if (disabled) return 'Waiting for agent response...';
    if (viewMode === 'client') return 'Type client message...';
    if (hasStagedMessage) return 'Type client message...';
    return `${placeholder}`;
  };

  const hasContent = hasTextContent || pendingLibraryItemIds.length > 0;

  // Show Insert button when: user mode, not collapsed, not processing, onInsert is provided
  const showInsert = !collapsed && !isAnimating && !isProcessing && !disabled && viewMode === 'user' && !hasStagedMessage && !!onInsert;

  // Handle Insert action: stage current text, clear input, keep focus
  const handleInsert = () => {
    if (!hasTextContent || !onInsert) return;
    onInsert(value);
    setValue('');
    focus();
  };

  // Visual collapsed state: stays collapsed-looking during GSAP animation
  const visuallyCollapsed = collapsed || isAnimating;

  // Delayed placeholder: appears 300ms after expansion animation completes
  const [showPlaceholder, setShowPlaceholder] = useState(!collapsed && !isAnimating);
  const placeholderTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    if (visuallyCollapsed) {
      // Hide placeholder immediately when collapsing
      clearTimeout(placeholderTimerRef.current);
      setShowPlaceholder(false);
    } else {
      // Show placeholder 300ms after animation completes
      placeholderTimerRef.current = setTimeout(() => setShowPlaceholder(true), 300);
    }
    return () => clearTimeout(placeholderTimerRef.current);
  }, [visuallyCollapsed]);

  // Restore cursor to end of text when expanding from collapsed state
  const prevCollapsedRef = useRef(collapsed);
  useEffect(() => {
    if (prevCollapsedRef.current && !collapsed && inputRef.current) {
      const len = inputRef.current.value.length;
      inputRef.current.setSelectionRange(len, len);
    }
    prevCollapsedRef.current = collapsed;
  }, [collapsed, inputRef]);

  return (
    <div className={`relative flex w-full gap-2 relative ${visuallyCollapsed ? '' : 'min-w-[320px]'}`}>
      {/* Library Path Browser Dropdown */}
      {!visuallyCollapsed && (
        <LibraryPathBrowser
          isOpen={mentionDropdown.isOpen}
          query={mentionDropdown.query}
          onSelect={mentionDropdown.onSelect}
          onClose={mentionDropdown.onClose}
          containerClassName="absolute bottom-full left-0 right-0 mb-2 z-[100]"
        />
      )}
      
      {/* Input Form */}
      <form 
        ref={formRef}
        onSubmit={collapsed ? (e) => { e.preventDefault(); onExpand?.(); } : handleSubmit}
        onClick={collapsed ? onExpand : undefined}
        className={`w-full flex justify-center items-center gap-3 bg-surface-1 p-3 shadow-depth-md transition-all duration-350 hover:shadow-depth-lg border border-border-subtle ${
          visuallyCollapsed ? 'cursor-pointer rounded-full' : 'rounded-4xl'
        }`}
        style={{
          boxShadow: 'var(--shadow-md), inset 0 0 0 1px oklch(0.95 0.002 264 / 0.1)',
        }}
      >
        {/* Plus button + chevron - always visible */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={(e) => { e.stopPropagation(); openAssetPicker(); }}
            disabled={isProcessing || disabled}
            className="rounded-full text-muted-foreground hover:text-foreground hover:bg-surface-2 shrink-0"
            title="Attach assets from library"
          >
            <Plus size={20} />
          </Button>
        
          <span className="text-primary font-bold text-sm leading-none flex items-center">›</span>
          {isProcessing && (
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          )}
        </div>
        
        {/* Textarea - visible as soon as expanding starts; sr-only only when truly collapsed */}
        <textarea
          ref={inputRef}
          value={value}
          onChange={onChange}
          onKeyDown={onKeyDown}
          disabled={isProcessing || disabled}
          className={collapsed
            ? 'sr-only'
            : 'bg-transparent border-none outline-none text-foreground text-sm placeholder:text-muted-foreground disabled:opacity-50 resize-none field-sizing-content max-h-[8rem] scrollbar-inner flex-1 animate-in fade-in duration-200'
          }
          placeholder={showPlaceholder ? getProcessingMessage() : ''}
          rows={1}
          tabIndex={collapsed ? -1 : 0}
          aria-hidden={collapsed}
        />
        
        {isProcessing ? (
          <Button
            ref={buttonRef}
            type="button"
            onClick={onStop}
            size="icon-lg"
            className="ml-auto relative rounded-full bg-black text-white hover:bg-black/80 shrink-0"
            title="Pause agent"
          >
            {/* Spinning cyan ring */}
            <span className="absolute inset-0 rounded-full border-3 border-transparent border-t-cyan-400 border-r-cyan-400/50 animate-spin" />
            <span className="relative z-10">
              <IconPause size="20" />
            </span>
          </Button>
        ) : (
          <div className="ml-auto flex items-center gap-1.5 shrink-0">
            {/* Insert button — user mode only, before staging */}
            {showInsert && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleInsert}
                disabled={!hasTextContent}
                className="rounded-full text-xs px-3 h-8 border-border-subtle text-muted-foreground hover:text-foreground hover:bg-surface-2"
                title="Stage as developer text, then add client message"
              >
                Insert
              </Button>
            )}
            <Button
              ref={buttonRef}
              type={collapsed ? 'button' : 'submit'}
              disabled={collapsed ? false : (!hasContent || disabled)}
              size="icon-lg"
              className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
              title={collapsed ? 'Open input (Enter)' : viewMode === 'client' ? 'Send as client' : hasStagedMessage ? 'Send combined message' : 'Send message'}
              tabIndex={collapsed ? -1 : 0}
              data-gsap="submit-btn"
            >
              {collapsed ? <Keyboard size={20} /> : <IconSend size="24" />}
            </Button>
          </div>
        )}
      </form>
    </div>
  );
});

MessageInput.displayName = 'MessageInput';
