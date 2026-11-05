import { useRef, useState } from 'react';
import { ImportRejected, importBundleText, type ImportReport } from '../../data/mockStore';
import { Button, Modal } from './ui';

const MAX_SHOWN = 30;

type Outcome = { kind: 'ok'; report: ImportReport } | { kind: 'rejected'; name: string; errors: string[] };

export function ImportJsonButton({ onImported }: { onImported: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  async function onFile(file: File) {
    try {
      const report = await importBundleText(await file.text());
      setOutcome({ kind: 'ok', report });
      if (report.added.length > 0) onImported();
    } catch (e) {
      const errors = e instanceof ImportRejected ? e.errors : [(e as Error).message];
      setOutcome({ kind: 'rejected', name: file.name, errors });
    }
  }

  return (
    <>
      <Button variant="ghost" onClick={() => input.current?.click()}>
        Import JSON
      </Button>
      <input
        ref={input}
        type="file"
        accept="application/json,.json"
        aria-label="Import mocks from a JSON file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void onFile(file);
        }}
      />
      {outcome && (
        <Modal
          title={outcome.kind === 'ok' ? 'Import finished' : 'Import rejected'}
          onClose={() => setOutcome(null)}
          footer={
            <Button variant="primary" onClick={() => setOutcome(null)}>
              Close
            </Button>
          }
        >
          {outcome.kind === 'ok' ? (
            <ImportSummary report={outcome.report} />
          ) : (
            <ImportErrors name={outcome.name} errors={outcome.errors} />
          )}
        </Modal>
      )}
    </>
  );
}

function ImportSummary({ report }: { report: ImportReport }) {
  return (
    <div className="space-y-2 text-sm">
      <p>
        {report.added.length > 0
          ? `Added ${report.added.length} mock${report.added.length === 1 ? '' : 's'}: ${report.added.join(', ')}.`
          : 'No new mocks were added.'}
      </p>
      {report.skipped.length > 0 && (
        <p className="text-ink-2">Already in your library, so left unchanged: {report.skipped.join(', ')}.</p>
      )}
      {report.warnings.map((w) => (
        <p key={w} className="text-amber">
          {w}
        </p>
      ))}
    </div>
  );
}

function ImportErrors({ name, errors }: { name: string; errors: string[] }) {
  return (
    <div className="text-sm">
      <p className="mb-2">
        Nothing from <strong>{name}</strong> was imported. Fix {errors.length === 1 ? 'this problem' : `these ${errors.length} problems`} and
        try again:
      </p>
      <ul className="list-disc space-y-1 pl-5 font-mono text-xs">
        {errors.slice(0, MAX_SHOWN).map((err, i) => (
          <li key={i}>{err}</li>
        ))}
      </ul>
      {errors.length > MAX_SHOWN && <p className="mt-2 text-ink-3">…and {errors.length - MAX_SHOWN} more.</p>}
    </div>
  );
}
