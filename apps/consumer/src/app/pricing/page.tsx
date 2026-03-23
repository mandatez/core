import Link from 'next/link';

const TIERS = [
  {
    name: 'Free',
    price: '$0',
    period: '/mo',
    description: 'Everything you need to see what your AI is doing.',
    features: [
      'Unlimited agents',
      'Full event logging',
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
    description: 'Full control, full enforcement, full visibility.',
    features: [
      'Everything in Free',
      'Compliance exports',
      'Policy engine',
      'Human oversight gate',
      'Slack + webhook alerts',
      'Email support',
    ],
    cta: 'Upgrade to Pro',
    href: '/activity',
    highlighted: true,
  },
];

export default function PricingPage() {
  return (
    <div className="py-16 md:py-24 pt-24 pl-8 md:pl-16 lg:pl-24 pr-8 md:pr-16 lg:pr-24">
      <div className="mb-16">
        <h2 className="text-3xl md:text-4xl font-black tracking-tight uppercase">
          Pricing
        </h2>
        <p className="mt-4 text-gray-400 text-lg max-w-lg">
          Start free. Upgrade when your agents need more.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl">
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
              <span className="text-gray-500 text-sm">{tier.period}</span>
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

      <p className="mt-12 text-sm text-gray-500">
        Need enterprise compliance or white-label?{' '}
        <Link href="/enterprise" className="text-blue-400 hover:text-blue-300 transition-colors">
          See enterprise plans &rarr;
        </Link>
      </p>
    </div>
  );
}
