import { PersonalFeed } from '@/components/personal-feed';

export default function ActivityPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Your Activity</h2>
        <p className="text-gray-400 mt-1">
          Everything your AI assistants have done, in real time.
        </p>
      </div>
      <PersonalFeed />
    </div>
  );
}
