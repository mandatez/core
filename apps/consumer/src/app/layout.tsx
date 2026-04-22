import type { Metadata } from 'next';
import { Space_Grotesk } from 'next/font/google';
import { ClerkProvider, SignInButton, Show, UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import './globals.css';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
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
    <html lang="en">
      <body className={`${spaceGrotesk.className} text-gray-100 min-h-screen`}>
        <ClerkProvider>
          <nav className="fixed top-0 left-0 right-0 z-50 border-b border-gray-800/50 backdrop-blur-sm px-8 md:px-16 lg:px-24 py-4">
            <div className="flex items-center gap-8">
              <Link href="/" className="text-xl font-black tracking-tight">
                Mandate<span className="text-blue-400">Z</span>
              </Link>
              <div className="flex gap-6 text-sm text-gray-400">
                <Link href="/" className="hover:text-gray-200 transition-colors">
                  Home
                </Link>
                <Link href="/activity" className="hover:text-gray-200 transition-colors">
                  Activity
                </Link>
                <Link href="/rules" className="hover:text-gray-200 transition-colors">
                  Rules
                </Link>
                <Link href="/pricing" className="hover:text-gray-200 transition-colors">
                  Pricing
                </Link>
              </div>
              <div className="ml-auto flex items-center gap-6">
                <Show when="signed-in">
                  <Link href="/account" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">
                    Account
                  </Link>
                </Show>
                <Show when="signed-out">
                  <SignInButton>
                    <button className="text-sm text-gray-400 hover:text-gray-200 transition-colors">
                      Sign in
                    </button>
                  </SignInButton>
                </Show>
                <Show when="signed-in">
                  <UserButton userProfileUrl="/account" userProfileMode="navigation" />
                </Show>
              </div>
            </div>
          </nav>
          <main>
            {children}
          </main>
        </ClerkProvider>
      </body>
    </html>
  );
}
