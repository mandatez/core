'use client';

import { useState } from 'react';

type ReportType = 'owasp' | 'eu-ai-act' | 'hipaa';

interface ReportCard {
  id: ReportType;
  title: string;
  subtitle: string;
  description: string;
  color: string;
  accent: string;
}

const REPORTS: ReportCard[] = [
  {
    id: 'owasp',
    title: 'OWASP Agentic Top 10',
    subtitle: '2025 AI agent security standard',
    description:
      'Prove compliance with the 2025 OWASP AI agent security standard. Maps every ASI-01 through ASI-10 risk to MandateZ controls.',
    color: 'border-blue-800',
    accent: 'text-blue-400',
  },
  {
    id: 'eu-ai-act',
    title: 'EU AI Act',
    subtitle: 'August 2026 enforcement',
    description:
      'Document compliance with August 2026 enforcement requirements. Articles 9, 12, 13, 14 mapped to signed audit trail and oversight gates.',
    color: 'border-emerald-800',
    accent: 'text-emerald-400',
  },
  {
    id: 'hipaa',
    title: 'HIPAA AI Addendum',
    subtitle: 'Healthcare AI agents',
    description:
      'Audit trail for healthcare AI agents. Maps 164.308 and 164.312 safeguards to Ed25519-signed event records and policy enforcement.',
    color: 'border-purple-800',
    accent: 'text-purple-400',
  },
];

export function ReportsClient() {
  const [ownerId, setOwnerId] = useState('');
  const [generating, setGenerating] = useState<ReportType | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate(reportType: ReportType) {
    setError(null);

    if (!ownerId.trim()) {
      setError('Please enter an owner_id first');
      return;
    }

    setGenerating(reportType);

    try {
      const response = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ owner_id: ownerId.trim(), report_type: reportType }),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(errBody.error ?? `HTTP ${response.status}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mandatez-${reportType}-report.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate report');
    } finally {
      setGenerating(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Owner ID input */}
      <div className="border border-gray-800 rounded-lg p-5">
        <label htmlFor="owner-id" className="block text-sm font-medium text-gray-200 mb-2">
          Owner ID
        </label>
        <input
          id="owner-id"
          type="text"
          value={ownerId}
          onChange={(e) => setOwnerId(e.target.value)}
          placeholder="user_2abc... or your organization id"
          className="w-full px-4 py-2.5 rounded-lg bg-gray-900 border border-gray-800 text-gray-100 placeholder-gray-600 font-mono text-sm focus:outline-none focus:border-blue-600 transition-colors"
        />
        <p className="text-xs text-gray-500 mt-2">
          The owner_id whose agents and events will be included in the report. Reports cover the last 90 days.
        </p>
      </div>

      {error && (
        <div className="border border-red-800 bg-red-900/20 rounded-lg p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Report cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {REPORTS.map((r) => {
          const isGenerating = generating === r.id;
          return (
            <div
              key={r.id}
              className={`border ${r.color} rounded-lg p-6 flex flex-col hover:border-opacity-100 transition-colors`}
            >
              <div className="flex-1 space-y-3">
                <div>
                  <h3 className={`text-lg font-semibold ${r.accent}`}>{r.title}</h3>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mt-0.5">
                    {r.subtitle}
                  </p>
                </div>
                <p className="text-sm text-gray-400 leading-relaxed">{r.description}</p>
              </div>

              <button
                onClick={() => handleGenerate(r.id)}
                disabled={isGenerating || generating !== null}
                className="mt-6 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
              >
                {isGenerating ? (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
                      <path d="M21 12a9 9 0 11-6.219-8.56" strokeLinecap="round" />
                    </svg>
                    Generating...
                  </>
                ) : (
                  <>
                    Generate Report — $500
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                    </svg>
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
