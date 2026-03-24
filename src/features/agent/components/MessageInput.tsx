'use client';

/**
 * MessageInput - Message input field for agent chat
 * Supports text input, library asset attachments, and @library/path mentions
 */

import { useRef, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react';
import { Button } from '@/features/shared/components/shadcn';
import { Plus } from 'lucide-react';
import IconSend from '@/features/shared/icons/IconSend';
import IconPause from '@/features/shared/icons/IconPause';
import { useAgent } from '../hooks/useAgent';
import { useMessageComposer } from '../hooks/useMessageComposer';
import { LibraryPathBrowser } from '@/features/library';

interface MessageInputProps {
  onSend: (message: string, assetIds?: string[]) => void;
  onStop?: () => void;
  isProcessing: boolean;
  isThinking?: boolean;
  isToolCalling?: boolean;
  isResponding?: boolean;
  disabled?: boolean;
  placeholder?: string;
  onMentionOpenChange?: (isOpen: boolean) => void;
}

export interface MessageInputRef {
  focus: () => void;
  setValue: (value: string) => void;
  getValue: () => string;
  clearAssets: () => void;
}

export const MessageInput = forwardRef<MessageInputRef, MessageInputProps>(
  ({ onSend, onStop, isProcessing, isThinking, isToolCalling, isResponding, disabled, placeholder = 'Type your message...', onMentionOpenChange }, ref) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  
  // Get pending library items from agent store
  const { pendingLibraryItemIds, clearPendingLibraryItems, upsertComponent } = useAgent();
  
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
    upsertComponent({
      id: 'asset-picker-panel',
      role: 'system',
      type: 'asset-picker-panel',
      data: {},
    });
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
    return `${placeholder} (Enter to send, Shift+Enter for new line)`;
  };

  const hasContent = hasTextContent || pendingLibraryItemIds.length > 0;

  return (
    <div className="pb-4 flex flex-col justify-center w-full min-w-[320px] gap-2 relative">
      {/* Library Path Browser Dropdown */}
      <LibraryPathBrowser
        isOpen={mentionDropdown.isOpen}
        query={mentionDropdown.query}
        onSelect={mentionDropdown.onSelect}
        onClose={mentionDropdown.onClose}
        containerClassName="absolute bottom-full left-0 right-0 mb-2 z-[100]"
      />
      
      {/* Input Form */}
      <form 
        ref={formRef}
        onSubmit={handleSubmit}
        className="w-full flex items-center gap-3 bg-surface-1 rounded-4xl px-4 pr-4 py-3 shadow-depth-md transition-all hover:shadow-depth-lg border border-border-subtle"
        style={{
          boxShadow: 'var(--shadow-md), inset 0 0 0 1px oklch(0.95 0.002 264 / 0.1)',
        }}
      >
        {/* Plus button for asset attachment from library */}
        <div className="flex items-center justify-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={openAssetPicker}
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
        
        <textarea
          ref={inputRef}
          value={value}
          onChange={onChange}
          onKeyDown={onKeyDown}
          disabled={isProcessing || disabled}
          className="flex-1 bg-transparent border-none outline-none text-foreground text-sm placeholder:text-muted-foreground disabled:opacity-50 resize-none field-sizing-content max-h-[8rem] scrollbar-inner"
          placeholder={getProcessingMessage()}
          rows={1}
        />
        
        {isProcessing ? (
          <Button
            ref={buttonRef}
            type="button"
            onClick={onStop}
            size="icon-lg"
            className="relative rounded-full bg-black text-white hover:bg-black/80"
            title="Pause agent"
          >
            {/* Spinning cyan ring */}
            <span className="absolute inset-0 rounded-full border-3 border-transparent border-t-cyan-400 border-r-cyan-400/50 animate-spin" />
            <span className="relative z-10">
              <IconPause size="20" />
            </span>
          </Button>
        ) : (
          <Button
            ref={buttonRef}
            type="submit"
            disabled={!hasContent || disabled}
            size="icon-lg"
            className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
            title="Send message"
          >
            <IconSend size="24" />
          </Button>
        )}
      </form>
    </div>
  );
});

MessageInput.displayName = 'MessageInput';
