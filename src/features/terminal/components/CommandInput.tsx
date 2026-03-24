'use client';

/**
 * Command input field with history navigation
 */

import { useState, useEffect, useRef, KeyboardEvent } from 'react';

interface CommandInputProps {
  onCommand: (input: string) => void;
  isProcessing: boolean;
  history: string[];
}

export function CommandInput({ onCommand, isProcessing, history }: CommandInputProps) {
  const [input, setInput] = useState('');
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input
  useEffect(() => {
    inputRef.current?.focus();
  }, [isProcessing]);

  // Global keyboard listener - focus input on any typing
  useEffect(() => {
    const handleGlobalKeyDown = (event: globalThis.KeyboardEvent) => {
      // Skip if input is already focused
      if (document.activeElement === inputRef.current) return;

      // Skip if processing
      if (isProcessing) return;

      // Skip modifier-only keys
      if (event.ctrlKey || event.altKey || event.metaKey) return;

      // Skip special keys (arrows, enter, escape, tab, etc.)
      if (
        event.key.length > 1 && 
        !['Backspace', 'Delete'].includes(event.key)
      ) return;

      // Focus the input for printable characters or backspace/delete
      if (
        event.key.length === 1 || 
        event.key === 'Backspace' || 
        event.key === 'Delete'
      ) {
        inputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isProcessing]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;

    onCommand(input);
    setInput('');
    setHistoryIndex(-1);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // Navigate command history with up/down arrows
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length === 0) return;
      
      const newIndex = historyIndex < history.length - 1 ? historyIndex + 1 : historyIndex;
      setHistoryIndex(newIndex);
      setInput(history[history.length - 1 - newIndex]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex <= 0) {
        setHistoryIndex(-1);
        setInput('');
      } else {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(history[history.length - 1 - newIndex]);
      }
    }
  };

  return (
    <div className="flex justify-center">
      <form 
        onSubmit={handleSubmit} 
        className="w-[60%] flex items-center gap-3 bg-surface-1 rounded-full px-5 py-4 shadow-depth-md transition-all hover:shadow-depth-lg border border-border-subtle"
        style={{
          boxShadow: 'var(--shadow-md), inset 0 0 0 1px oklch(0.95 0.002 264 / 0.1)'
        }}
      >
        <div className="flex items-center gap-2">
          <span className="text-primary font-bold text-sm">›</span>
          {isProcessing && (
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          )}
        </div>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isProcessing}
          className="flex-1 bg-transparent border-none outline-none text-foreground font-mono text-sm placeholder:text-muted-foreground disabled:opacity-50"
          placeholder={isProcessing ? 'Processing...' : 'Enter command...'}
          autoComplete="off"
          spellCheck={false}
        />
      </form>
    </div>
  );
}
