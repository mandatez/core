'use client';

import { useState } from 'react';

interface ShareButtonProps {
  cardUrl: string;
  profileUrl: string;
  agentId: string;
}

export function ShareButton({ cardUrl, profileUrl, agentId }: ShareButtonProps) {
  const [copied, setCopied] = useState<'html' | 'md' | null>(null);

  const htmlEmbed = `<!-- MandateZ Trust Badge -->\n<a href="${profileUrl}">\n  <img src="${cardUrl}" alt="MandateZ Trust Score" width="400" />\n</a>`;

  const markdownEmbed = `[![MandateZ Trust Score](${cardUrl})](${profileUrl})`;

  async function copy(text: string, type: 'html' | 'md') {
    await navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <button
          onClick={() => copy(htmlEmbed, 'html')}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm font-medium transition-colors border border-gray-700"
        >
          {copied === 'html' ? (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              Copy HTML Embed
            </>
          )}
        </button>

        <button
          onClick={() => copy(markdownEmbed, 'md')}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm font-medium transition-colors border border-gray-700"
        >
          {copied === 'md' ? (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              Copy Markdown
            </>
          )}
        </button>
      </div>

      <details className="text-xs">
        <summary className="text-gray-500 cursor-pointer hover:text-gray-400 transition-colors">
          View embed code
        </summary>
        <div className="mt-2 space-y-2">
          <div>
            <p className="text-gray-500 mb-1">HTML:</p>
            <pre className="text-gray-400 bg-gray-900 rounded-lg p-3 overflow-x-auto">{htmlEmbed}</pre>
          </div>
          <div>
            <p className="text-gray-500 mb-1">Markdown (GitHub README):</p>
            <pre className="text-gray-400 bg-gray-900 rounded-lg p-3 overflow-x-auto">{markdownEmbed}</pre>
          </div>
        </div>
      </details>
    </div>
  );
}
