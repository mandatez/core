'use client';

import { useState } from 'react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Tag,
} from '@/components/ui';

type ReportType = 'owasp' | 'eu-ai-act' | 'hipaa';

interface ReportCard {
  id: ReportType;
  title: string;
  subtitle: string;
  description: string;
}

const REPORTS: ReportCard[] = [
  {
    id: 'owasp',
    title: 'OWASP Agentic Top 10',
    subtitle: '2025 AI agent security standard',
    description:
      'Prove compliance with the 2025 OWASP AI agent security standard. Maps every ASI-01 through ASI-10 risk to MandateZ controls.',
  },
  {
    id: 'eu-ai-act',
    title: 'EU AI Act',
    subtitle: 'August 2026 enforcement',
    description:
      'Document compliance with August 2026 enforcement requirements. Articles 9, 12, 13, 14 mapped to signed audit trail and oversight gates.',
  },
  {
    id: 'hipaa',
    title: 'HIPAA AI Addendum',
    subtitle: 'Healthcare AI agents',
    description:
      'Audit trail for healthcare AI agents. Maps 164.308 and 164.312 safeguards to Ed25519-signed event records and policy enforcement.',
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
        body: JSON.stringify({
          owner_id: ownerId.trim(),
          report_type: reportType,
        }),
      });
      if (!response.ok) {
        const errBody = await response
          .json()
          .catch(() => ({ error: 'Request failed' }));
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
      setError(
        err instanceof Error ? err.message : 'Failed to generate report',
      );
    } finally {
      setGenerating(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Owner ID input */}
      <Card variant="default" className="p-5">
        <label
          htmlFor="owner-id"
          className="mb-2 block font-mono text-[10px] uppercase tracking-[0.22em] text-text-muted"
        >
          Owner ID
        </label>
        <input
          id="owner-id"
          type="text"
          value={ownerId}
          onChange={(e) => setOwnerId(e.target.value)}
          placeholder="user_2abc… or your organization id"
          className="w-full rounded-md border border-border-default bg-bg-overlay px-3 py-2.5 font-mono text-sm text-text-primary placeholder:text-text-muted focus:border-border-focus focus:outline-none transition-colors"
        />
        <p className="mt-2 text-xs leading-relaxed text-text-muted">
          The owner_id whose agents and events will be included. Reports cover
          the last 90 days.
        </p>
      </Card>

      {error && (
        <Card variant="danger-tinted" className="p-4">
          <div className="font-mono text-xs text-accent-danger">{error}</div>
        </Card>
      )}

      {/* Report cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {REPORTS.map((r) => {
          const isGenerating = generating === r.id;
          return (
            <Card
              key={r.id}
              variant="elevated"
              className="flex h-full flex-col transition-colors hover:border-border-strong"
            >
              <CardHeader>
                <div>
                  <Tag variant="info" className="mb-3">
                    {r.id}
                  </Tag>
                  <CardTitle>{r.title}</CardTitle>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.22em] text-text-muted">
                    {r.subtitle}
                  </p>
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                <CardDescription>{r.description}</CardDescription>
              </CardContent>
              <div className="px-6 pb-6">
                <Button
                  variant="primary"
                  className="w-full"
                  loading={isGenerating}
                  disabled={generating !== null && !isGenerating}
                  onClick={() => handleGenerate(r.id)}
                  rightIcon={!isGenerating ? <IconDownload /> : undefined}
                >
                  {isGenerating
                    ? 'Generating report'
                    : 'Generate report — $500'}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function IconDownload() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
    </svg>
  );
}
