import { SectionMarker } from '@/components/ui';
import AlertsClient from './alerts-client';

export const dynamic = 'force-dynamic';

export default function AlertsPage() {
  return (
    <div className="space-y-10">
      <header className="space-y-4">
        <SectionMarker number="01" label="ALERTS" />
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-text-primary">
            Alert configuration
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary">
            Get notified instantly when your agents are flagged, blocked, or
            change trust grade. Alerts fan out to every connected channel.
          </p>
        </div>
      </header>

      <AlertsClient />
    </div>
  );
}
