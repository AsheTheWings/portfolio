/**
 * Library Browse Tool - Handler (Client-side)
 * Calls API route to perform library operations
 */

import type { LibraryItem, FolderTreeNode } from '@/features/library/types';

// Re-export for consumers
export type { LibraryItem, FolderTreeNode };

export interface BrowseResult {
  status: 'success' | 'error';
  message?: string;
  items?: Record<string, LibraryItem>;
  tree?: FolderTreeNode[];
  libraryItemIds?: string[];  // Agent-specific: asset IDs for file resolution
}

/**
 * Normalize library path - strip @library/ prefix
 */
function normalizePath(path: string | undefined): string {
  if (!path) return '';
  return path
    .replace(/^@library\//i, '')  // @library/path format
    .replace(/^\/+/, '')           // leading slashes
    .replace(/\/+$/, '');          // trailing slashes
}

/**
 * Main handler for library/browse tool
 * Normalizes agent-specific paths and calls the API route
 */
export async function handleLibraryBrowse(
  args: Record<string, any>,
  context: { agentConfig?: any; userFeedback?: any; componentId?: string }
): Promise<BrowseResult> {
  try {
    // Normalize paths before sending to API
    const normalizedArgs = {
      ...args,
      path: normalizePath(args.path),
      paths: args.paths?.map(normalizePath),
    };

    const response = await fetch('/api/library/browse', {
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

    const data: BrowseResult = await response.json();

    // Transform items for agent: use path as key, remove unnecessary fields
    if (data.items) {
      const assetIds: string[] = [];
      const transformedItems: Record<string, Record<string, unknown>> = {};

      for (const item of Object.values(data.items)) {
        // Collect asset IDs for file resolution
        if (item.type === 'asset') {
          assetIds.push(item.id);
        }

        // Use path as key, strip id, thumbnailUrl, and storageUrl
        const { id, thumbnailUrl, storageUrl, ...rest } = item as unknown as Record<string, unknown>;
        transformedItems[item.path] = rest;
      }

      data.items = transformedItems as unknown as Record<string, LibraryItem>;

      // For read actions, include asset IDs for file resolution in gemini.ts
      if (
        (args.action === 'read_assets' || args.action === 'read_folder') &&
        assetIds.length > 0
      ) {
        data.libraryItemIds = assetIds;
      }
    }

    return data;
  } catch (err: unknown) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Failed to call library browse API',
    };
  }
}
