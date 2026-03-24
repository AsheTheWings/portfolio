/**
 * Plugin Registry Store
 * Manages dynamic plugin registrations (e.g., config sections)
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { ComponentType } from 'react';

export interface ConfigSectionProps {
  onRegisterSave: (saveFunction: () => Promise<boolean>) => void;
  onDirtyChange: (isDirty: boolean) => void;
}

export interface ConfigSection {
  id: string;
  title: string;
  description?: string;
  component: ComponentType<ConfigSectionProps>;
  order?: number;
}

interface PluginState {
  configSections: ConfigSection[];
  
  // Actions
  registerConfigSection: (section: ConfigSection) => void;
  unregisterConfigSection: (id: string) => void;
  clearConfigSections: () => void;
}

export const usePluginStore = create<PluginState>()(
  devtools(
    (set) => ({
      configSections: [],

      registerConfigSection: (section) =>
        set(
          (state) => {
            // Avoid duplicates
            if (state.configSections.some((s) => s.id === section.id)) {
              return state;
            }
            return {
              configSections: [...state.configSections, section].sort((a, b) => {
                const orderA = a.order ?? 999;
                const orderB = b.order ?? 999;
                if (orderA !== orderB) return orderA - orderB;
                return a.title.localeCompare(b.title);
              }),
            };
          },
          false,
          'plugin/registerConfigSection'
        ),

      unregisterConfigSection: (id) =>
        set(
          (state) => ({
            configSections: state.configSections.filter((s) => s.id !== id),
          }),
          false,
          'plugin/unregisterConfigSection'
        ),

      clearConfigSections: () =>
        set(
          { configSections: [] },
          false,
          'plugin/clearConfigSections'
        ),
    }),
    { name: 'PluginStore' }
  )
);
