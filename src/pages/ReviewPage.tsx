import { useEffect } from 'react';
import { ErrorNote, Loading } from '../components/common/ui';
import { ReviewScreen } from '../components/review/ReviewScreen';
import { loadAttempt } from '../data/attemptStore';
import { loadBookmarks } from '../data/bookmarks';
import { useAsync } from '../lib/useAsync';
import { navigate } from '../router';

export function ReviewPage({ attemptId, qid }: { attemptId: string; qid: string | null }) {
  const { data, error } = useAsync(
    async () => ({ loaded: await loadAttempt(attemptId), bookmarks: await loadBookmarks() }),
    [attemptId],
  );

  // An unfinished paper must not reveal its answers.
  const stillOpen = data?.loaded.attempt.status === 'in_progress';
  useEffect(() => {
    if (stillOpen) navigate(`/exam/${attemptId}`);
  }, [stillOpen, attemptId]);

  if (error) return <ErrorNote error={error} />;
  if (!data || stillOpen) return <Loading label="Opening solutions…" />;
  return (
    <ReviewScreen
      key={`${attemptId}/${qid ?? ''}`}
      loaded={data.loaded}
      initialBookmarks={data.bookmarks}
      initialQid={qid}
    />
  );
}
