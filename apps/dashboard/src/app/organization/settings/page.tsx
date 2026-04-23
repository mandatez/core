import SettingsClient from './settings-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Organization settings — MandateZ',
  description: 'Rename, re-slug, or transfer ownership of your organization.',
};

export default function OrganizationSettingsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold">Organization settings</h2>
        <p className="text-gray-400 mt-1">
          Admin-only controls. Ownership transfer is permanent.
        </p>
      </div>

      <SettingsClient />
    </div>
  );
}
