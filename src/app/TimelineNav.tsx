'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { NavigationBar } from '@/features/shared/components/layout/NavigationBar';
import type { NavItem } from '@/features/shared/components/layout/NavigationBar';
import { useAuthStore } from '@/features/authentication/stores/authStore';
import { logoutUser } from '@/features/authentication/lib/auth-client';
import IconAiLab02 from '@/features/shared/icons/IconAiLab';
import IconLibrary from '@/features/shared/icons/IconLibrary';

const TIMELINE_NAV_ITEMS: NavItem[] = [
  { href: '/', icon: <IconAiLab02 size="20" />, title: 'Agent', isActive: (p) => p === '/' || /^\/[A-Za-z0-9_-]{16,36}$/.test(p) },
  { href: '/library', icon: <IconLibrary size="20" />, title: 'Library', isActive: (p) => p === '/library' || p.startsWith('/library/') },
];

export function TimelineNav() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = useCallback(async () => {
    try {
      await logoutUser();
    } catch (err) {
      console.error('[TimelineNav] Logout API failed:', err);
    }
    logout();
    router.push('/');
  }, [logout, router]);

  if (!isAuthenticated) return null;

  return (
    <NavigationBar
      items={TIMELINE_NAV_ITEMS}
      platformSwitch={{ href: '/polymarket', title: 'Switch to Polymarket' }}
      onLogout={handleLogout}
    />
  );
}
