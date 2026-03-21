import { EventFeed } from '@/components/event-feed';

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold">Agent Events</h2>
        <p className="text-gray-400 mt-1">
          Live feed of all agent actions across your organization.
        </p>
      </div>
      <EventFeed />
    </div>
  );
}
