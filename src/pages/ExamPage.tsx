import { useCallback, useEffect } from 'react';
import { ErrorNote, Loading } from '../components/common/ui';
import { ExamScreen } from '../components/exam/ExamScreen';
import { loadAttempt } from '../data/attemptStore';
import { loadSettings } from '../data/settings';
import { useAsync } from '../lib/useAsync';
import { navigate } from '../router';

export function ExamPage({ attemptId }: { attemptId: string }) {
  const { data, error } = useAsync(
    async () => ({ loaded: await loadAttempt(attemptId), settings: await loadSettings() }),
    [attemptId],
  );
  const finished = useCallback((id: string) => navigate(`/result/${id}`), []);

  const alreadySubmitted = data?.loaded.attempt.status === 'submitted';
  useEffect(() => {
    if (alreadySubmitted) navigate(`/result/${attemptId}`);
  }, [alreadySubmitted, attemptId]);

  if (error) return <ErrorNote error={error} />;
  if (!data || alreadySubmitted) return <Loading label="Opening your test…" />;
  return <ExamScreen key={attemptId} loaded={data.loaded} settings={data.settings} onFinished={finished} />;
}
