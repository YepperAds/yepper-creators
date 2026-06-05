'use client';

import { useState, useEffect, useRef } from 'react';
import { XMarkIcon } from '@heroicons/react/24/solid';
import {
  Cog6ToothIcon,
  PaintBrushIcon,
  BellIcon,
  LockClosedIcon,
  MegaphoneIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';

// ─────────────────────────────────────────────────────────────────────────────
// Settings Modal — Google Meet style two-panel layout
// Left: vertical tab list | Right: tab content
// ─────────────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'general',       label: 'General',       icon: Cog6ToothIcon },
  { id: 'appearance',    label: 'Appearance',    icon: PaintBrushIcon },
  { id: 'notifications', label: 'Notifications', icon: BellIcon },
  { id: 'privacy',       label: 'Privacy',       icon: LockClosedIcon },
  { id: 'campaigns',     label: 'Campaigns',     icon: MegaphoneIcon },
  { id: 'account',       label: 'Account',       icon: UserCircleIcon },
] as const;

type TabId = typeof TABS[number]['id'];

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

// ── Helper: toggle row ────────────────────────────────────────────────────────
function Toggle({ label, description, defaultOn = false }: { label: string; description?: string; defaultOn?: boolean }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <div className="flex items-center justify-between py-3 border-b border-(--color-border) last:border-0">
      <div>
        <p className="text-sm font-medium text-(--color-white)">{label}</p>
        {description && <p className="text-xs text-(--color-muted) mt-0.5">{description}</p>}
      </div>
      <button
        onClick={() => setOn(!on)}
        className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${on ? 'bg-(--color-subtle)' : 'bg-(--color-surface-3)'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${on ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </div>
  );
}

// ── Helper: select row ────────────────────────────────────────────────────────
function SelectRow({ label, options, defaultValue }: { label: string; options: string[]; defaultValue?: string }) {
  const [val, setVal] = useState(defaultValue ?? options[0]);
  return (
    <div className="flex items-center justify-between py-3 border-b border-(--color-border) last:border-0">
      <p className="text-sm font-medium text-(--color-white)">{label}</p>
      <select
        value={val}
        onChange={e => setVal(e.target.value)}
        className="bg-(--color-surface-3) border border-(--color-border) text-(--color-white) text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-(--color-subtle) transition-all"
      >
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

// ── Tab content panels ────────────────────────────────────────────────────────
function GeneralPanel() {
  return (
    <div>
      <h3 className="text-xs font-bold text-(--color-muted) uppercase tracking-wider mb-3">Language & Region</h3>
      <SelectRow label="Language" options={['English', 'French', 'Arabic', 'Spanish', 'German']} defaultValue="English" />
      <SelectRow label="Timezone" options={['UTC+0', 'UTC+1 (Paris)', 'UTC+2 (Cairo)', 'UTC−5 (New York)', 'UTC+8 (Singapore)']} defaultValue="UTC+1 (Paris)" />
      <SelectRow label="Date format" options={['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']} defaultValue="DD/MM/YYYY" />

      <h3 className="text-xs font-bold text-(--color-muted) uppercase tracking-wider mb-3 mt-6">Startup</h3>
      <Toggle label="Open dashboard on launch" defaultOn={true} />
      <Toggle label="Remember last visited page" defaultOn={true} />
    </div>
  );
}

function AppearancePanel() {
  return (
    <div>
      <h3 className="text-xs font-bold text-(--color-muted) uppercase tracking-wider mb-3">Theme</h3>
      <SelectRow label="Color scheme" options={['System default', 'Dark', 'Light']} defaultValue="System default" />
      <SelectRow label="Accent color" options={['Default', 'Blue', 'Purple', 'Rose', 'Amber']} defaultValue="Default" />

      <h3 className="text-xs font-bold text-(--color-muted) uppercase tracking-wider mb-3 mt-6">Layout</h3>
      <Toggle label="Compact sidebar" description="Use smaller padding in the sidebar" />
      <Toggle label="Show labels in collapsed sidebar" description="Display shortened labels under icons" />
    </div>
  );
}

function NotificationsPanel() {
  return (
    <div>
      <h3 className="text-xs font-bold text-(--color-muted) uppercase tracking-wider mb-3">Push Notifications</h3>
      <Toggle label="Campaign performance alerts" defaultOn={true} />
      <Toggle label="New deal available" defaultOn={true} />
      <Toggle label="Weekly digest email" description="Summary of your campaigns every Monday" defaultOn={false} />

      <h3 className="text-xs font-bold text-(--color-muted) uppercase tracking-wider mb-3 mt-6">In-App Alerts</h3>
      <Toggle label="Show notification badge" defaultOn={true} />
      <Toggle label="Sound on new notification" defaultOn={false} />
    </div>
  );
}

function PrivacyPanel() {
  return (
    <div>
      <h3 className="text-xs font-bold text-(--color-muted) uppercase tracking-wider mb-3">Data & Privacy</h3>
      <Toggle label="Share usage analytics" description="Help improve Yepper by sending anonymous data" defaultOn={true} />
      <Toggle label="Personalized recommendations" description="Use your campaign data to tailor suggestions" defaultOn={true} />
      <Toggle label="Allow cookies" defaultOn={true} />

      <h3 className="text-xs font-bold text-(--color-muted) uppercase tracking-wider mb-3 mt-6">Account Security</h3>
      <Toggle label="Two-factor authentication" description="Require a code when signing in" defaultOn={false} />
      <Toggle label="Login activity alerts" description="Get notified of sign-ins from new devices" defaultOn={true} />
    </div>
  );
}

function CampaignsPanel() {
  return (
    <div>
      <h3 className="text-xs font-bold text-(--color-muted) uppercase tracking-wider mb-3">Defaults</h3>
      <SelectRow label="Default campaign duration" options={['7 days', '14 days', '30 days', '60 days', '90 days']} defaultValue="30 days" />
      <SelectRow label="Default budget currency" options={['USD', 'EUR', 'GBP', 'MAD', 'AED']} defaultValue="USD" />

      <h3 className="text-xs font-bold text-(--color-muted) uppercase tracking-wider mb-3 mt-6">Automation</h3>
      <Toggle label="Auto-pause low-performing campaigns" description="Pause when CTR drops below threshold" defaultOn={false} />
      <Toggle label="Auto-renew expired campaigns" defaultOn={false} />
      <Toggle label="Budget alerts at 80% spend" defaultOn={true} />
    </div>
  );
}

function AccountPanel() {
  return (
    <div>
      <h3 className="text-xs font-bold text-(--color-muted) uppercase tracking-wider mb-3">Profile</h3>
      <div className="py-3 border-b border-(--color-border) flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-(--color-surface-3) border border-(--color-border) flex items-center justify-center text-lg font-bold text-(--color-white)">
          Y
        </div>
        <div>
          <p className="text-sm font-medium text-(--color-white)">Your Name</p>
          <p className="text-xs text-(--color-muted)">your@email.com</p>
        </div>
        <button className="ml-auto text-xs text-(--color-subtle) hover:text-(--color-white) transition-colors font-medium">Edit profile</button>
      </div>

      <h3 className="text-xs font-bold text-(--color-muted) uppercase tracking-wider mb-3 mt-6">Danger Zone</h3>
      <div className="py-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-(--color-white)">Delete account</p>
          <p className="text-xs text-(--color-muted) mt-0.5">Permanently remove your account and data</p>
        </div>
        <button className="text-xs font-semibold text-red-400 hover:text-red-300 border border-red-900/50 hover:border-red-700 px-3 py-1.5 rounded-lg transition-all">
          Delete
        </button>
      </div>
    </div>
  );
}

const PANEL_MAP: Record<TabId, React.FC> = {
  general: GeneralPanel,
  appearance: AppearancePanel,
  notifications: NotificationsPanel,
  privacy: PrivacyPanel,
  campaigns: CampaignsPanel,
  account: AccountPanel,
};

// ── Main Modal ────────────────────────────────────────────────────────────────
export default function SettingsModal({ open, onClose }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>('general');
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Prevent body scroll while open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  const ActivePanel = PANEL_MAP[activeTab];

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={e => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="relative flex w-[760px] max-w-[95vw] h-[520px] max-h-[90vh] rounded-2xl overflow-hidden shadow-2xl border border-(--color-border) bg-(--color-surface-1) animate-in zoom-in-95 duration-150">

        {/* ── LEFT: Tab list ─────────────────────────────────────────────── */}
        <div className="w-[220px] shrink-0 border-r border-(--color-border) bg-(--color-surface-2) flex flex-col">
          <div className="px-5 pt-5 pb-4">
            <h2 className="text-base font-semibold text-(--color-white)">Settings</h2>
          </div>
          <nav className="flex-1 px-2 pb-4 flex flex-col gap-0.5">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left ${
                    active
                      ? 'bg-(--color-surface-3) text-(--color-white)'
                      : 'text-(--color-white) opacity-70 hover:opacity-100 hover:bg-(--color-surface-3)'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-(--color-subtle)' : ''}`} />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* ── RIGHT: Content panel ────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Panel header */}
          <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-(--color-border)">
            <h3 className="text-sm font-semibold text-(--color-white)">
              {TABS.find(t => t.id === activeTab)?.label}
            </h3>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-(--color-surface-3) text-(--color-muted) hover:text-(--color-white) transition-colors"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <ActivePanel />
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-(--color-border) flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg text-sm font-medium text-(--color-white) opacity-70 hover:opacity-100 hover:bg-(--color-surface-3) transition-all"
            >
              Cancel
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg text-sm font-semibold bg-(--color-subtle) text-white hover:opacity-90 transition-opacity"
            >
              Save changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
