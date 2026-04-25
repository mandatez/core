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
        <h2 className="text-2xl font-semibold text-text-primary">
          Organization settings
        </h2>
        <p className="mt-1 text-text-secondary max-w-2xl">
          Admin-only controls. Ownership transfer is permanent.
        </p>
      </div>

      <SettingsClient />
    </div>
  );
}
