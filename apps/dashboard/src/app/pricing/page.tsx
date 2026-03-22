import Link from 'next/link';

const TIERS = [
  {
    name: 'Starter',
    price: '$299',
    period: '/mo',
    description: 'Compliance reporting for a single standard.',
    features: [
      'Compliance reports',
      'One compliance pack (HIPAA or EU AI Act)',
      'Audit trail export',
      'Email support',
    ],
    cta: 'Get started',
    href: '#',
    highlighted: false,
  },
  {
    name: 'Business',
    price: '$999',
    period: '/mo',
    description: 'Full compliance coverage for growing teams.',
    features: [
      'All compliance packs (HIPAA + EU AI Act + SOC2)',
      'SSO',
      'SLA',
      'White-label SDK',
      'Dedicated Slack channel',
      '5 seats',
    ],
    cta: 'Upgrade to Business',
    href: '#',
    highlighted: true,
  },
  {
    name: 'Platform',
    price: 'Custom',
    period: '',
    description: 'For organizations that embed MandateZ into their product.',
    features: [
      'Everything in Business',
      'Unlimited seats',
      'On-premise option',
      'Custom compliance packs',
      'Dedicated account manager',
    ],
    cta: 'Contact us',
    href: 'mailto:hello@mandatez.com',
    highlighted: false,
  },
];

export default function PricingPage() {
  return (
    <div className="space-y-20">
      <div>
        <h2 className="text-2xl font-semibold">Pricing</h2>
        <p className="text-gray-400 mt-1">
          Compliance infrastructure for teams deploying AI agents at scale.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {TIERS.map((tier) => (
          <div
            key={tier.name}
            className={`rounded-lg p-8 flex flex-col ${
              tier.highlighted
                ? 'border-2 border-blue-500 relative'
                : 'border border-gray-800'
            }`}
          >
            {tier.highlighted && (
              <span className="absolute -top-3 left-8 bg-blue-500 text-white text-xs font-semibold tracking-wide uppercase px-3 py-1 rounded">
                Most popular
              </span>
            )}

            <h3 className="text-lg font-semibold text-gray-100">
              {tier.name}
            </h3>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-4xl font-bold tracking-tight text-gray-100">
                {tier.price}
              </span>
              {tier.period && (
                <span className="text-gray-500 text-sm">{tier.period}</span>
              )}
            </div>
            <p className="mt-3 text-sm text-gray-500">
              {tier.description}
            </p>

            <ul className="mt-8 space-y-3 flex-1">
              {tier.features.map((feature) => (
                <li key={feature} className="text-sm text-gray-300 flex items-start gap-3">
                  <span className="text-blue-400 mt-0.5 shrink-0">—</span>
                  {feature}
                </li>
              ))}
            </ul>

            <Link
              href={tier.href}
              className={`mt-10 block text-center px-6 py-3 text-sm font-medium tracking-wide uppercase rounded transition-colors ${
                tier.highlighted
                  ? 'bg-blue-600 hover:bg-blue-500 text-white'
                  : 'border border-gray-700 hover:border-gray-400 text-gray-300 hover:text-white'
              }`}
            >
              {tier.cta}
            </Link>
          </div>
        ))}
      </div>

      {/* One-time audit report */}
      <div className="border-t border-gray-800 pt-12">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 max-w-3xl">
          <div>
            <h3 className="text-xl font-semibold text-gray-100">
              Need a single audit report?
            </h3>
            <p className="mt-2 text-gray-400">
              $500 flat. No subscription. One complete compliance report covering all agent
              activity for your chosen time period.
            </p>
          </div>
          <Link
            href="#"
            className="shrink-0 px-8 py-3 border border-gray-700 hover:border-gray-400 text-gray-300 hover:text-white text-sm font-medium tracking-wide uppercase rounded transition-colors"
          >
            Get audit report &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
