import PricingClient from './pricing-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Pricing — MandateZ',
  description:
    'Account-aware pricing for MandateZ. See your current plan, usage, and upgrade options.',
};

export default function PricingPage() {
  return (
    <div className="space-y-12">
      <div>
        <h2 className="text-2xl font-semibold text-text-primary">Pricing</h2>
        <p className="mt-1 text-text-secondary max-w-2xl">
          Compliance infrastructure for teams deploying AI agents at scale. Your
          current plan and usage are highlighted below.
        </p>
      </div>

      <PricingClient />
    </div>
  );
}
