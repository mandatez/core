'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export function ShadowScanNavLink() {
  const [unregistered, setUnregistered] = useState(0);

  useEffect(() => {
    function read() {
      const raw = window.localStorage.getItem('mandatez_shadow_scan_unregistered');
      const n = raw ? parseInt(raw, 10) : 0;
      setUnregistered(Number.isFinite(n) && n > 0 ? n : 0);
    }

    read();
    window.addEventListener('mandatez:shadow-scan-updated', read);
    window.addEventListener('storage', read);
    return () => {
      window.removeEventListener('mandatez:shadow-scan-updated', read);
      window.removeEventListener('storage', read);
    };
  }, []);

  return (
    <Link
      href="/shadow-scan"
      className="inline-flex items-center gap-1.5 hover:text-gray-200 transition-colors"
      title={unregistered > 0 ? `${unregistered} ungoverned agents detected` : 'Shadow Agent Discovery'}
    >
      Shadow Scan
      {unregistered > 0 && (
        <span
          aria-label={`${unregistered} ungoverned agents`}
          className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-amber-500/20 border border-amber-700 text-amber-300 text-[10px] font-semibold"
        >
          ⚠ {unregistered}
        </span>
      )}
    </Link>
  );
}
