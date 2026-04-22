import { ShadowScanClient } from './shadow-scan-client';

export const metadata = {
  title: 'Shadow Agent Discovery — MandateZ',
  description:
    '48.9% of enterprises are blind to their own AI agent traffic. Scan your stack for ungoverned agents.',
};

export default function ShadowScanPage() {
  return (
    <div className="space-y-8">
      <div>
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-red-900/60 bg-red-950/30 text-red-300 text-xs font-medium mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
          CISO MANDATE
        </div>
        <h2 className="text-3xl font-semibold tracking-tight">Shadow Agent Discovery</h2>
        <p className="text-gray-400 mt-2 max-w-2xl">
          <span className="text-gray-200 font-medium">48.9% of enterprises are blind to their own AI agent traffic.</span>{' '}
          Find yours. Scan connected services for unregistered agents operating without identity, policy, or audit trail.
        </p>
      </div>

      <ShadowScanClient />

      <div className="border-t border-gray-800 pt-8 mt-12 grid gap-6 md:grid-cols-3">
        <InfoBlock
          title="What we scan"
          body="GitHub Actions workflows, Vercel env vars, Supabase schemas, and n8n workflows for LangChain, CrewAI, AutoGen, LlamaIndex, and direct OpenAI / Anthropic SDK usage."
        />
        <InfoBlock
          title="What we detect"
          body="Agents operating without an Ed25519 identity, policy layer, or signed audit trail. Cross-referenced against your registered MandateZ agents."
        />
        <InfoBlock
          title="Why it matters"
          body="Ungoverned agents are the blast radius of the next breach. ASI-02 Tool Misuse and ASI-03 Identity Abuse both start with agents nobody is watching."
        />
      </div>
    </div>
  );
}

function InfoBlock({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-200 mb-2">{title}</h3>
      <p className="text-sm text-gray-500 leading-relaxed">{body}</p>
    </div>
  );
}
