/**
 * Color utilities for agent UI components
 */

/**
 * Returns true if a hex color is perceptually light (luminance > 0.6).
 * Used to pick contrasting text color for avatar initials, badges, etc.
 */
export function isLightColor(hex: string): boolean {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
}
