import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MandateZ Agent Directory',
  description: 'Public registry of MandateZ-verified AI agents',
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
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <h1 className="text-xl font-bold tracking-tight">
              Mandate<span className="text-blue-400">Z</span>
            </h1>
            <span className="text-sm text-gray-500">Agent Directory</span>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-6 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
