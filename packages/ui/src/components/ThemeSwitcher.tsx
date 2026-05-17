'use client';

/**
 * Theme switcher component - Circular button with dropdown
 * Allows users to toggle between dark, light, and system themes
 */

import { useState, useRef, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const themes = [
    { value: 'light' as const, label: 'Light', icon: '☀️' },
    { value: 'dark' as const, label: 'Dark', icon: '🌙' },
    { value: 'system' as const, label: 'System', icon: '💻' },
  ];

  const currentTheme = themes.find(t => t.value === theme) || themes[1];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleThemeSelect = (value: typeof theme) => {
    setTheme(value);
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} className="relative">
      {/* Circular button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-12 h-12 rounded-full bg-surface-1 border border-border-subtle shadow-depth-md hover:shadow-depth-lg transition-all flex items-center justify-center text-xl"
        title={`Current theme: ${currentTheme.label}`}
      >
        {currentTheme.icon}
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute top-14 right-0 bg-surface-1 border border-border-subtle rounded-lg shadow-depth-lg overflow-hidden min-w-[140px]">
          {themes.map((t) => (
            <button
              key={t.value}
              onClick={() => handleThemeSelect(t.value)}
              className={`
                w-full px-4 py-2.5 text-left text-sm font-medium transition-all flex items-center gap-2
                ${theme === t.value 
                  ? 'bg-surface-2 text-foreground' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-surface-2'
                }
              `}
            >
              <span className="text-base">{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
