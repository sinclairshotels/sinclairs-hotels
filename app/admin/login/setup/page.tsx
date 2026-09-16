import { SetPasswordForm } from '@/components/admin/set-password-form';
import type { Metadata } from 'next';

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-cream px-6">
      <div className="w-full max-w-sm rounded-lg border border-ink/10 bg-white p-8 shadow-sm">
        <img src="/logo.svg" alt="Sinclairs" className="h-9 w-auto" />
        <p className="mt-5 font-display text-xl text-forest">Choose a password</p>
        <p className="mt-1 text-sm text-ink/60">
          Set the password for your Sinclairs staff account.
        </p>
        <div className="mt-6">
          <SetPasswordForm token={token ?? ''} />
        </div>
      </div>
    </main>
  );
}
