'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Home, Crown } from 'lucide-react';
import { NavigationBar } from '@portfolio/ui/components/layout/NavigationBar';
import type { NavItem } from '@portfolio/ui/components/layout/NavigationBar';
import { useAuthStore } from '@portfolio/auth/stores/authStore';
import { logoutUser } from '@portfolio/auth/lib/auth-client';
import IconLibrary from '@portfolio/ui/icons/IconLibrary';

const TIMELINE_SESSION_PATH_RE = /^\/apps\/timeline\/[A-Za-z0-9_-]{16,36}$/;

const TIMELINE_NAV_ITEMS: NavItem[] = [
  {
    href: '/apps/timeline',
    icon: <Home size="20" />,
    title: 'Home',
    isActive: (pathname) => pathname === '/apps/timeline' || TIMELINE_SESSION_PATH_RE.test(pathname),
  },
  {
    href: '/apps/timeline/library',
    icon: <IconLibrary size="20" />,
    title: 'Library',
    isActive: (pathname) => pathname === '/apps/timeline/library' || pathname.startsWith('/apps/timeline/library/'),
  },
  {
    href: '/apps/timeline/chess',
    icon: <Crown size="20" />,
    title: 'Chess',
    isActive: (pathname) => pathname === '/apps/timeline/chess' || pathname.startsWith('/apps/timeline/chess/'),
  },
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
    window.location.href = '/';
  }, [logout, router]);

  if (!isAuthenticated) return null;

  return (
    <NavigationBar
      items={TIMELINE_NAV_ITEMS}
      platformSwitch={{ href: '/', title: 'Back to Portfolio' }}
      onLogout={handleLogout}
    />
  );
}
