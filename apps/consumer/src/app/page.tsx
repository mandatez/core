import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="space-y-20 py-8">
      {/* Hero */}
      <section className="text-center space-y-6 max-w-2xl mx-auto">
        <h2 className="text-4xl font-bold tracking-tight">
          Control what your AI<br />
          <span className="text-blue-400">can and can't access</span>
        </h2>
        <p className="text-lg text-gray-400 leading-relaxed">
          Your AI assistant reads your emails, manages your calendar, and connects
          to your bank. MandateZ shows you exactly what it did, and lets you set
          the rules for what it's allowed to do.
        </p>
        <div className="flex gap-4 justify-center pt-2">
          <Link
            href="/activity"
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors"
          >
            View Activity
          </Link>
          <Link
            href="/rules"
            className="px-6 py-3 border border-gray-700 hover:border-gray-500 text-gray-200 rounded-lg font-medium transition-colors"
          >
            Set Rules
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-3xl mx-auto">
        <h3 className="text-center text-sm font-semibold text-gray-500 uppercase tracking-wider mb-8">
          How it works
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FeatureCard
            icon="🔍"
            title="See everything"
            description="Every action your AI takes is logged with a tamper-proof signature. Read an email, booked a flight, sent a payment — you'll know."
          />
          <FeatureCard
            icon="🛡️"
            title="Set boundaries"
            description="Block your AI from accessing your bank. Flag any export of personal data. You decide what's off limits."
          />
          <FeatureCard
            icon="✅"
            title="Approve the big stuff"
            description="For sensitive actions like payments or data exports, MandateZ pauses and asks you first. No surprises."
          />
        </div>
      </section>

      {/* What gets tracked */}
      <section className="max-w-2xl mx-auto text-center space-y-6">
        <h3 className="text-xl font-semibold">What gets tracked</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            ['📖', 'Reads', 'Emails, documents, files'],
            ['✏️', 'Writes', 'Messages, calendar events'],
            ['📤', 'Exports', 'Data leaving your accounts'],
            ['🗑️', 'Deletes', 'Anything permanently removed'],
            ['📡', 'API Calls', 'Services your AI connects to'],
            ['💳', 'Payments', 'Any financial transaction'],
          ].map(([icon, title, desc]) => (
            <div key={title} className="border border-gray-800 rounded-lg p-4 text-left">
              <div className="text-lg mb-1">{icon}</div>
              <div className="text-sm font-medium text-gray-200">{title}</div>
              <div className="text-xs text-gray-500 mt-0.5">{desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="text-center space-y-4 pb-8">
        <p className="text-gray-400">
          Free for up to 3 agents. <span className="text-gray-300">$9.99/mo</span> for unlimited.
        </p>
        <Link
          href="/activity"
          className="inline-block px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors"
        >
          Get Started
        </Link>
      </section>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="border border-gray-800 rounded-lg p-5 space-y-2">
      <div className="text-2xl">{icon}</div>
      <h4 className="font-medium text-gray-100">{title}</h4>
      <p className="text-sm text-gray-400 leading-relaxed">{description}</p>
    </div>
  );
}
