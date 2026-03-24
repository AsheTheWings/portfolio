/**
 * Nano Banana Tools - Handler (Client-side)
 * Calls API route to perform image generation
 */

import type { LibraryItem } from '@/features/library/types';

export interface GenerateImageResult {
  status: 'success' | 'error';
  message?: string;
  items?: Record<string, LibraryItem>;
  libraryItemIds?: string[];
}

/**
 * Normalize library path - strip @library/ prefix
 */
function normalizePath(path: string): string {
  return path
    .replace(/^@library\//i, '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');
}

/**
 * Handler for nano-banana/generate_image tool
 * Calls the API route for server-side image generation
 */
export async function handleGenerateImage(
  args: Record<string, any>,
  context: { agentConfig?: any; userFeedback?: any; componentId?: string }
): Promise<GenerateImageResult> {
  try {
    // Normalize reference image paths and save_to path
    const normalizedArgs = {
      ...args,
      reference_images: args.reference_images?.map(normalizePath),
      reference_image_ids: args.reference_image_ids,
      save_to: args.save_to ? normalizePath(args.save_to) : undefined,
    };

    const response = await fetch('/api/agent/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(normalizedArgs),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      return {
        status: 'error',
        message: error.message || `API error: ${response.status}`,
      };
    }

    const data: GenerateImageResult = await response.json();

    // Transform items: use path as key, remove internal fields
    if (data.items) {
      const transformedItems: Record<string, Record<string, unknown>> = {};
      
      for (const item of Object.values(data.items)) {
        // Use path as key, strip id, thumbnail_url, storage_url for cleaner response
        const { id, thumbnail_url, storage_url, ...rest } = item as unknown as Record<string, unknown>;
        transformedItems[item.path] = rest;
      }
      
      data.items = transformedItems as unknown as Record<string, LibraryItem>;
    }

    return data;
  } catch (err: unknown) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Failed to generate image',
    };
  }
}
