import { redirect } from 'next/navigation';

// Retired: there's no role-selection step anymore. The dashboard at `/`
// shows both website and YouTube-creator features to everyone, regardless
// of "what they do", so forcing a choice here before reaching it was removed.
export default function ChooseRolePage() {
  redirect('/');
}
