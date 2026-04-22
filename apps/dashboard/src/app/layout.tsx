import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import { ShadowScanNavLink } from '@/components/shadow-scan-nav-link';

export const metadata: Metadata = {
  title: 'MandateZ Dashboard',
  description: 'Agent event monitoring and compliance dashboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="text-gray-100 min-h-screen">
        <nav className="border-b border-gray-800 px-6 py-4">
          <div className="max-w-7xl mx-auto flex items-center gap-8">
            <Link href="/" className="text-xl font-bold tracking-tight">
              Mandate<span className="text-blue-400">Z</span>
            </Link>
            <div className="flex gap-6 text-sm text-gray-400">
              <Link href="/" className="hover:text-gray-200 transition-colors">
                Events
              </Link>
              <Link href="/identity" className="hover:text-gray-200 transition-colors">
                Identity Checks
              </Link>
              <Link href="/reports" className="hover:text-gray-200 transition-colors">
                Reports
              </Link>
              <ShadowScanNavLink />
              <Link href="/pricing" className="hover:text-gray-200 transition-colors">
                Pricing
              </Link>
            </div>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-6 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
