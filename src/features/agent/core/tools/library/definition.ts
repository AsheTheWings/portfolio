/**
 * Library Browse Tool - Definition
 * Tool schema for browsing and accessing library assets
 */

import type { Tool } from '../../../types';
import { handleLibraryBrowse } from './handler';

export const libraryBrowseTools: Record<string, Tool> = {
  'library_browse': {
    server: 'library',
    tool: 'browse',
    handler: handleLibraryBrowse,
    description: `Browse and access the user's asset library.

## Overview

The library contains folders and assets (images, videos, documents). Users reference library items in messages using the format \`@library/path/to/file.jpg\`.

## Actions

### list_items (lightweight - use this first)
List contents of a folder (folders and assets at that level). Fast and cheap.
- **path** (string, optional): Folder path. Empty or "/" for root level.
- Returns: List of items with basic info (id, name, type, path)
- Use for: Browsing, exploring, finding files by name

### get_metadata
Get detailed metadata for a folder or asset without loading file content.
- **path** (string, required): Path to folder or asset
- Returns: Full metadata (size, dimensions, created_at, tags, etc.)
- Use for: Getting file details without loading content

### read_assets
Read one or more assets. Returns metadata and loads files for analysis.
- **paths** (string[], required): Array of asset paths (e.g., ["Photos/sunset.jpg", "Photos/beach.jpg"])
- Returns: Asset metadata + file contents available for analysis
- Use for: Analyzing specific files the user mentioned or you found
- Supports batch: Load multiple specific files in one call

### read_folder (HEAVY - use sparingly)
Read ALL assets in a folder recursively. Loads every file into context.
- **path** (string, required): Path to folder
- Returns: All asset metadata + ALL file contents loaded for analysis
- WARNING: This is expensive! Loads every image/file in the folder.
- Use ONLY when: User explicitly asks to analyze all files in a folder
- Prefer: list_items first, then read_assets on specific files you need

### search
Search assets by name, tags, or content.
- **query** (string, required): Search query
- **filters** (object, optional): { file_type?: 'image'|'video'|'document', folder_path?: string }
- Returns: Matching assets with relevance info

### folder_tree
Get the complete folder hierarchy.
- **path** (string, optional): Root path for tree. Empty for full tree.
- Returns: Nested folder structure with asset counts

## Path Format

User messages use: \`@library/FolderName/SubFolder/file.ext\` (the \`@library/\` prefix indicates a library reference)
Tool paths can omit the prefix: \`FolderName/SubFolder/file.ext\`
- Empty path or \`/\` refers to the root
- Folder names are case-sensitive
- Asset paths include the file extension

## IMPORTANT: Showing Files to the User

The ONLY way to display library items (images, files, folders) to the user is by using \`@library/path\` mentions in your response text. Without this mention, the user CANNOT see the file.

**You MUST use this format**: \`@library/FolderName/file.ext\`

The UI automatically renders these mentions as interactive previews with thumbnails shown at the end of your response. Plain text descriptions or URLs will NOT work - only @library/ mentions are rendered visually.

**Important**: The mentions stay as text in your response - they are NOT replaced with the actual file content. The UI parses them and displays previews separately at the end of your response.

**Examples**:
- "Here's your image: @library/Photos/sunset.jpg" → User sees thumbnail preview
- "I found this in @library/Documents/report.pdf" → User sees PDF preview
- "Check the folder @library/Chapter_01" → User sees folder with item count

**Rules**:
- ALWAYS include @library/ mentions when presenting files to the user
- Use exact paths from tool results (case-sensitive)
- Include file extension for assets
- Multiple mentions in one message are supported`,
    inputSchema: {
      type: 'object',
      required: ['action'],
      properties: {
        action: {
          type: 'string',
          enum: ['list_items', 'get_metadata', 'read_assets', 'read_folder', 'search', 'folder_tree'],
          description: 'The browse action to perform',
        },
        path: {
          type: 'string',
          description: 'Path to folder or asset (e.g., "Photos/sunset.jpg" or "@library/Photos/sunset.jpg")',
        },
        paths: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of asset paths for read_assets (e.g., ["Photos/sunset.jpg", "Photos/beach.jpg"])',
        },
        query: {
          type: 'string',
          description: 'Search query (for search action)',
        },
        filters: {
          type: 'object',
          properties: {
            file_type: {
              type: 'string',
              enum: ['image', 'video', 'document'],
              description: 'Filter by file type',
            },
            folder_path: {
              type: 'string',
              description: 'Limit search to folder path',
            },
          },
          description: 'Search filters (for search action)',
        },
      },
    },
    source: 'builtIn',
  },
};
