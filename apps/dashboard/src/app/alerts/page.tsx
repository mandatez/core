import AlertsClient from './alerts-client';

export const dynamic = 'force-dynamic';

export default function AlertsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold">Alert Configuration</h2>
        <p className="text-gray-400 mt-1">
          Get notified instantly when your agents are flagged, blocked, or
          change trust grade.
        </p>
      </div>

      <AlertsClient />
    </div>
  );
}
