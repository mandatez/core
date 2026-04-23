import OrganizationClient from './organization-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Organization — MandateZ',
  description: 'Manage organization members and roles.',
};

export default function OrganizationPage() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold">Organization</h2>
        <p className="text-gray-400 mt-1">
          Share agent oversight across your security team. Roles decide who can
          invite, approve, and view.
        </p>
      </div>

      <OrganizationClient />
    </div>
  );
}
