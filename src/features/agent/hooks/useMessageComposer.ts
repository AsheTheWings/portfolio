'use client';

/**
 * useMessageComposer - Hook for message input composition
 * 
 * Owns all state related to composing a message:
 * - Input text value
 * - Input ref for cursor manipulation
 * - Library mention dropdown state
 * - Submit handling
 */

import { useState, useRef, useCallback, useEffect, KeyboardEvent } from 'react';
import { formatLibraryPath } from '../utils/libraryMentionParser';
import type { LibraryItem } from '@/features/library';

interface UseMessageComposerOptions {
  /** Called when message is submitted */
  onSend: (message: string) => void;
  /** Called when mention dropdown opens/closes */
  onMentionOpenChange?: (isOpen: boolean) => void;
  /** Whether input is disabled */
  disabled?: boolean;
  /** Allow submission with empty text (e.g., when attachments or staged content exist) */
  allowEmptySubmit?: boolean;
}

interface MentionDropdownProps {
  isOpen: boolean;
  query: string;
  onSelect: (item: LibraryItem, path: string) => void;
  onClose: () => void;
}

interface UseMessageComposerReturn {
  // Input state
  value: string;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  
  // Textarea handlers
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  
  // LibraryPathBrowser props (spread onto component)
  mentionDropdown: MentionDropdownProps;
  
  // Actions
  submit: () => void;
  clear: () => void;
  setValue: (value: string) => void;
  focus: () => void;
  
  // Status
  hasContent: boolean;
}

export function useMessageComposer(options: UseMessageComposerOptions): UseMessageComposerReturn {
  const { onSend, onMentionOpenChange, disabled = false, allowEmptySubmit = false } = options;
  
  // Core input state
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  // Mention dropdown state
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  
  // Notify parent of dropdown state changes
  useEffect(() => {
    onMentionOpenChange?.(mentionOpen);
  }, [mentionOpen, onMentionOpenChange]);
  
  /**
   * Detect @ trigger on input change
   */
  const onChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    setValue(newValue);
    
    // Find if we're in a mention context (after @ but before space)
    const textBeforeCursor = newValue.slice(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      const charBeforeAt = lastAtIndex > 0 ? newValue[lastAtIndex - 1] : ' ';
      if (charBeforeAt === ' ' || charBeforeAt === '\n' || lastAtIndex === 0) {
        const queryAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
        // Don't open for completed mentions (@library/path)
        const isCompletedMention = /^library\//i.test(queryAfterAt);
        if (!queryAfterAt.includes(' ') && !isCompletedMention) {
          setMentionOpen(true);
          setMentionQuery(queryAfterAt);
          setMentionStartIndex(lastAtIndex);
          return;
        }
      }
    }
    
    // No valid @ context
    setMentionOpen(false);
    setMentionQuery('');
    setMentionStartIndex(-1);
  }, []);
  
  /**
   * Close mention dropdown
   */
  const closeMention = useCallback(() => {
    setMentionOpen(false);
    setMentionQuery('');
    setMentionStartIndex(-1);
    inputRef.current?.focus();
  }, []);
  
  /**
   * Handle selection from LibraryPathBrowser
   */
  const handleMentionSelect = useCallback((item: LibraryItem, path: string) => {
    if (mentionStartIndex === -1) return;
    
    const before = value.slice(0, mentionStartIndex);
    const cursorPos = inputRef.current?.selectionStart || value.length;
    const after = value.slice(cursorPos);
    
    if (item.type === 'folder') {
      // Folder: complete mention (same as asset)
      const formattedPath = formatLibraryPath(path);
      const newValue = before + formattedPath + ' ' + after;
      setValue(newValue);
      
      // Close dropdown
      setMentionOpen(false);
      setMentionQuery('');
      setMentionStartIndex(-1);
      
      // Position cursor after mention
      setTimeout(() => {
        if (inputRef.current) {
          const newPos = before.length + formattedPath.length + 1;
          inputRef.current.selectionStart = newPos;
          inputRef.current.selectionEnd = newPos;
          inputRef.current.focus();
        }
      }, 0);
    } else {
      // Asset: complete mention
      const formattedPath = formatLibraryPath(path);
      const newValue = before + formattedPath + ' ' + after;
      setValue(newValue);
      
      // Close dropdown
      setMentionOpen(false);
      setMentionQuery('');
      setMentionStartIndex(-1);
      
      // Position cursor after mention
      setTimeout(() => {
        if (inputRef.current) {
          const newPos = before.length + formattedPath.length + 1;
          inputRef.current.selectionStart = newPos;
          inputRef.current.selectionEnd = newPos;
          inputRef.current.focus();
        }
      }, 0);
    }
  }, [value, mentionStartIndex]);
  
  /**
   * Submit the message
   */
  const submit = useCallback(() => {
    if (disabled) return;
    
    // Close mention if open
    if (mentionOpen) {
      closeMention();
      return;
    }
    
    const trimmed = value.trim();
    if (!trimmed && !allowEmptySubmit) return;
    
    onSend(trimmed);
    setValue('');
  }, [value, mentionOpen, disabled, allowEmptySubmit, onSend, closeMention]);
  
  /**
   * Handle keyboard events
   */
  const onKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Let dropdown handle navigation keys when open
    if (mentionOpen && ['Enter', 'ArrowUp', 'ArrowDown', 'Tab', 'Escape'].includes(e.key)) {
      return;
    }
    
    // Submit on Enter (Shift+Enter for new line)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }, [mentionOpen, submit]);
  
  /**
   * Clear input
   */
  const clear = useCallback(() => {
    setValue('');
    setMentionOpen(false);
    setMentionQuery('');
    setMentionStartIndex(-1);
  }, []);
  
  /**
   * Focus input
   */
  const focus = useCallback(() => {
    inputRef.current?.focus();
  }, []);
  
  /**
   * Set value externally (for history navigation)
   */
  const setValueExternal = useCallback((newValue: string) => {
    setValue(newValue);
    // Reset mention state when value is set externally
    setMentionOpen(false);
    setMentionQuery('');
    setMentionStartIndex(-1);
  }, []);
  
  return {
    // Input state
    value,
    inputRef,
    
    // Textarea handlers
    onChange,
    onKeyDown,
    
    // LibraryPathBrowser props
    mentionDropdown: {
      isOpen: mentionOpen,
      query: mentionQuery,
      onSelect: handleMentionSelect,
      onClose: closeMention,
    },
    
    // Actions
    submit,
    clear,
    setValue: setValueExternal,
    focus,
    
    // Status
    hasContent: value.trim().length > 0,
  };
}
