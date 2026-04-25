'use client';

import { useState } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';

interface ShareTrustCardProps {
  agentId: string;
  score: number;
  grade: string;
  onClose?: () => void;
}

const DASHBOARD_BASE = 'https://core-dashboard-black.vercel.app';
const DIRECTORY_BASE = 'https://core-directory.vercel.app';

export function ShareTrustCard({ agentId, score, grade, onClose }: ShareTrustCardProps) {
  const [copied, setCopied] = useState<'markdown' | 'html' | null>(null);

  const cardUrl = `${DASHBOARD_BASE}/api/trust-card/${agentId}`;
  const profileUrl = `${DIRECTORY_BASE}/agents/${agentId}`;

  const markdown = `[![MandateZ Trust Score](${cardUrl})](${profileUrl})`;

  const html = `<a href="${profileUrl}">\n  <img src="${cardUrl}" alt="MandateZ Trust Score" width="400" />\n</a>`;

  const tweetText = `My AI agent just reached ${grade.toUpperCase()} status on @MandateZ — trust score ${score}/100. Every agent needs a mandate.`;
  const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(profileUrl)}`;

  async function copyToClipboard(text: string, type: 'markdown' | 'html') {
    await navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <Card variant="elevated" className="space-y-6 p-6">
      <CardHeader className="flex flex-row items-center justify-between gap-3 p-0">
        <CardTitle>Share Your Trust Card</CardTitle>
        {onClose && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label="Close"
            className="px-2"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-6 p-0">
        <div className="flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/trust-card/${agentId}`}
            alt={`MandateZ Trust Score — ${grade} (${score}/100)`}
            width={400}
            className="rounded-lg border border-border-default"
          />
        </div>

        <div className="space-y-2">
          <label className="font-mono text-[10px] uppercase tracking-[0.25em] text-text-muted">
            GitHub README Badge
          </label>
          <div className="flex gap-2">
            <pre className="flex-1 overflow-x-auto whitespace-pre-wrap break-all rounded-md bg-bg-overlay px-3 py-2 font-mono text-xs text-text-secondary">
              {markdown}
            </pre>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => copyToClipboard(markdown, 'markdown')}
              className="shrink-0"
            >
              {copied === 'markdown' ? 'Copied!' : 'Copy Markdown'}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="font-mono text-[10px] uppercase tracking-[0.25em] text-text-muted">
            HTML Embed
          </label>
          <div className="flex gap-2">
            <pre className="flex-1 overflow-x-auto whitespace-pre-wrap break-all rounded-md bg-bg-overlay px-3 py-2 font-mono text-xs text-text-secondary">
              {html}
            </pre>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => copyToClipboard(html, 'html')}
              className="shrink-0"
            >
              {copied === 'html' ? 'Copied!' : 'Copy HTML'}
            </Button>
          </div>
        </div>

        <div className="pt-2">
          <Button asChild variant="primary" size="md">
            <a href={tweetUrl} target="_blank" rel="noopener noreferrer">
              Share on X
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
                <path d="M7 17l9.2-9.2M17 17V7H7" />
              </svg>
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}