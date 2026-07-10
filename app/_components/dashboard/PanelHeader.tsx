// Shared title treatment for every dashboard panel (Hot Deals, Notifications,
// Wallet, Analytics, Profile, ...) so they read as one consistent system
// instead of each page inventing its own heading style.
export default function PanelHeader({
  title,
  subtitle,
  action,
  align = 'center',
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  align?: 'center' | 'left';
}) {
  if (align === 'left') {
    return (
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        </div>
        {action}
      </div>
    );
  }

  return (
    <div className="mb-8 text-center">
      <h1 className="text-xl sm:text-2xl font-bold text-white">{title}</h1>
      {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
    </div>
  );
}
