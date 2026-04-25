import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Link from 'next/link';
import './globals.css';

const geist = Geist({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-geist',
  display: 'swap',
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-geist-mono',
  display: 'swap',
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL('https://core-consumer.vercel.app'),
  title: 'MandateZ — Control Your AI',
  description: 'See what your AI assistants do and set the rules for what they can access',
  openGraph: {
    title: 'MandateZ — Every agent needs a mandate',
    description:
      'The neutral, cross-vendor trust infrastructure layer for AI agents. Read the State of AI Agent Governance 2026 report.',
    url: 'https://core-consumer.vercel.app',
    siteName: 'MandateZ',
    type: 'website',
    images: [
      {
        url: 'https://core-dashboard-black.vercel.app/api/trust-card/ag_ctx_ai_prod',
        width: 1200,
        height: 630,
        alt: 'MandateZ — State of AI Agent Governance 2026',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MandateZ — Every agent needs a mandate',
    description:
      'State of AI Agent Governance 2026 — MandateZ original research on the governance gap.',
    images: [
      'https://core-dashboard-black.vercel.app/api/trust-card/ag_ctx_ai_prod',
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${geistMono.variable}`}
    >
      <body className="text-text-primary min-h-screen font-sans">
        <nav className="fixed top-0 left-0 right-0 z-50 bg-[#080808]/80 backdrop-blur-xl border-b border-white/[0.06] px-6 md:px-10 lg:px-16 py-4">
          <div className="flex items-center gap-4 md:gap-8">
            <Link href="/" className="text-xl font-bold tracking-tight font-display">
              Mandate<span className="text-accent-primary">Z</span>
            </Link>
            <div className="hidden md:flex gap-6 text-sm text-text-secondary">
              <Link href="/" className="hover:text-text-primary transition-colors">
                Home
              </Link>
              <Link href="/activity" className="hover:text-text-primary transition-colors">
                Activity
              </Link>
              <Link href="/rules" className="hover:text-text-primary transition-colors">
                Rules
              </Link>
              <Link href="/pricing" className="hover:text-text-primary transition-colors">
                Pricing
              </Link>
            </div>
            <div className="ml-auto flex items-center gap-6">
              <Link
                href="https://core-dashboard-black.vercel.app/login"
                className="text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                Sign in
              </Link>
            </div>
          </div>
        </nav>
        <main>
          {children}
        </main>
      </body>
    </html>
  );
}
