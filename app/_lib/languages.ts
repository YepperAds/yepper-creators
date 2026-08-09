// Shared list of ad-space default languages: one source of truth for the
// language picker (website/[websiteId]/page.tsx's "Set Default Language"
// modal) and anywhere else that needs to show a language's flag/label (e.g.
// the ad space card's language button in codeDisplay.tsx).
export const LANGUAGES = [
  { value: 'english',     label: 'English',            flag: '🇬🇧' },
  { value: 'french',      label: 'French (Français)',  flag: '🇫🇷' },
  { value: 'kinyarwanda', label: 'Kinyarwanda',        flag: '🇷🇼' },
  { value: 'kiswahili',   label: 'Swahili',            flag: '🇹🇿' },
  { value: 'chinese',     label: 'Chinese (中文)',      flag: '🇨🇳' },
  { value: 'spanish',     label: 'Spanish (Español)',  flag: '🇪🇸' },
] as const;

export function getLanguageFlag(value?: string | null): string {
  return LANGUAGES.find((l) => l.value === (value || '').toLowerCase())?.flag || '🌐';
}

export function getLanguageLabel(value?: string | null): string {
  return LANGUAGES.find((l) => l.value === (value || '').toLowerCase())?.label || 'English';
}
