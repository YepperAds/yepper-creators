import type { Metadata } from 'next';
import LoginForm from '@/app/_components/auth/LoginForm';

export const metadata: Metadata = {
  title: 'Sign In',
  description: 'Sign in to your Yepper account with Google.',
};

export default function LoginPage() {
  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">Welcome to Yepper</h2>
        <p className="text-zinc-400 text-sm">
          Sign in or create an account to continue
        </p>
      </div>
      <LoginForm />
    </div>
  );
}
