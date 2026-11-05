import type { ReactNode } from 'react';
import type { Route } from '../../router';

const LINKS: { href: string; label: string; names: Route['name'][] }[] = [
  { href: '#/', label: 'Mocks', names: ['mocks', 'history', 'result'] },
  { href: '#/drill', label: 'Topic Drill', names: ['drill'] },
  { href: '#/dashboard', label: 'Dashboard', names: ['dashboard'] },
  { href: '#/revision', label: 'Revision', names: ['revision'] },
  { href: '#/settings', label: 'Settings', names: ['settings'] },
];

interface Props {
  route: Route['name'];
  actions?: ReactNode;
  children: ReactNode;
}

export function AppShell({ route, actions, children }: Props) {
  return (
    <div className="flex h-full flex-col">
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-navy-deep bg-navy px-4 text-white">
        <a href="#/" className="text-[15px] font-bold">
          RRB PO Prelims
        </a>
        <nav aria-label="Main" className="flex h-full items-stretch gap-5">
          {LINKS.map((l) => {
            const active = l.names.includes(route);
            return (
              <a
                key={l.href}
                href={l.href}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center border-b-2 text-xs font-semibold ${active ? 'border-white text-white' : 'border-transparent text-[#b9cce6] hover:text-white'}`}
              >
                {l.label}
              </a>
            );
          })}
        </nav>
        <div className="flex min-w-32 justify-end">{actions}</div>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
