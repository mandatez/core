import type { Metadata } from 'next';
import './globals.css';
import { DashboardNav } from '@/components/dashboard-nav';

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
        <DashboardNav />
        <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
