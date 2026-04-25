import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  NumberDisplay,
  SectionMarker,
  Tag,
} from '@/components/ui';
import { ShadowScanClient } from './shadow-scan-client';

export const metadata = {
  title: 'Shadow Agent Discovery — MandateZ',
  description:
    '48.9% of enterprises are blind to their own AI agent traffic. Scan your stack for ungoverned agents.',
};

export default function ShadowScanPage() {
  return (
    <div className="space-y-12">
      {/* Hero */}
      <header className="space-y-6">
        <div className="flex items-center gap-3">
          <SectionMarker number="00" label="SHADOW SCAN" />
          <Tag variant="danger">CISO MANDATE</Tag>
        </div>

        <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight text-text-primary leading-tight">
              Find the AI agents nobody is watching
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-text-secondary">
              Scan connected services for agents operating without identity,
              policy, or audit trail. Cross-reference against your registered
              MandateZ agents to surface the shadow stack.
            </p>
          </div>
          <NumberDisplay
            value="48.9"
            suffix="% BLIND"
            size="md"
            accent="danger"
          />
        </div>
      </header>

      <ShadowScanClient />

      <section className="border-t border-border-default pt-10">
        <div className="grid gap-8 md:grid-cols-3">
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
      </section>
    </div>
  );
}

function InfoBlock({ title, body }: { title: string; body: string }) {
  return (
    <Card variant="default">
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
        <CardDescription>{body}</CardDescription>
      </CardHeader>
      <CardContent />
    </Card>
  );
}
