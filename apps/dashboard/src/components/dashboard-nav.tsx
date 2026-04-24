'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShadowScanNavLink } from '@/components/shadow-scan-nav-link';
import { OrgSwitcher } from '@/components/org-switcher';
import { QuickSearchButton } from '@/components/quick-search-button';
import { SignOutButton } from '@/components/sign-out-button';

export function DashboardNav() {
  const pathname = usePathname();

  // The login + callback pages stand on their own — no dashboard chrome.
  if (pathname === '/login' || pathname.startsWith('/auth/')) {
    return null;
  }

  return (
    <nav className="border-b border-gray-800 px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center gap-8">
        <Link href="/" className="text-xl font-bold tracking-tight">
          Mandate<span className="text-blue-400">Z</span>
        </Link>
        <div className="flex gap-6 text-sm text-gray-400">
          <Link
            href="/onboarding"
            className="text-blue-300 hover:text-blue-200 font-medium transition-colors"
          >
            Get Started
          </Link>
          <Link href="/" className="hover:text-gray-200 transition-colors">
            Events
          </Link>
          <Link href="/analytics" className="hover:text-gray-200 transition-colors">
            Analytics
          </Link>
          <Link href="/identity" className="hover:text-gray-200 transition-colors">
            Identity Checks
          </Link>
          <Link href="/reports" className="hover:text-gray-200 transition-colors">
            Reports
          </Link>
          <Link
            href="/policies/templates"
            className="hover:text-gray-200 transition-colors"
          >
            Templates
          </Link>
          <Link href="/schedules" className="hover:text-gray-200 transition-colors">
            Schedules
          </Link>
          <ShadowScanNavLink />
          <Link href="/alerts" className="hover:text-gray-200 transition-colors">
            Alerts
          </Link>
          <Link href="/proxy" className="hover:text-gray-200 transition-colors">
            Proxy Setup
          </Link>
          <Link href="/keys" className="hover:text-gray-200 transition-colors">
            API Keys
          </Link>
          <Link href="/organization" className="hover:text-gray-200 transition-colors">
            Organization
          </Link>
          <Link href="/pricing" className="hover:text-gray-200 transition-colors">
            Pricing
          </Link>
        </div>
        <div className="ml-auto flex items-center gap-4">
          <QuickSearchButton />
          <OrgSwitcher />
          <SignOutButton />
        </div>
      </div>
    </nav>
  );
}
