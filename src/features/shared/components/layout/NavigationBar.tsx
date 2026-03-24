'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatedThemeToggler } from '@/features/shared/components/shadcn/animated-theme-toggler';
import { ArrowLeftRight } from 'lucide-react';

export interface NavItem {
  href: string;
  icon: React.ReactNode;
  title: string;
  /** Match function — receives current pathname, returns true when this item is active */
  isActive?: (pathname: string) => boolean;
}

export interface PlatformSwitchConfig {
  href: string;
  title: string;
}

interface NavigationBarProps {
  items: NavItem[];
  platformSwitch: PlatformSwitchConfig;
}

function NavButton({ href, icon, title, active }: { href: string; icon: React.ReactNode; title: string; active: boolean }) {
  const router = useRouter();

  return (
    <button
      onClick={() => router.push(href)}
      className={`
        w-12 h-12 rounded-full
        ${active
          ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
          : 'bg-surface-1 border border-border-subtle text-foreground hover:text-foreground'
        }
        shadow-depth-md hover:shadow-depth-lg
        transition-all duration-200
        flex items-center justify-center
        group
        active:scale-95
      `}
      title={title}
    >
      <div className={`transform transition-transform duration-200 ${!active ? 'group-hover:scale-110' : ''}`}>
        {icon}
      </div>
    </button>
  );
}

export function NavigationBar({ items, platformSwitch }: NavigationBarProps) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="fixed left-4 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-3">
      {items.map((item) => (
        <NavButton
          key={item.href}
          href={item.href}
          icon={item.icon}
          title={item.title}
          active={item.isActive ? item.isActive(pathname) : pathname === item.href}
        />
      ))}

      {/* Platform Switcher */}
      <button
        onClick={() => router.push(platformSwitch.href)}
        className="
          w-12 h-12 rounded-full
          bg-surface-1 border border-border-subtle
          text-muted-foreground hover:text-foreground
          shadow-depth-md hover:shadow-depth-lg
          transition-all duration-200
          flex items-center justify-center
          group
          active:scale-95
        "
        title={platformSwitch.title}
      >
        <div className="transform transition-transform duration-200 group-hover:scale-110">
          <ArrowLeftRight className="w-5 h-5" />
        </div>
      </button>

      {/* Theme Toggle */}
      <div>
        <AnimatedThemeToggler
          className="
            w-12 h-12 rounded-full
            bg-surface-1 border border-border-subtle
            shadow-depth-md hover:shadow-depth-lg
            text-foreground hover:text-foreground
            transition-all duration-200
            flex items-center justify-center
            group
            active:scale-95
            [&>svg]:w-5 [&>svg]:h-5
          "
          duration={500}
        />
      </div>
    </div>
  );
}

export default NavigationBar;
