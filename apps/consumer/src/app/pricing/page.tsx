import Link from 'next/link';

const TIERS = [
  {
    name: 'Free',
    price: '$0',
    period: '/mo',
    description: 'For individuals getting started with AI oversight.',
    features: [
      'Up to 3 agents',
      'Event logging',
      'Basic dashboard',
      'Community support',
    ],
    cta: 'Get started',
    href: '/activity',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '$9.99',
    period: '/mo',
    description: 'Full control over every agent you run.',
    features: [
      'Unlimited agents',
      'Real-time event feed',
      'Policy engine',
      'Human oversight gate',
      'Slack + webhook alerts',
      'Compliance report export',
      'Email support',
    ],
    cta: 'Upgrade to Pro',
    href: '/activity',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'For teams that need guarantees.',
    features: [
      'Everything in Pro',
      'SSO + audit logs',
      'White-label SDK',
      'SLA guarantee',
      'Dedicated support',
      'On-premise option',
    ],
    cta: 'Contact us',
    href: 'mailto:hello@mandatez.com',
    highlighted: false,
  },
];

export default function PricingPage() {
  return (
    <div className="py-16 md:py-24">
      <div className="mb-16">
        <h2 className="text-3xl md:text-4xl font-black tracking-tight uppercase">
          Pricing
        </h2>
        <p className="mt-4 text-gray-400 text-lg max-w-lg">
          Start free. Upgrade when your agents need more.
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
                Recommended
              </span>
            )}

            <h3 className="text-lg font-semibold text-gray-100">
              {tier.name}
            </h3>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-4xl font-black tracking-tight text-gray-100">
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
    </div>
  );
}
