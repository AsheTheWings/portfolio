'use client';

/**
 * Multi-Domain Configuration UI
 * Dynamically composes config sections from all registered domain plugins
 */

import { useState, createElement, useRef, useCallback } from 'react';
import { usePluginStore } from '../stores/pluginStore';
import type { ConfigSectionSaveFunction } from '../types/config';

interface ConfigUIProps {
  onComplete: (resultText: string) => void;
}

export function ConfigUI({ onComplete }: ConfigUIProps) {
  const sections = usePluginStore((state) => state.configSections);
  const [dirtySections, setDirtySections] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  
  // Store save functions from each section
  const saveFunctionsRef = useRef<Map<string, ConfigSectionSaveFunction>>(new Map());

  // Create stable callback references for each section
  const sectionCallbacksRef = useRef<Map<string, {
    onRegisterSave: (saveFunction: ConfigSectionSaveFunction) => void;
    onDirtyChange: (isDirty: boolean) => void;
  }>>(new Map());

  // Get or create callbacks for a section
  const getSectionCallbacks = useCallback((sectionId: string) => {
    if (!sectionCallbacksRef.current.has(sectionId)) {
      sectionCallbacksRef.current.set(sectionId, {
        onRegisterSave: (saveFunction: ConfigSectionSaveFunction) => {
          saveFunctionsRef.current.set(sectionId, saveFunction);
        },
        onDirtyChange: (isDirty: boolean) => {
          setDirtySections(prev => {
            const newSet = new Set(prev);
            if (isDirty) {
              newSet.add(sectionId);
            } else {
              newSet.delete(sectionId);
            }
            return newSet;
          });
        }
      });
    }
    return sectionCallbacksRef.current.get(sectionId)!;
  }, []);

  const handleSaveAll = async () => {
    if (dirtySections.size === 0) {
      onComplete('No changes to save');
      return;
    }

    setIsSaving(true);
    let successCount = 0;
    let failureCount = 0;

    // Call save function for each dirty section
    for (const sectionId of dirtySections) {
      const saveFunction = saveFunctionsRef.current.get(sectionId);
      if (saveFunction) {
        try {
          const success = await saveFunction();
          if (success) {
            successCount++;
          } else {
            failureCount++;
          }
        } catch (error) {
          failureCount++;
          console.error(`Error saving section ${sectionId}:`, error);
        }
      }
    }

    setIsSaving(false);

    // Report results
    if (failureCount === 0) {
      onComplete(`✓ Saved ${successCount} section${successCount !== 1 ? 's' : ''}`);
    } else {
      onComplete(`⚠ Saved ${successCount}, failed ${failureCount}`);
    }
  };

  const handleCancel = () => {
    onComplete('Configuration cancelled');
  };

  if (sections.length === 0) {
    return (
      <div className="max-w-2xl bg-surface-1 border border-border-subtle rounded-lg shadow-depth-md p-6">
        <div className="text-center text-foreground-muted">
          <p>No configuration sections available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl bg-surface-1 border border-border-subtle rounded-lg shadow-depth-md">
      {/* Header */}
      <div className="border-b border-border-subtle p-6">
        <h2 className="text-xl font-semibold text-foreground">Configuration</h2>
        <p className="text-sm text-foreground-muted mt-1">
          Adjust settings across all features
        </p>
      </div>

      {/* Config Sections */}
      <div className="divide-y divide-border-subtle">
        {sections.map((section) => {
          const callbacks = getSectionCallbacks(section.id);
          return (
            <div key={section.id} className="p-6">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-foreground">
                  {section.title}
                </h3>
                {section.description && (
                  <p className="text-sm text-foreground-muted mt-1">
                    {section.description}
                  </p>
                )}
              </div>
              
              {/* Render domain-specific config component */}
              <div>
                {createElement(section.component, {
                  onRegisterSave: callbacks.onRegisterSave,
                  onDirtyChange: callbacks.onDirtyChange,
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-between p-6 border-t border-border-subtle bg-surface-2">
        <div className="text-sm text-foreground-muted">
          {dirtySections.size > 0 ? (
            <span>
              {dirtySections.size} section{dirtySections.size !== 1 ? 's have' : ' has'} unsaved changes
            </span>
          ) : (
            <span>No unsaved changes</span>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={handleCancel}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium text-foreground-muted hover:text-foreground transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveAll}
            disabled={dirtySections.size === 0 || isSaving}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving...' : 'Save All'}
          </button>
        </div>
      </div>
    </div>
  );
}
