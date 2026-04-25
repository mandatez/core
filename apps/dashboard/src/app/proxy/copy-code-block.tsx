'use client';

import { useState } from 'react';
import { Button } from '@/components/ui';

export function CopyCodeBlock({
  label,
  code,
}: {
  label: string;
  code: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <div className="rounded-md border border-border-default bg-bg-base">
      <div className="flex items-center justify-between border-b border-border-default px-3 py-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
          {label}
        </span>
        <Button variant="ghost" size="sm" onClick={handleCopy}>
          {copied ? 'COPIED ✓' : 'COPY'}
        </Button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[11px] leading-relaxed text-text-secondary">
        <code>{code}</code>
      </pre>
    </div>
  );
}
