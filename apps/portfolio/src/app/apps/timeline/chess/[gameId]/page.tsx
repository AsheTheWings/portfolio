import { ChessRoutePage } from '../../../chess/ChessRoutePage';

type TimelineChessGamePageProps = {
  params: Promise<{ gameId: string }>;
};

export default async function TimelineChessGamePage({ params }: TimelineChessGamePageProps) {
  const { gameId } = await params;
  return <ChessRoutePage gameId={gameId} routeFamily="timeline" variant="timeline-embedded" />;
}
