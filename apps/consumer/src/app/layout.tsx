import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'MandateZ — Control Your AI',
  description: 'See what your AI assistants do and set the rules for what they can access',
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
          <div className="max-w-3xl mx-auto flex items-center gap-8">
            <Link href="/" className="text-xl font-bold tracking-tight">
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
            </div>
          </div>
        </nav>
        <main className="max-w-3xl mx-auto px-6 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
