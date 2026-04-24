import LoginClient from './login-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Sign in — MandateZ',
  description: 'Sign in to the MandateZ dashboard with a magic link.',
};

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="text-2xl font-bold tracking-tight">
            Mandate<span className="text-blue-400">Z</span>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            Every agent needs a mandate.
          </p>
        </div>

        <LoginClient />

        <p className="text-[11px] text-gray-600 text-center font-mono">
          By signing in you authorize MandateZ to monitor agent events under
          your account.
        </p>
      </div>
    </div>
  );
}
