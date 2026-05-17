import { ChessGameShell } from '@portfolio/chess';
import { verifyToken } from '@portfolio/auth/lib/cookies';

export default async function TimelineChessPage() {
  const payload = await verifyToken();
  const initialUser = payload ? { id: payload.userId, username: payload.username } : null;

  return <ChessGameShell initialUser={initialUser} variant="timeline-embedded" />;
}
