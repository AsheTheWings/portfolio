/**
 * Library Page — Server Component (thin wrapper)
 *
 * Auth is enforced by middleware (JWT cookie gate).
 * Folder & asset data is fetched client-side via SWR hooks.
 * The ?path= query param is forwarded for client-side deep-link resolution.
 */

import { Library } from '@portfolio/timeline/library/components/Library';
import { verifyToken } from '@portfolio/auth/lib/cookies';
import { AuthHydrator } from '@portfolio/auth/components/AuthHydrator';

interface LibraryPageProps {
  searchParams: Promise<{ path?: string }>;
}

export default async function LibraryPage({ searchParams }: LibraryPageProps) {
  const params = await searchParams;
  const payload = await verifyToken();
  const initialUser = payload ? { id: payload.userId, username: payload.username } : null;

  return (
    <AuthHydrator initialUser={initialUser}>
      <Library initialPath={params.path} />
    </AuthHydrator>
  );
}
