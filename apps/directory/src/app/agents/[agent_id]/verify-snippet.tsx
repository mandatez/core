'use client';

import { useState } from 'react';

interface VerifySnippetProps {
  agentId: string;
  directoryUrl: string;
}

export function VerifySnippet({ agentId, directoryUrl }: VerifySnippetProps) {
  const sdkSnippet = `// Verify this agent before transacting
import { MandateZClient } from '@mandatez/sdk';

const result = await client.verifyAgent({
  requestingAgentId: 'ag_your_agent',
  targetAgentId: '${agentId}',
  requiredMinScore: 60,
});

if (result.verified) {
  // Safe to proceed — trust score ${'${result.targetTrustScore}'}
}`;

  const curlSnippet = `POST ${directoryUrl}/api/agents/verify
Content-Type: application/json

{
  "requesting_agent_id": "ag_your_agent",
  "target_agent_id": "${agentId}",
  "required_min_score": 60
}`;

  return (
    <div className="border border-gray-800 rounded-lg p-6 space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-white">Verify this agent</h3>
        <p className="text-sm text-gray-400 mt-1">
          Run this verification before allowing{' '}
          <span className="font-mono text-gray-300">{agentId}</span> to transact with your
          own agent. Returns whether the target meets your minimum trust score.
        </p>
      </div>

      <CodeBlock label="SDK" code={sdkSnippet} />
      <CodeBlock label="HTTP" code={curlSnippet} />

      <p className="text-xs text-gray-500 pt-2 border-t border-gray-900">
        The verification endpoint is public and rate-limited per IP. No API key required.
      </p>
    </div>
  );
}

function CodeBlock({ label, code }: { label: string; code: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard can fail in insecure contexts; ignore
    }
  }

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs uppercase tracking-wider text-gray-500">{label}</span>
        <button
          onClick={handleCopy}
          className="text-xs text-gray-400 hover:text-gray-200 transition-colors px-2 py-0.5 rounded border border-gray-800 hover:border-gray-700"
          aria-label={`Copy ${label} snippet`}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="text-xs text-gray-300 bg-gray-950 rounded-lg p-4 overflow-x-auto border border-gray-900 font-mono leading-relaxed">
        {code}
      </pre>
    </div>
  );
}