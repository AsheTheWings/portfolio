'use client';

/**
 * TranslateButton - Language selector for message translation
 * 
 * Features:
 * - Click: Opens language selector popover
 * - Shift+Click: Quick translate using preferredTranslationLanguage
 * - Translations are cached per component per language
 * - Global Escape resets all to original content
 */

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
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
  position: 'left' | 'right';  // Based on role
}

export function TranslateButton({ componentId, originalText, position }: TranslateButtonProps) {
  const [open, setOpen] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [panelElement, setPanelElement] = useState<HTMLElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [buttonTop, setButtonTop] = useState(0);
  
  const preferredLanguage = useAgentStore((s) => s.preferredTranslationLanguage);
  const activeLanguage = useAgentStore((s) => s.activeTranslations[componentId]);
  const cachedTranslations = useAgentStore((s) => s.translationCache[componentId]);
  const setPreferredTranslationLanguage = useAgentStore((s) => s.setPreferredTranslationLanguage);
  const cacheTranslation = useAgentStore((s) => s.cacheTranslation);
  const setActiveTranslation = useAgentStore((s) => s.setActiveTranslation);

  // Get portal target based on position
  useEffect(() => {
    const panelId = position === 'left' ? 'chat-left-panel' : 'chat-right-panel';
    setPanelElement(document.getElementById(panelId));
  }, [position]);

  // Update button position when open changes
  useEffect(() => {
    if (open && buttonRef.current && panelElement) {
      const buttonRect = buttonRef.current.getBoundingClientRect();
      const panelRect = panelElement.getBoundingClientRect();
      setButtonTop(buttonRect.top - panelRect.top);
    }
  }, [open, panelElement]);

  // Close on escape
  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [open]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-translate-panel]') && !target.closest('[data-translate-button]')) {
        setOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
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
    try {
      const response = await fetch('/api/agent/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: originalText,
          targetLanguage: language,
        }),
      });

      if (!response.ok) {
        throw new Error('Translation failed');
      }

      const { translatedText } = await response.json();
      
      // Cache and activate
      cacheTranslation(componentId, language, translatedText);
      setActiveTranslation(componentId, language);
      setPreferredTranslationLanguage(language);
    } catch (error) {
      console.error('Translation error:', error);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleButtonClick = (e: React.MouseEvent) => {
    // Shift+Click: quick translate with preferred language
    if (e.shiftKey && preferredLanguage) {
      e.preventDefault();
      translateTo(preferredLanguage);
      return;
    }
    // Normal click toggles panel
    setOpen(!open);
  };

  const handleSelectLanguage = (language: string) => {
    setOpen(false);
    translateTo(language);
  };

  const isActive = !!activeLanguage;

  const languagePanel = open && panelElement ? createPortal(
    <div
      data-translate-panel
      className={cn(
        'absolute w-[160px] bg-popover border border-border rounded-md shadow-md z-999',
        position === 'left' ? 'right-0' : 'left-0'
      )}
      style={{ top: buttonTop }}
    >
      <Command>
        <CommandInput placeholder="Search..." className="h-9" />
        <CommandList className="scrollbar-inner">
          <CommandEmpty>No language found.</CommandEmpty>
          <CommandGroup>
            {LANGUAGES.map((lang) => (
              <CommandItem
                key={lang.value}
                value={lang.value}
                onSelect={() => handleSelectLanguage(lang.value)}
              >
                {lang.label}
                <Check
                  className={cn(
                    'ml-auto h-4 w-4',
                    activeLanguage === lang.value ? 'opacity-100' : 'opacity-0'
                  )}
                />
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </div>,
    panelElement
  ) : null;

  return (
    <>
      <button
        ref={buttonRef}
        data-translate-button
        onClick={handleButtonClick}
        disabled={isTranslating}
        className={cn(
          'p-1 rounded-md transition-all duration-200 cursor-pointer',
          isActive
            ? 'text-emerald-500 dark:text-emerald-400 opacity-100'
            : 'text-slate-400 dark:text-slate-500 opacity-0 group-hover:opacity-100',
          !isTranslating && 'hover:text-emerald-500 hover:scale-110 dark:hover:text-emerald-400',
          !isTranslating && 'hover:bg-slate-200/50 dark:hover:bg-slate-700/50',
          isTranslating && 'cursor-wait'
        )}
        aria-label={preferredLanguage ? `Translate (Shift+Click for ${preferredLanguage})` : 'Translate'}
        title={preferredLanguage ? `Translate (Shift+Click: ${preferredLanguage})` : 'Translate'}
      >
        {isTranslating ? (
          <Loader2 size={12} className="animate-spin" />
        ) : (
          <Languages size={16} />
        )}
      </button>
      {languagePanel}
    </>
  );
}
