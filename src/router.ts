import { useEffect, useState } from 'react';

/** Hash routes work from any install path and offline, with no server rewrite rules. */
export type Route =
  | { name: 'mocks' }
  | { name: 'exam'; attemptId: string }
  | { name: 'result'; attemptId: string }
  | { name: 'review'; attemptId: string; qid: string | null }
  | { name: 'history'; mockNo: number }
  | { name: 'drill' }
  | { name: 'dashboard' }
  | { name: 'revision' }
  | { name: 'settings' };

export function parseHash(hash: string): Route {
  const [head, arg, extra] = hash.replace(/^#\/?/, '').split('/');
  switch (head) {
    case 'exam':
      return arg ? { name: 'exam', attemptId: arg } : { name: 'mocks' };
    case 'result':
      return arg ? { name: 'result', attemptId: arg } : { name: 'mocks' };
    case 'review':
      return arg ? { name: 'review', attemptId: arg, qid: extra ?? null } : { name: 'mocks' };
    case 'history':
      return Number(arg) > 0 ? { name: 'history', mockNo: Number(arg) } : { name: 'mocks' };
    case 'drill':
      return { name: 'drill' };
    case 'dashboard':
      return { name: 'dashboard' };
    case 'revision':
      return { name: 'revision' };
    case 'settings':
      return { name: 'settings' };
    default:
      return { name: 'mocks' };
  }
}

export function navigate(path: string): void {
  window.location.hash = path;
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
