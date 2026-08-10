// Shared list of ad-space default languages: one source of truth for the
// language picker (website/[websiteId]/page.tsx's "Set Default Language"
// modal) and anywhere else that needs to show a language's flag/label (e.g.
// the ad space card's language button in codeDisplay.tsx).
//
// Flags are real images (public/flags/<code>.png), not emoji: Windows has no
// color-flag glyphs in its emoji font, so 🇬🇧/🇫🇷/etc. silently fall back to
// rendering as plain two-letter text ("GB", "FR", ...) instead of a flag on
// every Windows browser, regardless of how the emoji is embedded.
export const LANGUAGES = [
  { value: 'english',     label: 'English',            flagCode: 'gb' },
  { value: 'french',      label: 'French (Français)',  flagCode: 'fr' },
  { value: 'kinyarwanda', label: 'Kinyarwanda',        flagCode: 'rw' },
  { value: 'kiswahili',   label: 'Swahili',            flagCode: 'tz' },
  { value: 'chinese',     label: 'Chinese (中文)',      flagCode: 'cn' },
  { value: 'spanish',     label: 'Spanish (Español)',  flagCode: 'es' },
] as const;

export function getLanguageFlagUrl(value?: string | null): string {
  const code = LANGUAGES.find((l) => l.value === (value || '').toLowerCase())?.flagCode;
  return `/flags/${code || 'gb'}.png`;
}

export function getLanguageLabel(value?: string | null): string {
  return LANGUAGES.find((l) => l.value === (value || '').toLowerCase())?.label || 'English';
}
