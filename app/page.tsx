
// app/page.tsx  — server component, zero client JS
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function RootPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get('yepper_session');

  if (session?.value) {
    redirect('/explore');
  } else {
    redirect('/login');
  }
}