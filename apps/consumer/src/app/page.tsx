import Link from 'next/link';

const EVENTS = [
  { outcome: 'allowed', action: 'read emails', time: '2s ago' },
  { outcome: 'allowed', action: 'read calendar', time: '4s ago' },
  { outcome: 'blocked', action: 'export customer_data', time: '5s ago' },
  { outcome: 'allowed', action: 'call api/openai', time: '8s ago' },
  { outcome: 'flagged', action: 'write financial_records', time: '12s ago' },
  { outcome: 'blocked', action: 'delete user_data', time: '14s ago' },
  { outcome: 'allowed', action: 'read documents', time: '18s ago' },
  { outcome: 'pending', action: 'payment api/stripe', time: 'just now' },
];

function outcomeClass(outcome: string): string {
  switch (outcome) {
    case 'allowed': return 'text-green-400';
    case 'blocked': return 'text-red-400';
    case 'flagged': return 'text-yellow-400';
    case 'pending': return 'text-blue-400';
    default: return 'text-gray-400';
  }
}

export default function LandingPage() {
  return (
    <div>
      {/* Hero — full viewport, left-anchored */}
      <section className="min-h-screen grid grid-cols-1 lg:grid-cols-2 px-6 md:px-12 lg:px-16 xl:px-24">
        <div className="flex flex-col justify-end pb-16 lg:pb-24 pt-32">
          <h2 className="text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-bold tracking-tight leading-[1.05] uppercase">
            Every agent
            <br />
            needs a mandate.
          </h2>
          <p className="mt-6 md:mt-8 text-lg md:text-xl text-gray-400 max-w-lg leading-relaxed">
            Your AI reads your email, moves your money, and deletes your files.
            You should know when it does.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4">
            <Link
              href="/activity"
              className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium tracking-wide uppercase rounded transition-colors"
            >
              See what it did
            </Link>
            <Link
              href="/rules"
              className="px-8 py-4 border border-gray-700 hover:border-gray-400 text-gray-300 hover:text-white text-sm font-medium tracking-wide uppercase rounded transition-colors"
            >
              Set your rules
            </Link>
          </div>
        </div>

        {/* Terminal — floating against darkness */}
        <div className="hidden lg:flex items-end pb-24 pl-12">
          <div className="w-full max-w-md ml-auto relative" style={{ height: '22rem' }}>
            <div className="space-y-3 font-mono text-[13px]">
              {EVENTS.map((e, i) => (
                <div
                  key={i}
                  className={`terminal-line terminal-line-${i} flex items-center`}
                >
                  <span className={`${outcomeClass(e.outcome)} w-20 shrink-0`}>
                    [{e.outcome}]
                  </span>
                  <span className="text-gray-300 truncate">{e.action}</span>
                  <span className="text-gray-600 ml-auto pl-4 text-xs shrink-0">
                    {e.time}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-1.5 font-mono text-[13px]">
              <span className="text-gray-600">$</span>
              <span className="terminal-cursor w-1.5 h-4 bg-blue-400 inline-block" />
            </div>
            <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-[#0a0a0a] to-transparent pointer-events-none" />
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="w-px h-24 bg-gradient-to-b from-transparent via-gray-700 to-transparent mx-auto lg:ml-16 xl:ml-24" />

      {/* Three statements — full width, left border accent */}
      <section className="px-6 md:px-12 lg:px-16 xl:px-24 py-24 md:py-32 space-y-16 md:space-y-20">
        <div className="border-l-2 border-blue-500 pl-8 max-w-3xl">
          <h3 className="text-3xl md:text-4xl font-semibold tracking-tight">
            See everything.
          </h3>
          <p className="mt-4 text-gray-500 text-lg leading-relaxed">
            Every action is signed with a cryptographic key unique to that agent.
            Tamper-proof. Immutable. Yours.
          </p>
        </div>
        <div className="border-l-2 border-blue-500 pl-8 max-w-3xl">
          <h3 className="text-3xl md:text-4xl font-semibold tracking-tight">
            Block anything.
          </h3>
          <p className="mt-4 text-gray-500 text-lg leading-relaxed">
            Write the rules once. Your agents follow them every time.
            No access to your bank. No exporting your data. No exceptions.
          </p>
        </div>
        <div className="border-l-2 border-blue-500 pl-8 max-w-3xl">
          <h3 className="text-3xl md:text-4xl font-semibold tracking-tight">
            Approve first.
          </h3>
          <p className="mt-4 text-gray-500 text-lg leading-relaxed">
            Sensitive actions pause and wait for you.
            Payments, exports, deletions — nothing moves until you say so.
          </p>
        </div>
      </section>

      {/* Divider */}
      <div className="w-px h-24 bg-gradient-to-b from-transparent via-gray-700 to-transparent mx-auto lg:ml-16 xl:ml-24" />

      {/* Close */}
      <section className="px-6 md:px-12 lg:px-16 xl:px-24 py-24 md:py-32">
        <p className="text-3xl md:text-4xl font-semibold tracking-tight leading-snug max-w-2xl">
          Your AI is already acting on your behalf.
          <br />
          <span className="text-gray-500">Do you know what it did today?</span>
        </p>
        <Link
          href="/activity"
          className="inline-block mt-10 px-10 py-4 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium tracking-wide uppercase rounded transition-colors"
        >
          Find out now
        </Link>
        <p className="mt-8 text-sm text-gray-600">
          Free for up to 3 agents. $9.99/mo for unlimited.
        </p>
      </section>

      <div className="h-16" />
    </div>
  );
}
