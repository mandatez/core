import { POLICY_TEMPLATE_LIST } from '@mandatez/sdk';
import { Button, SectionMarker } from '@/components/ui';
import { TemplatesGallery, type TemplateView } from './templates-gallery';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Policy Templates — MandateZ',
  description:
    'Pre-built policy configurations for common agent use cases — HIPAA, fintech, support, code, analytics, sales.',
};

export default function PolicyTemplatesPage() {
  const templates: TemplateView[] = POLICY_TEMPLATE_LIST.map((t) => ({
    key: t.key,
    id: t.id,
    name: t.name,
    description: t.description,
    rules: t.rules.map((r) => ({
      action_types: [...r.action_types],
      resource_pattern: r.resource_pattern,
      effect: r.effect,
    })),
  }));

  return (
    <div className="space-y-10">
      <header className="space-y-4">
        <SectionMarker number="02" label="POLICY TEMPLATES" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-text-primary">
              Policy templates
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-text-secondary">
              Pre-built policy configurations for common agent use cases. Pick
              a template, apply it to an agent, and ship. Every template is a
              starting point — clone it, edit the rules, push tweaks back to
              source control.
            </p>
          </div>
          <Button variant="secondary" asChild>
            <a href="/policies">← Back to policies</a>
          </Button>
        </div>
      </header>

      <TemplatesGallery templates={templates} />
    </div>
  );
}
