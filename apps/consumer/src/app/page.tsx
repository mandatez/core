import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero */}
      <section className="flex-1 flex flex-col justify-center items-center text-center px-6 py-32 md:py-48">
        <h2 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[1.05]">
          Every agent needs a{' '}
          <span className="text-blue-400">mandate</span>.
        </h2>
        <p className="mt-6 md:mt-8 text-lg md:text-xl text-gray-400 max-w-xl leading-relaxed">
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
      </section>

      {/* The line */}
      <div className="w-px h-24 bg-gradient-to-b from-transparent via-gray-700 to-transparent mx-auto" />

      {/* What it does — three statements */}
      <section className="px-6 py-24 md:py-32 max-w-4xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-16 md:gap-12">
          <div>
            <h3 className="text-2xl md:text-3xl font-semibold tracking-tight">
              See everything.
            </h3>
            <p className="mt-4 text-gray-500 leading-relaxed">
              Every action is signed with a cryptographic key unique to that agent.
              Tamper-proof. Immutable. Yours.
            </p>
          </div>
          <div>
            <h3 className="text-2xl md:text-3xl font-semibold tracking-tight">
              Block anything.
            </h3>
            <p className="mt-4 text-gray-500 leading-relaxed">
              Write the rules once. Your agents follow them every time.
              No access to your bank. No exporting your data. No exceptions.
            </p>
          </div>
          <div>
            <h3 className="text-2xl md:text-3xl font-semibold tracking-tight">
              Approve first.
            </h3>
            <p className="mt-4 text-gray-500 leading-relaxed">
              Sensitive actions pause and wait for you.
              Payments, exports, deletions — nothing moves until you say so.
            </p>
          </div>
        </div>
      </section>

      {/* The line */}
      <div className="w-px h-24 bg-gradient-to-b from-transparent via-gray-700 to-transparent mx-auto" />

      {/* The question */}
      <section className="px-6 py-24 md:py-32 text-center">
        <p className="text-2xl md:text-4xl font-semibold tracking-tight max-w-2xl mx-auto leading-snug">
          Your AI is already acting on your behalf.<br />
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

      {/* Footer breathing room */}
      <div className="h-16" />
    </div>
  );
}
