/**
 * Library Mention Parser
 * Parses library path references from message text
 * 
 * Format: @library/path/to/file.ext
 * - Lowercase 'library' prefix for consistency
 * - Used by both user messages and agent responses
 */

// Regex for @library/path format
// Excludes: whitespace, punctuation, backticks, brackets, parentheses
const LIBRARY_PATH_REGEX = /@library\/([^\s,;:!?`'"()\[\]{}]+)/g;

export interface LibraryPathMatch {
  /** The full matched text (e.g., "@library/Photos/sunset.jpg") */
  fullMatch: string;
  /** The extracted path (e.g., "Photos/sunset.jpg") */
  path: string;
  /** Start index in original string */
  startIndex: number;
  /** End index in original string */
  endIndex: number;
}

/**
 * Parse @library/path patterns from text content
 */
export function parseLibraryPaths(content: string): string[] {
  if (!content) return [];
  
  const matches: string[] = [];
  let match;
  
  // Reset regex state
  LIBRARY_PATH_REGEX.lastIndex = 0;
  
  while ((match = LIBRARY_PATH_REGEX.exec(content)) !== null) {
    // Decode URL-encoded path (e.g., %20 -> space)
    matches.push(decodeLibraryPath(match[1]));
  }
  
  return [...new Set(matches)]; // Deduplicate
}

/**
 * Parse @library/path patterns with position information
 * Used for highlighting/replacing text
 */
export function parseLibraryPathsWithPositions(content: string): LibraryPathMatch[] {
  if (!content) return [];
  
  const matches: LibraryPathMatch[] = [];
  let match;
  
  // Reset regex state
  LIBRARY_PATH_REGEX.lastIndex = 0;
  
  while ((match = LIBRARY_PATH_REGEX.exec(content)) !== null) {
    matches.push({
      fullMatch: match[0],
      path: match[1],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    });
  }
  
  return matches;
}

export type TextSegment = 
  | { type: 'text'; value: string }
  | { type: 'library-path'; value: string; path: string };

/**
 * Split content into segments of plain text and library references
 * Useful for rendering highlighted text
 */
export function segmentContent(content: string): TextSegment[] {
  if (!content) return [];
  
  const segments: TextSegment[] = [];
  let lastIndex = 0;
  let match;
  
  // Reset regex state
  LIBRARY_PATH_REGEX.lastIndex = 0;
  
  while ((match = LIBRARY_PATH_REGEX.exec(content)) !== null) {
    const matchStart = match.index;
    const matchEnd = matchStart + match[0].length;
    
    // Add text before match
    if (matchStart > lastIndex) {
      segments.push({
        type: 'text',
        value: content.slice(lastIndex, matchStart),
      });
    }
    
    // Add library reference (decode path for display)
    segments.push({
      type: 'library-path',
      value: decodeLibraryPath(match[0]),
      path: decodeLibraryPath(match[1]),
    });
    
    lastIndex = matchEnd;
  }
  
  // Add remaining text
  if (lastIndex < content.length) {
    segments.push({
      type: 'text',
      value: content.slice(lastIndex),
    });
  }
  
  return segments;
}

/**
 * Encode a library path for use in mentions
 * Encodes spaces and special characters that would break parsing
 */
export function encodeLibraryPath(path: string): string {
  return path
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/');
}

/**
 * Decode a library path for display
 * Decodes URL-encoded characters back to readable form
 */
export function decodeLibraryPath(path: string): string {
  try {
    return decodeURIComponent(path);
  } catch {
    return path; // Return as-is if decoding fails
  }
}

/**
 * Format a library path with the standard @library/ prefix
 * Encodes spaces and special characters for reliable parsing
 */
export function formatLibraryPath(path: string): string {
  // Remove leading slash if present
  const cleanPath = path.replace(/^\/+/, '');
  // Encode the path to handle spaces and special characters
  return `@library/${encodeLibraryPath(cleanPath)}`;
}
