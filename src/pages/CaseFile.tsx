import { useParams } from 'react-router-dom';
import { useState } from 'react';
import { api, WATERMARK } from '../lib/api';
import ErrorBanner from '../components/ErrorBanner';
import Watermark from '../components/Watermark';
import Loading from '../components/Loading';

export default function CaseFile() {
  const { code = '142' } = useParams();
  const [caseFile, setCaseFile] = useState<Record<string, unknown> | null>(null);
  const [caseId, setCaseId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async (format: 'json' | 'csv' = 'json') => {
    setLoading(true);
    setError(null);
    try {
      if (format === 'csv') {
        const token = localStorage.getItem('verity_x_token');
        const res = await fetch('/api/cases', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ project_code: code, as_of_day: 47, format: 'csv' }),
        });
        const text = await res.text();
        const blob = new Blob([text], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `verity-x-case-${code}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const r = await api<{ case_id: number; case_file: Record<string, unknown> }>('/api/cases', {
          method: 'POST',
          body: JSON.stringify({ project_code: code, as_of_day: 47, format: 'json' }),
        });
        setCaseId(r.case_id);
        setCaseFile(r.case_file);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setLoading(false);
    }
  };

  const downloadJson = () => {
    if (!caseFile) return;
    const blob = new Blob([JSON.stringify(caseFile, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `verity-x-case-${code}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printPdf = () => window.print();

  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <div className="text-[10px] uppercase tracking-wider text-stone-500">Auditable Case File</div>
        <h1 className="text-lg font-semibold">Export · Project #{code}</h1>
        <p className="text-[13px] text-stone-500 mt-1">
          Structured case file with limitations, synthetic disclaimer, and full evidence traceability.
        </p>
      </div>
      <Watermark />
      {error && <ErrorBanner message={error} />}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => generate('json')}
          disabled={loading}
          className="bg-stone-100 text-stone-900 text-sm px-3 py-1.5 rounded-sm hover:bg-white disabled:opacity-50"
        >
          Generate case file
        </button>
        <button
          type="button"
          onClick={() => generate('csv')}
          disabled={loading}
          className="border border-stone-600 text-sm px-3 py-1.5 rounded-sm hover:bg-stone-800 disabled:opacity-50"
        >
          Export CSV
        </button>
        {caseFile && (
          <>
            <button type="button" onClick={downloadJson} className="border border-stone-600 text-sm px-3 py-1.5 rounded-sm">
              Download JSON
            </button>
            <button type="button" onClick={printPdf} className="border border-stone-600 text-sm px-3 py-1.5 rounded-sm">
              Print / PDF
            </button>
          </>
        )}
      </div>

      {loading && <Loading label="Compiling case file…" />}

      {caseFile && (
        <div className="border border-stone-800 p-4 rounded-sm space-y-3 print:text-black print:bg-white" id="case-print">
          <div className="text-[11px] text-stone-500">Case ID {caseId}</div>
          <h2 className="text-base font-semibold">{String(caseFile.title)}</h2>
          <p className="text-[12px] text-amber-200/70 border border-amber-900/40 px-2 py-1">{WATERMARK}</p>
          <div>
            <div className="text-[11px] uppercase text-stone-500">Limitations</div>
            <ul className="list-disc list-inside text-[12px] text-stone-400">
              {(caseFile.limitations as string[]).map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[13px]">
            <div>Investigation risk: <strong>{String(caseFile.investigation_risk)}</strong></div>
            <div>As-of day: {String(caseFile.as_of_day)}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase text-stone-500 mb-1">Integrity drift</div>
            <pre className="text-[11px] bg-stone-950 p-2 overflow-auto max-h-40 text-stone-400">
              {JSON.stringify(caseFile.integrity_drift, null, 2)}
            </pre>
          </div>
          <div>
            <div className="text-[11px] uppercase text-stone-500 mb-1">Contradictions</div>
            <pre className="text-[11px] bg-stone-950 p-2 overflow-auto max-h-40 text-stone-400">
              {JSON.stringify(caseFile.contradictions, null, 2)}
            </pre>
          </div>
          <div>
            <div className="text-[11px] uppercase text-stone-500 mb-1">Hypotheses</div>
            <pre className="text-[11px] bg-stone-950 p-2 overflow-auto max-h-48 text-stone-400">
              {JSON.stringify(caseFile.hypotheses, null, 2)}
            </pre>
          </div>
          <div>
            <div className="text-[11px] uppercase text-stone-500 mb-1">Minimum Verification Set</div>
            <pre className="text-[11px] bg-stone-950 p-2 overflow-auto max-h-40 text-stone-400">
              {JSON.stringify(caseFile.minimum_verification_set, null, 2)}
            </pre>
          </div>
          <div>
            <div className="text-[11px] uppercase text-stone-500 mb-1">Decision-aware replay</div>
            <pre className="text-[11px] bg-stone-950 p-2 overflow-auto max-h-40 text-stone-400">
              {JSON.stringify(caseFile.decision_aware_replay, null, 2)}
            </pre>
          </div>
          <p className="text-[12px] text-stone-500">{String(caseFile.recommendation)}</p>
          <p className="text-[11px] text-stone-600">{String(caseFile.traceability_note)}</p>
        </div>
      )}
    </div>
  );
}
