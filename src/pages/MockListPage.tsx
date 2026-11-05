import { useState } from 'react';
import { AppShell } from '../components/common/AppShell';
import { ImportJsonButton } from '../components/common/ImportJsonButton';
import { Button, ErrorNote, Loading, Modal } from '../components/common/ui';
import { MockCard } from '../components/MockCard';
import { createMockAttempt, discardAttempt, mockStats } from '../data/attemptStore';
import { db } from '../data/db';
import { useSettings } from '../data/settings';
import { useAsync } from '../lib/useAsync';
import { navigate } from '../router';

export function MockListPage() {
  const [settings] = useSettings();
  const { data, error, reload } = useAsync(
    async () => ({
      mocks: await db.mocks.orderBy('mock_no').toArray(),
      stats: await mockStats(),
    }),
    [],
  );
  const [pendingRestart, setPendingRestart] = useState<string | null>(null);

  return (
    <AppShell route="mocks" actions={<ImportJsonButton onImported={reload} />}>
      {error && <ErrorNote error={error} />}
      {(!data || !settings) && !error && <Loading label="Loading your mocks…" />}
      {data && settings && (
        <>
          <div className="flex h-8 items-center gap-4 border-b border-line bg-[#f1f4fa] px-4 text-xs">
            <span className="font-bold">{data.mocks.length} mocks</span>
            <span className="text-ink-2">80 questions · Reasoning 25 min, then Quantitative Aptitude 20 min · +1 / −0.25</span>
          </div>
          <div className="mx-auto grid max-w-[1240px] grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
            {data.mocks.map((mock) => {
              const stats = data.stats.get(mock.mock_no);
              return (
                <MockCard
                  key={mock.mock_no}
                  mock={mock}
                  stats={stats}
                  cutOff={settings.cutOff}
                  onStart={() => void createMockAttempt(mock.mock_no).then((id) => navigate(`/exam/${id}`))}
                  onResume={(id) => navigate(`/exam/${id}`)}
                  onRestart={setPendingRestart}
                  onReview={() => navigate(`/history/${mock.mock_no}`)}
                />
              );
            })}
          </div>
        </>
      )}
      {pendingRestart && (
        <Modal
          title="Start this mock over?"
          onClose={() => setPendingRestart(null)}
          footer={
            <>
              <Button onClick={() => setPendingRestart(null)}>Keep my attempt</Button>
              <Button
                variant="danger"
                onClick={() => {
                  const id = pendingRestart;
                  setPendingRestart(null);
                  void discardAttempt(id).then(reload);
                }}
              >
                Discard and start over
              </Button>
            </>
          }
        >
          <p className="text-sm">Your answers and remaining time in the unfinished attempt will be deleted.</p>
        </Modal>
      )}
    </AppShell>
  );
}
