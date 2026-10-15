import { CbtAttemptPlayer } from './cbt-attempt-player';

export default async function AttemptPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  return <CbtAttemptPlayer attemptId={attemptId} />;
}
