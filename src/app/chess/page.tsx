import { ChessGameShell } from '@/features/chess';
import { verifyToken } from '@/features/authentication/lib/cookies';

export default async function ChessPage() {
  const payload = await verifyToken();
  const initialUser = payload ? { id: payload.userId, username: payload.username } : null;

  return <ChessGameShell initialUser={initialUser} />;
}
