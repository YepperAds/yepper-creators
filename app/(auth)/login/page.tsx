import type { Metadata } from 'next';
import LoginForm from '@/app/_components/auth/LoginForm';
import PWAInstallButton from '@/app/_components/home/PWAInstallButton';

export const metadata: Metadata = {
  title: 'Sign In',
  description: 'Sign in to your Yepper account with Google.',
};

export default function LoginPage() {
  return (
    <div style={{ fontFamily: 'var(--font-poppins)' }}>
      <div className="mb-8 text-center">
        <h2 className="mb-3 text-4xl font-semibold leading-[1.08] tracking-[-0.035em] text-white sm:text-5xl">
          Make your next move with Yepper
        </h2>
        <p className="mx-auto max-w-sm text-[15px] leading-6 text-white/60">
          Reach new audiences, grow your platform, and make every campaign count.
        </p>
      </div>
      <LoginForm />
      <div className="mt-6 flex justify-center">
        <PWAInstallButton label="Download desktop app" alwaysVisible />
      </div>
    </div>
  );
}
