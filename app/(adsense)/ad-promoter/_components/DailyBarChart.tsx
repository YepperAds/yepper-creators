// Shared bar chart for a continuous { date, value } series (see
// buildDailySeries in app/_lib/daily-series.ts) — used by the full
// per-website Analytics panel and the compact per-ad audience snapshot.
export default function DailyBarChart({
  series,
  height = 112,
  barColor = 'bg-white hover:bg-zinc-400',
}: {
  series: { date: string; value: number }[];
  height?: number;
  barColor?: string;
}) {
  const max = Math.max(...series.map((d) => d.value), 1);
  return (
    <div>
      <div className="flex items-end gap-px" style={{ height }}>
        {series.map((d, i) => (
          <div key={i} className="flex-1 h-full group relative flex flex-col justify-end">
            <div
              style={{ height: `${(d.value / max) * 100}%` }}
              className={`w-full transition-colors min-h-[2px] rounded-t-sm ${barColor}`}
            />
            <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs bg-black text-[#fff] px-1 py-0.5 opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none z-10">
              {d.value}
            </span>
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-2 text-xs text-muted">
        <span>{series[0]?.date}</span>
        <span>{series[series.length - 1]?.date}</span>
      </div>
    </div>
  );
}
