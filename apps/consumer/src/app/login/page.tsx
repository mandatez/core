import { SignIn } from '@clerk/nextjs';

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-8">
      <SignIn routing="hash" />
    </div>
  );
}
