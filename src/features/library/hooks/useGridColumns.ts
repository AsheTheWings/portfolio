'use client';

import { useState, useEffect } from 'react';

/**
 * Grid column breakpoints matching Tailwind config:
 * - default: 2 cols
 * - md (768px): 4 cols
 * - lg (1024px): 5 cols
 * - xl (1280px): 6 cols
 * - 2xl (1536px): 8 cols
 */
const BREAKPOINTS = [
  { minWidth: 1536, cols: 8 },  // 2xl
  { minWidth: 1280, cols: 6 },  // xl
  { minWidth: 1024, cols: 5 },  // lg
  { minWidth: 768, cols: 4 },   // md
  { minWidth: 0, cols: 2 },     // default
] as const;

const ROWS_PER_PAGE = 7;

function getColumnsForWidth(width: number): number {
  for (const bp of BREAKPOINTS) {
    if (width >= bp.minWidth) {
      return bp.cols;
    }
  }
  return 2;
}

/**
 * Hook that returns current grid columns and itemsPerPage based on window width
 */
export function useGridColumns() {
  const [columns, setColumns] = useState(8); // Default to largest for SSR

  useEffect(() => {
    const updateColumns = () => {
      setColumns(getColumnsForWidth(window.innerWidth));
    };

    // Set initial value
    updateColumns();

    // Listen for resize
    window.addEventListener('resize', updateColumns);
    return () => window.removeEventListener('resize', updateColumns);
  }, []);

  return {
    columns,
    itemsPerPage: columns * ROWS_PER_PAGE,
  };
}
