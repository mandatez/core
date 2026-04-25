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
        <h2 className="text-2xl font-semibold text-text-primary">
          Organization
        </h2>
        <p className="mt-1 text-text-secondary max-w-2xl">
          Share agent oversight across your security team. Roles decide who can
          invite, approve, and view.
        </p>
      </div>

      <OrganizationClient />
    </div>
  );
}
