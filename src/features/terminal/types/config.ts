/**
 * Configuration system types
 * Defines the interface for multi-domain configuration
 */

import { ComponentType } from 'react';

/**
 * Save function that sections expose to parent
 * Returns true if save was successful, false otherwise
 */
export type ConfigSectionSaveFunction = () => Promise<boolean> | boolean;

/**
 * Props for config section components
 */
export interface ConfigSectionProps {
  onRegisterSave?: (saveFunction: ConfigSectionSaveFunction) => void;  // Register save function with parent
  onDirtyChange?: (isDirty: boolean) => void;                          // Notify parent of dirty state changes
}

/**
 * Configuration section registration
 * Each domain provides this to register their config UI
 */
export interface ConfigSection {
  id: string;                                      // Unique identifier (e.g., 'performance', 'auth')
  title: string;                                   // Display title (e.g., 'Performance Settings')
  description?: string;                            // Optional description
  order?: number;                                  // Display order (lower = first)
  component: ComponentType<ConfigSectionProps>;    // The config UI component for this section
}
