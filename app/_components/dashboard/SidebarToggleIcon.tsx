// Sidebar-collapse glyph: a panel outline with a divider near the left
// edge, the standard "toggle sidebar" icon (VS Code, Notion, Linear, ...).
// Heroicons doesn't have this shape, so it's hand-drawn; same icon either
// way the sidebar is currently collapsed, it doesn't flip direction.
// Shared by LeftRail and RightRail so both collapse toggles match.
export default function SidebarToggleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3v18" />
    </svg>
  );
}
