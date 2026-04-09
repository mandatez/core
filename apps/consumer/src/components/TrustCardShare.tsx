'use client';

import { useState } from 'react';

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
    <div className="border border-gray-800 rounded-lg p-6 space-y-6 bg-gray-950">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-100">Share Your Trust Card</h3>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-gray-800 text-gray-500 hover:text-gray-300 transition-colors"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* Card preview */}
      <div className="flex justify-center">
        <img
          src={`/api/trust-card/${agentId}`}
          alt={`MandateZ Trust Score — ${grade} (${score}/100)`}
          width={400}
          className="rounded-lg border border-gray-800"
        />
      </div>

      {/* Copy Markdown */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">GitHub README Badge</label>
        <div className="flex gap-2">
          <pre className="flex-1 text-xs text-gray-400 bg-gray-900 rounded px-3 py-2 overflow-x-auto font-mono whitespace-pre-wrap break-all">
            {markdown}
          </pre>
          <button
            onClick={() => copyToClipboard(markdown, 'markdown')}
            className="shrink-0 px-3 py-2 rounded bg-gray-800 hover:bg-gray-700 text-sm text-gray-200 font-medium transition-colors"
          >
            {copied === 'markdown' ? 'Copied!' : 'Copy Markdown'}
          </button>
        </div>
      </div>

      {/* Copy HTML */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">HTML Embed</label>
        <div className="flex gap-2">
          <pre className="flex-1 text-xs text-gray-400 bg-gray-900 rounded px-3 py-2 overflow-x-auto font-mono whitespace-pre-wrap break-all">
            {html}
          </pre>
          <button
            onClick={() => copyToClipboard(html, 'html')}
            className="shrink-0 px-3 py-2 rounded bg-gray-800 hover:bg-gray-700 text-sm text-gray-200 font-medium transition-colors"
          >
            {copied === 'html' ? 'Copied!' : 'Copy HTML'}
          </button>
        </div>
      </div>

      {/* Share on X */}
      <div className="pt-2">
        <a
          href={tweetUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
        >
          Share on X
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 17l9.2-9.2M17 17V7H7" />
          </svg>
        </a>
      </div>
    </div>
  );
}
