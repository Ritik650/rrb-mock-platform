import { ErrorNote, Loading } from './components/common/ui';
import { ensureSeeded } from './data/mockStore';
import { useAsync } from './lib/useAsync';
import { DashboardPage } from './pages/DashboardPage';
import { DrillPage } from './pages/DrillPage';
import { ExamPage } from './pages/ExamPage';
import { HistoryPage } from './pages/HistoryPage';
import { MockListPage } from './pages/MockListPage';
import { ResultPage } from './pages/ResultPage';
import { ReviewPage } from './pages/ReviewPage';
import { RevisionPage } from './pages/RevisionPage';
import { SettingsPage } from './pages/SettingsPage';
import { useRoute } from './router';

export function App() {
  const route = useRoute();
  const seed = useAsync(() => ensureSeeded().then(() => true), []);

  if (seed.error) return <ErrorNote error={seed.error} />;
  if (!seed.data) return <Loading label="Preparing the question bank…" />;

  switch (route.name) {
    case 'exam':
      return <ExamPage attemptId={route.attemptId} />;
    case 'result':
      return <ResultPage attemptId={route.attemptId} />;
    case 'review':
      return <ReviewPage attemptId={route.attemptId} qid={route.qid} />;
    case 'history':
      return <HistoryPage mockNo={route.mockNo} />;
    case 'drill':
      return <DrillPage />;
    case 'dashboard':
      return <DashboardPage />;
    case 'revision':
      return <RevisionPage />;
    case 'settings':
      return <SettingsPage />;
    default:
      return <MockListPage />;
  }
}
