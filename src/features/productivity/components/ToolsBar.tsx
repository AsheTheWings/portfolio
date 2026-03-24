'use client';

import React from 'react';

export type ProductivityAction = 'new-slot' | 'workloads' | 'settings';

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

function WorkloadsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 6h16M4 12h16M4 18h10"
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

interface ToolsBarProps {
  onAction: (action: ProductivityAction) => void;
}

export function ToolsBar({ onAction }: ToolsBarProps) {
  return (
    <div className="fixed right-4 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-3">
      <button
        onClick={() => onAction('new-slot')}
        className={`
          w-12 h-12 rounded-full
          bg-surface-1 border border-border-subtle text-foreground hover:text-foreground
          shadow-depth-md hover:shadow-depth-lg
          transition-all duration-200
          flex items-center justify-center
          group
          active:scale-95
        `}
        title="New Slot"
      >
        <div className="transform transition-transform duration-200 group-hover:rotate-90">
          <PlusIcon className="w-5 h-5" />
        </div>
      </button>

      <button
        onClick={() => onAction('workloads')}
        className={`
          w-12 h-12 rounded-full
          bg-surface-1 border border-border-subtle text-foreground hover:text-foreground
          shadow-depth-md hover:shadow-depth-lg
          transition-all duration-200
          flex items-center justify-center
          group
          active:scale-95
        `}
        title="Workloads"
      >
        <div className="transform transition-transform duration-200 group-hover:scale-110">
          <WorkloadsIcon className="w-5 h-5" />
        </div>
      </button>

      <button
        onClick={() => onAction('settings')}
        className={`
          w-12 h-12 rounded-full
          bg-surface-1 border border-border-subtle text-foreground hover:text-foreground
          shadow-depth-md hover:shadow-depth-lg
          transition-all duration-200
          flex items-center justify-center
          group
          active:scale-95
        `}
        title="Settings"
      >
        <div className="transform transition-transform duration-200 group-hover:rotate-90">
          <SettingsIcon className="w-5 h-5" />
        </div>
      </button>
    </div>
  );
}
