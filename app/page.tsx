'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Company } from '@/lib/companies';

type RunStatus = 'pending' | 'running' | 'success' | 'error';

type CompanyState = Company & {
  status: RunStatus;
  inserted: number;
  error?: string | null;
};

const statusHue: Record<RunStatus, string> = {
  pending: 'rgba(255,255,255,0.08)',
  running: '#ffc861',
  success: '#4cd964',
  error: '#ff5e57'
};

export default function Home() {
  const [companies, setCompanies] = useState<CompanyState[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloadReady, setDownloadReady] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [rowsCount, setRowsCount] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [runSchemas, setRunSchemas] = useState<string[]>([]);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const res = await fetch('/api/companies');
        const data = await res.json();
        const scoped = (data.companies as Company[]).map((c) => ({
          ...c,
          status: 'pending' as RunStatus,
          inserted: 0,
          error: null
        }));
        setCompanies(scoped);
      } catch (err) {
        setStatusMessage('Unable to load companies. Refresh to try again.');
      }
    };
    bootstrap();
  }, []);

  const activeSelection = useCallback(
    (limit?: number) =>
      typeof limit === 'number' ? companies.slice(0, limit) : companies,
    [companies]
  );

  const scopedCompanies = useMemo(
    () => companies.filter((c) => runSchemas.includes(c.schema)),
    [companies, runSchemas]
  );
  const completed = useMemo(
    () => scopedCompanies.filter((c) => c.status === 'success').length,
    [scopedCompanies]
  );
  const running = useMemo(
    () => scopedCompanies.filter((c) => c.status === 'running').length,
    [scopedCompanies]
  );
  const progress = useMemo(() => {
    const total = scopedCompanies.length || 1;
    return Math.round((completed / total) * 100);
  }, [scopedCompanies.length, completed]);

  const refreshCount = useCallback(async () => {
    const res = await fetch('/api/status');
    const data = await res.json();
    setRowsCount(data.count || 0);
  }, []);

  const updateCompany = useCallback(
    (schema: string, updates: Partial<CompanyState>) => {
      setCompanies((prev) =>
        prev.map((c) => (c.schema === schema ? { ...c, ...updates } : c))
      );
    },
    []
  );

  const resetStatuses = useCallback(
    (targetSchemas: string[]) => {
      setCompanies((prev) =>
        prev.map((c) =>
          targetSchemas.includes(c.schema)
            ? { ...c, status: 'pending', inserted: 0, error: null }
            : c
        )
      );
    },
    []
  );

  const runSequence = useCallback(
    async (limit?: number) => {
      if (!companies.length || loading) return;

      const targets = activeSelection(limit);
      const targetSchemas = targets.map((c) => c.schema);
      setRunSchemas(targetSchemas);
      setShowModal(true);
      setDownloadReady(false);
      setStatusMessage(null);
      setRowsCount(0);
      resetStatuses(targetSchemas);
      setLoading(true);

      await fetch('/api/reset', { method: 'POST' });

      for (let index = 0; index < targets.length; index += 1) {
        const company = targets[index];
        updateCompany(company.schema, { status: 'running', error: null });

        try {
          const res = await fetch('/api/run-company', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              schema: company.schema,
              truncate: index === 0
            })
          });

          if (!res.ok) {
            const data = await res.json();
            const message = data?.error || 'Request failed';
            updateCompany(company.schema, {
              status: 'error',
              error: message
            });
            continue;
          }

          const data = await res.json();
          updateCompany(company.schema, {
            status: 'success',
            inserted: data.inserted || 0
          });
          await refreshCount();
        } catch (err) {
          updateCompany(company.schema, {
            status: 'error',
            error: err instanceof Error ? err.message : 'Unexpected error'
          });
        }
      }

      setLoading(false);
      setDownloadReady(true);
      setStatusMessage('Run completed. Export is ready.');
    },
    [activeSelection, companies.length, loading, refreshCount, resetStatuses, updateCompany]
  );

  const downloadCsv = useCallback(async () => {
    const res = await fetch('/api/export');
    if (!res.ok) {
      setStatusMessage('Export failed. Check server logs.');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'machine-data.csv';
    link.click();
    URL.revokeObjectURL(url);
  }, []);

  return (
    <main className="page">
      <div className="card">
        <div className="header">
          <div>
            <p className="eyebrow">Jetline BMS collector</p>
            <h1>Machine data load</h1>
            <p className="lede">
              Iterate through every active entity, pull the meter data into SQLite, and export a
              fresh CSV. Authentication lives on the server only.
            </p>
          </div>
          <div className="stat">
            <p className="eyebrow">Rows cached</p>
            <p className="stat-value">{rowsCount.toLocaleString()}</p>
          </div>
        </div>

        <div className="controls">
          <button
            className="action primary"
            disabled={loading || !companies.length}
            onClick={() => runSequence()}
          >
            {loading ? 'Running...' : 'Run all entities'}
          </button>
          <button
            className="action ghost"
            disabled={loading || !companies.length}
            onClick={() => runSequence(2)}
          >
            Quick test (first 2)
          </button>
          <button
            className="action ghost"
            disabled={!downloadReady || loading}
            onClick={downloadCsv}
          >
            Download CSV
          </button>
        </div>

        {statusMessage && <div className="callout">{statusMessage}</div>}

        <div className="list">
          {companies.map((company) => (
            <div key={company.schema} className="pill" style={{ borderColor: statusHue[company.status] }}>
              <span className="dot" style={{ background: statusHue[company.status] }} />
              <div className="pill-body">
                <div className="pill-title">
                  <strong>{company.name}</strong>
                  <span className="muted">{company.schema}</span>
                </div>
                {company.error ? (
                  <span className="err">{company.error}</span>
                ) : (
                  <span className="muted">Inserted {company.inserted}</span>
                )}
              </div>
              <span className="badge">{company.status}</span>
            </div>
          ))}
        </div>
      </div>

      {showModal && (
        <div className="overlay">
          <div className="modal">
            <div className="modal-head">
              <div>
                <p className="eyebrow">Progress</p>
                <h2>Loading entities</h2>
              </div>
              <button className="action text" onClick={() => setShowModal(false)}>
                Hide
              </button>
            </div>
            <div className="progress">
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${progress}%` }} />
              </div>
              <div className="progress-meta">
                <span>{progress}% complete</span>
                <span>
                  {completed} done / {running} running / {scopedCompanies.length} total
                </span>
              </div>
            </div>
            <div className="grid">
              {scopedCompanies.map((company) => (
                <button
                  key={company.schema}
                  className="grid-item"
                  style={{ borderColor: statusHue[company.status] }}
                >
                  <span className="dot" style={{ background: statusHue[company.status] }} />
                  <div>
                    <strong>{company.name}</strong>
                    <p className="muted">{company.schema}</p>
                  </div>
                  <span className="badge">{company.status}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .page {
          min-height: 100vh;
          padding: 48px;
          display: flex;
          align-items: flex-start;
          justify-content: center;
        }
        .card {
          width: min(1200px, 100%);
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.02), rgba(102, 224, 255, 0.03))
            var(--card);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 32px;
          box-shadow: 0 40px 120px rgba(0, 0, 0, 0.35);
        }
        .header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 24px;
        }
        h1 {
          margin: 4px 0;
          font-size: 32px;
          letter-spacing: -0.02em;
        }
        .lede {
          margin: 4px 0 0;
          color: var(--muted);
          max-width: 640px;
        }
        .mono {
          font-family: 'SFMono-Regular', Consolas, monospace;
          background: rgba(255, 255, 255, 0.06);
          padding: 2px 6px;
          border-radius: 6px;
        }
        .stat {
          min-width: 160px;
          padding: 12px 16px;
          border-radius: 12px;
          border: 1px solid var(--border);
          background: var(--panel);
          text-align: right;
        }
        .stat-value {
          margin: 4px 0 0;
          font-size: 24px;
          font-weight: 700;
        }
        .eyebrow {
          margin: 0;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-size: 11px;
          color: var(--muted);
        }
        .controls {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin: 24px 0;
        }
        .action {
          border: 1px solid var(--border);
          background: transparent;
          color: var(--text);
          padding: 12px 16px;
          border-radius: 10px;
          cursor: pointer;
          transition: transform 0.08s ease, border-color 0.2s ease, background 0.2s ease;
        }
        .action:hover:not(:disabled) {
          transform: translateY(-1px);
          border-color: rgba(255, 255, 255, 0.16);
          background: rgba(255, 255, 255, 0.02);
        }
        .action:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .action.primary {
          background: linear-gradient(120deg, #66e0ff, #4cd964);
          color: #05141b;
          border: none;
          font-weight: 700;
        }
        .action.ghost {
          border-color: rgba(255, 255, 255, 0.16);
        }
        .action.text {
          padding: 8px 12px;
          border: none;
          color: var(--muted);
        }
        .callout {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 12px 14px;
          color: var(--muted);
          margin-bottom: 12px;
        }
        .list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .pill {
          display: flex;
          gap: 12px;
          align-items: center;
          border: 1px solid var(--border);
          background: var(--panel);
          border-radius: 12px;
          padding: 12px 14px;
        }
        .pill-body {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .pill-title {
          display: flex;
          gap: 8px;
          align-items: baseline;
        }
        .muted {
          color: var(--muted);
          font-size: 13px;
        }
        .err {
          color: #ff7b7b;
          font-size: 13px;
        }
        .dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
        }
        .badge {
          padding: 6px 10px;
          border-radius: 999px;
          border: 1px solid var(--border);
          text-transform: uppercase;
          font-size: 11px;
          letter-spacing: 0.06em;
          color: var(--muted);
        }
        .overlay {
          position: fixed;
          inset: 0;
          background: rgba(5, 6, 10, 0.75);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          z-index: 10;
        }
        .modal {
          width: min(1100px, 100%);
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 20px;
          box-shadow: 0 24px 80px rgba(0, 0, 0, 0.4);
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .modal-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        h2 {
          margin: 4px 0 0;
        }
        .progress {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .progress-bar {
          width: 100%;
          height: 12px;
          background: rgba(255, 255, 255, 0.04);
          border-radius: 999px;
          overflow: hidden;
          border: 1px solid var(--border);
        }
        .progress-fill {
          height: 100%;
          background: linear-gradient(120deg, #66e0ff, #4cd964);
          width: 0;
          transition: width 0.2s ease;
        }
        .progress-meta {
          display: flex;
          justify-content: space-between;
          color: var(--muted);
          font-size: 13px;
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 10px;
        }
        .grid-item {
          border: 1px solid var(--border);
          background: var(--panel);
          padding: 12px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          gap: 10px;
          color: var(--text);
          cursor: default;
        }
        @media (max-width: 768px) {
          .page {
            padding: 16px;
          }
          .header {
            flex-direction: column;
          }
          .pill {
            flex-direction: column;
            align-items: flex-start;
          }
          .progress-meta {
            flex-direction: column;
            gap: 6px;
          }
        }
      `}</style>
    </main>
  );
}
