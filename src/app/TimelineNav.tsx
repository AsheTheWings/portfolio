'use client';

import { NavigationBar } from '@/features/shared/components/layout/NavigationBar';
import type { NavItem } from '@/features/shared/components/layout/NavigationBar';
import IconAiLab02 from '@/features/shared/icons/IconAiLab';
import IconLibrary from '@/features/shared/icons/IconLibrary';

function ProductivityIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  );
}

const TIMELINE_NAV_ITEMS: NavItem[] = [
  { href: '/', icon: <IconAiLab02 size="20" />, title: 'Agent', isActive: (p) => p === '/' || /^\/[a-f0-9-]+$/.test(p) },
  { href: '/library', icon: <IconLibrary size="20" />, title: 'Library', isActive: (p) => p === '/library' || p.startsWith('/library/') },
  { href: '/productivity', icon: <ProductivityIcon className="w-5 h-5" />, title: 'Productivity', isActive: (p) => p === '/productivity' || p.startsWith('/productivity/') },
];

export function TimelineNav() {
  return (
    <NavigationBar
      items={TIMELINE_NAV_ITEMS}
      platformSwitch={{ href: '/polymarket', title: 'Switch to Polymarket' }}
    />
  );
}
