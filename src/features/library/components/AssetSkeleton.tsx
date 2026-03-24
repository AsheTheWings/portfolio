'use client';

import { Skeleton } from '@/features/shared/components/shadcn/skeleton';

export function AssetSkeleton() {
  return (
    <div className="aspect-square rounded-lg overflow-hidden bg-surface-1 border border-border-subtle">
      <Skeleton className="w-full h-full" />
    </div>
  );
}

export default AssetSkeleton;
