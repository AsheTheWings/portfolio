import { ChessRoutePage } from '../ChessRoutePage';

type ChessGamePageProps = {
  params: Promise<{ gameId: string }>;
};

export default async function ChessGamePage({ params }: ChessGamePageProps) {
  const { gameId } = await params;
  return <ChessRoutePage gameId={gameId} routeFamily="standalone" variant="standalone" />;
}
