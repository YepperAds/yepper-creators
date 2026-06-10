// Read the Yepper JWT from the yepper_token cookie (set at login).
// Falls back to localStorage for any legacy code paths still in transition.
export function getToken(): string {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(/(?:^|;\s*)yepper_token=([^;]+)/);
  if (match) return decodeURIComponent(match[1]);
  return localStorage.getItem('token') ?? '';
}
