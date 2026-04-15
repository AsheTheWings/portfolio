'use client';

/**
 * TranslateButton - Language selector for message translation
 *
 * Features:
 * - Click: Opens language selector dropdown (absolute, no portal)
 * - Shift+Click: Quick translate using preferredTranslationLanguage
 * - Translations are cached per component per language
 * - Global Escape resets all to original content
 */

import React, { useState, useEffect, useRef } from 'react';
import { Languages, Check, Loader2 } from 'lucide-react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/features/shared/components/shadcn/command';
import { useAgentStore } from '../stores/useAgentStore';
import { cn } from '@/lib/utils';

// Supported languages for translation
const LANGUAGES = [
  { value: 'english', label: 'English' },
  { value: 'spanish', label: 'Spanish' },
  { value: 'french', label: 'French' },
  { value: 'german', label: 'German' },
  { value: 'italian', label: 'Italian' },
  { value: 'portuguese', label: 'Portuguese' },
  { value: 'russian', label: 'Russian' },
  { value: 'japanese', label: 'Japanese' },
  { value: 'korean', label: 'Korean' },
  { value: 'chinese', label: 'Chinese' },
  { value: 'arabic', label: 'Arabic' },
  { value: 'hindi', label: 'Hindi' },
  { value: 'dutch', label: 'Dutch' },
  { value: 'polish', label: 'Polish' },
  { value: 'turkish', label: 'Turkish' },
  { value: 'vietnamese', label: 'Vietnamese' },
  { value: 'thai', label: 'Thai' },
  { value: 'swedish', label: 'Swedish' },
  { value: 'danish', label: 'Danish' },
  { value: 'norwegian', label: 'Norwegian' },
] as const;

interface TranslateButtonProps {
  componentId: string;
  originalText: string;
  isSelected?: boolean;
}

export function TranslateButton({ componentId, originalText, isSelected = false }: TranslateButtonProps) {
  const [open, setOpen] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const preferredLanguage = useAgentStore((s) => s.preferredTranslationLanguage);
  const activeLanguage = useAgentStore((s) => s.activeTranslations[componentId]);
  const cachedTranslations = useAgentStore((s) => s.translationCache[componentId]);
  const setPreferredTranslationLanguage = useAgentStore((s) => s.setPreferredTranslationLanguage);
  const cacheTranslation = useAgentStore((s) => s.cacheTranslation);
  const setActiveTranslation = useAgentStore((s) => s.setActiveTranslation);
  const setComponentTranslating = useAgentStore((s) => s.setComponentTranslating);

  // Close on escape or click outside
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); }
    };
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handleKey, true);
    window.addEventListener('mousedown', handleClick);
    return () => {
      window.removeEventListener('keydown', handleKey, true);
      window.removeEventListener('mousedown', handleClick);
    };
  }, [open]);

  const translateTo = async (language: string) => {
    // If already showing this language, toggle back to original
    if (activeLanguage === language) {
      setActiveTranslation(componentId, null);
      return;
    }

    // Check cache first
    if (cachedTranslations?.[language]) {
      setActiveTranslation(componentId, language);
      setPreferredTranslationLanguage(language);
      return;
    }

    // Fetch translation
    setIsTranslating(true);
    setComponentTranslating(componentId, true);
    try {
      const response = await fetch('/api/agent/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: originalText,
          targetLanguage: language,
        }),
      });

      if (!response.ok) throw new Error('Translation failed');

      const { translatedText } = await response.json();
      cacheTranslation(componentId, language, translatedText);
      setActiveTranslation(componentId, language);
      setPreferredTranslationLanguage(language);
    } catch (error) {
      console.error('Translation error:', error);
    } finally {
      setIsTranslating(false);
      setComponentTranslating(componentId, false);
    }
  };

  const handleButtonClick = (e: React.MouseEvent) => {
    if (e.shiftKey && preferredLanguage) {
      e.preventDefault();
      translateTo(preferredLanguage);
      return;
    }
    setOpen(!open);
  };

  const isActive = !!activeLanguage;

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={handleButtonClick}
        disabled={isTranslating}
        className={cn(
          'p-1 rounded-md transition-all duration-200 cursor-pointer',
          isTranslating && 'cursor-wait',
          isActive
            ? 'text-emerald-500 dark:text-emerald-400 hover:text-emerald-400 hover:scale-110 dark:hover:text-emerald-300'
            : isSelected
              ? 'text-cyan-500 dark:text-cyan-400 hover:text-cyan-400 hover:scale-110 dark:hover:text-cyan-300'
              : 'text-slate-400 dark:text-slate-500 hover:text-cyan-500 hover:scale-110 dark:hover:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-700/50',
        )}
        aria-label={preferredLanguage ? `Translate (Shift+Click for ${preferredLanguage})` : 'Translate'}
        title={preferredLanguage ? `Translate (Shift+Click: ${preferredLanguage})` : 'Translate'}
      >
        {isTranslating ? (
          <Loader2 size={12} className="animate-spin" />
        ) : (
          <Languages size={12} />
        )}
      </button>

      {open && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-[160px] bg-popover border border-border rounded-md shadow-md z-50">
          <Command>
            <CommandInput placeholder="Search..." className="h-9" />
            <CommandList className="scrollbar-inner">
              <CommandEmpty>No language found.</CommandEmpty>
              <CommandGroup>
                {LANGUAGES.map((lang) => (
                  <CommandItem
                    key={lang.value}
                    value={lang.value}
                    onSelect={() => { setOpen(false); translateTo(lang.value); }}
                  >
                    {lang.label}
                    <Check
                      className={cn(
                        'ml-auto h-4 w-4',
                        activeLanguage === lang.value ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </div>
      )}
    </div>
  );
}
