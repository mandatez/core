import { POLICY_TEMPLATE_LIST } from '@mandatez/sdk';
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
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold">Policy Templates</h2>
        <p className="text-gray-400 mt-1 max-w-3xl">
          Pre-built policy configurations for common agent use cases. Pick a template,
          apply it to an agent, and ship. Every template is a starting point — clone it,
          edit the rules, and push your tweaks back to source control.
        </p>
      </div>

      <TemplatesGallery templates={templates} />
    </div>
  );
}
