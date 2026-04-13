'use client';

/**
 * Agent ToolsBar - Floating toolbar with circular action buttons
 * Positioned on the right edge, vertically centered
 * Uses useUserInput hook for consolidated input handling
 */

import React from 'react';
import IconSend from '@/features/shared/icons/IconSend';
import { useUserInput } from '../hooks/useUserInput';

interface ToolsBarProps {
  onNewSessionClick?: () => void;
  onAgentConfigClick?: () => void;
  onConfigClick?: () => void;
  onHistoryClick?: () => void;
  onAgentsHubClick?: () => void;
  inputValue?: string;
  isProcessing?: boolean;
  uiInterface?: 'chat' | 'flat';
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 4v16m8-8H4"
      />
    </svg>
  );
}

function SlidersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
      />
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}

function HistoryIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function AgentsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
      />
    </svg>
  );
}

export function ToolsBar({ onNewSessionClick, onAgentConfigClick, onConfigClick, onHistoryClick, onAgentsHubClick, inputValue = '', isProcessing = false, uiInterface = 'chat' }: ToolsBarProps) {
  const { submitUserInput } = useUserInput();
  
  const canSend = inputValue.trim().length > 0 && !isProcessing;
  const isSending = isProcessing;

  const handleSendClick = async () => {
    if (canSend && inputValue.trim()) {
      await submitUserInput(inputValue.trim());
    }
  };
  
  // Only show send button in side-by-side mode (chat mode has its own send button in InteractionArea)
  const showSendButton = uiInterface === 'flat';

  return (
    <div className="fixed right-4 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-3">
      {/* New Session Button */}
      <button
        onClick={onNewSessionClick}
        className="
          w-12 h-12 rounded-full
          bg-surface-1 border border-border-subtle
          shadow-depth-md hover:shadow-depth-lg
          text-foreground hover:text-foreground
          transition-all duration-200
          flex items-center justify-center
          group
          active:scale-95
        "
        title="New Session"
      >
        <div className="transform group-hover:rotate-90 transition-transform duration-200">
          <PlusIcon className="w-5 h-5" />
        </div>
      </button>

      {/* Agent Config Button */}
      <button
        onClick={onAgentConfigClick}
        className="
          w-12 h-12 rounded-full
          bg-surface-1 border border-border-subtle
          shadow-depth-md hover:shadow-depth-lg
          text-foreground hover:text-foreground
          transition-all duration-200
          flex items-center justify-center
          group
          active:scale-95
        "
        title="Agent Configuration"
      >
        <div className="transform group-hover:scale-110 transition-transform duration-200">
          <SlidersIcon className="w-5 h-5" />
        </div>
      </button>

      {/* History Button */}
      <button
        onClick={onHistoryClick}
        className="
          w-12 h-12 rounded-full
          bg-surface-1 border border-border-subtle
          shadow-depth-md hover:shadow-depth-lg
          text-foreground hover:text-foreground
          transition-all duration-200
          flex items-center justify-center
          group
          active:scale-95
        "
        title="Session History"
      >
        <div className="transform group-hover:scale-110 transition-transform duration-200">
          <HistoryIcon className="w-5 h-5" />
        </div>
      </button>

      {/* Agents Hub Button */}
      <button
        onClick={onAgentsHubClick}
        className="
          w-12 h-12 rounded-full
          bg-surface-1 border border-border-subtle
          shadow-depth-md hover:shadow-depth-lg
          text-foreground hover:text-foreground
          transition-all duration-200
          flex items-center justify-center
          group
          active:scale-95
        "
        title="Agents Hub"
      >
        <div className="transform group-hover:scale-110 transition-transform duration-200">
          <AgentsIcon className="w-5 h-5" />
        </div>
      </button>

      {/* Config Button */}
      <button
        onClick={onConfigClick}
        className="
          w-12 h-12 rounded-full
          bg-surface-1 border border-border-subtle
          shadow-depth-md hover:shadow-depth-lg
          text-foreground hover:text-foreground
          transition-all duration-200
          flex items-center justify-center
          group
          active:scale-95
        "
        title="Settings"
      >
        <div className="transform group-hover:rotate-90 transition-transform duration-300">
          <SettingsIcon className="w-5 h-5" />
        </div>
      </button>

      {/* Send Button - Only in side-by-side mode */}
      {showSendButton && (
        <button
          onClick={handleSendClick}
          disabled={!canSend || isSending}
          className={`
            w-12 h-12 rounded-full
            ${canSend && !isSending
              ? 'bg-slate-900 dark:bg-slate-100'
              : 'bg-surface-1 border border-border-subtle'
            }
            shadow-depth-md hover:shadow-depth-lg
            ${canSend && !isSending
              ? 'text-white dark:text-slate-900'
              : 'text-slate-400 dark:text-slate-600'
            }
            transition-all duration-200
            flex items-center justify-center
            group
            disabled:cursor-not-allowed
            ${canSend && !isSending ? 'active:scale-95' : ''}
            ${isSending ? 'animate-pulse' : ''}
          `}
          title={isSending ? 'Sending...' : canSend ? 'Send Message' : 'Type a message first'}
        >
          <div className={`transform transition-transform duration-200 ${canSend && !isSending ? 'group-hover:scale-115' : ''} [&_path]:fill-current`}>
            <IconSend size="20" />
          </div>
        </button>
      )}
    </div>
  );
}
