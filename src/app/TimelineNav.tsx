'use client';

import { NavigationBar } from '@/features/shared/components/layout/NavigationBar';
import type { NavItem } from '@/features/shared/components/layout/NavigationBar';
import IconAiLab02 from '@/features/shared/icons/IconAiLab';
import IconLibrary from '@/features/shared/icons/IconLibrary';

function TerminalIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

const TIMELINE_NAV_ITEMS: NavItem[] = [
  { href: '/', icon: <TerminalIcon className="w-5 h-5" />, title: 'Terminal' },
  { href: '/agent-playground', icon: <IconAiLab02 size="20" />, title: 'Agent Playground', isActive: (p) => p === '/agent-playground' || p.startsWith('/agent-playground/') },
  { href: '/library', icon: <IconLibrary size="20" />, title: 'Assets Library', isActive: (p) => p === '/library' || p.startsWith('/library/') },
  { href: '/productivity', icon: <TerminalIcon className="w-5 h-5" />, title: 'Productivity', isActive: (p) => p === '/productivity' || p.startsWith('/productivity/') },
];

export function TimelineNav() {
  return (
    <NavigationBar
      items={TIMELINE_NAV_ITEMS}
      platformSwitch={{ href: '/polymarket', title: 'Switch to Polymarket' }}
    />
  );
}
