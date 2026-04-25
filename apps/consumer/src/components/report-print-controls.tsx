'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui';

export function ReportPrintButton() {
  return (
    <Button
      variant="secondary"
      size="md"
      onClick={() => window.print()}
      rightIcon={
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
        </svg>
      }
    >
      Download PDF
    </Button>
  );
}

export function ReportAutoPrint() {
  const params = useSearchParams();
  const shouldPrint = params.get('print') === 'true';

  useEffect(() => {
    if (!shouldPrint) return;
    const id = window.setTimeout(() => {
      window.print();
    }, 600);
    return () => window.clearTimeout(id);
  }, [shouldPrint]);

  return null;
}