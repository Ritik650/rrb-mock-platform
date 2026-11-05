import { useRef, useState, type ReactNode } from 'react';
import { AppShell } from '../components/common/AppShell';
import { Button, Loading, SectionTitle } from '../components/common/ui';
import { exportBackup, parseBackup, restoreBackup } from '../data/backup';
import { useSettings } from '../data/settings';

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex items-center justify-between gap-4 border-b border-line px-3 py-2 last:border-b-0">
      <span className="text-[13px]">
        <span className="font-medium">{label}</span>
        {hint && <span className="block text-xs text-ink-2">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

const fieldClass = 'h-8 border border-ink-3 px-2 text-[13px]';

async function downloadBackup(): Promise<void> {
  const backup = await exportBackup();
  const url = URL.createObjectURL(new Blob([JSON.stringify(backup)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `rrb-po-attempts-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function SettingsPage() {
  const [settings, update] = useSettings();
  const [cutOffText, setCutOffText] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; lines: string[] } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function onBackupFile(file: File) {
    const parsed = parseBackup(await file.text());
    if (!parsed.ok) {
      setMessage({ ok: false, lines: parsed.errors });
      return;
    }
    const report = await restoreBackup(parsed.backup);
    setMessage({
      ok: true,
      lines: [
        `Restored ${report.added} attempt${report.added === 1 ? '' : 's'} and ${report.bookmarksAdded} bookmark${report.bookmarksAdded === 1 ? '' : 's'}.`,
        ...(report.skipped > 0 ? [`${report.skipped} already here, so left unchanged.`] : []),
      ],
    });
  }

  return (
    <AppShell route="settings">
      {!settings && <Loading />}
      {settings && (
        <div className="mx-auto max-w-2xl space-y-4 p-4">
          <h1 className="text-lg font-bold text-navy">Settings</h1>
          <section className="border border-line bg-white">
            <Row label="Candidate name">
              <input
                className={`${fieldClass} w-48`}
                value={settings.candidateName}
                onChange={(e) => update({ candidateName: e.target.value })}
              />
            </Row>
            <Row label="Cut-off target" hint="Your scores are compared against this mark.">
              <input
                type="number"
                step={0.25}
                min={0}
                className={`${fieldClass} w-24 tabular-nums`}
                value={cutOffText ?? settings.cutOff}
                onChange={(e) => {
                  setCutOffText(e.target.value);
                  const n = Number(e.target.value);
                  if (e.target.value !== '' && Number.isFinite(n) && n >= 0) update({ cutOff: n });
                }}
                onBlur={() => setCutOffText(null)}
              />
            </Row>
            <Row label="Beep at 1:00 left">
              <input
                type="checkbox"
                className="h-4 w-4 accent-action"
                checked={settings.beepEnabled}
                onChange={(e) => update({ beepEnabled: e.target.checked })}
              />
            </Row>
            <Row label="Practice mode: allow pausing" hint="Adds a Pause button to tests. The real exam has none.">
              <input
                type="checkbox"
                className="h-4 w-4 accent-action"
                checked={settings.allowPause}
                onChange={(e) => update({ allowPause: e.target.checked })}
              />
            </Row>
          </section>

          <section>
            <SectionTitle>Backup</SectionTitle>
            <div className="border border-line bg-white p-3">
              <p className="mb-2 text-[13px] text-ink-2">
                Your attempts live only in this browser. Export them as a JSON file to keep a copy, and import that file
                to bring them back. It covers attempts, answers, time logs and bookmarks.
              </p>
              <div className="flex gap-2">
                <Button variant="primary" onClick={() => void downloadBackup()}>
                  Export attempts
                </Button>
                <Button onClick={() => fileInput.current?.click()}>Import attempts</Button>
                <input
                  ref={fileInput}
                  type="file"
                  accept="application/json,.json"
                  aria-label="Import attempts from a backup file"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (file) void onBackupFile(file);
                  }}
                />
              </div>
              {message && (
                <div role="status" className={`mt-2 border px-2 py-1 text-[13px] ${message.ok ? 'border-ans-deep' : 'border-nans'}`}>
                  {message.lines.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}
