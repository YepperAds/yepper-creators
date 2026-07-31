// Backend day-count endpoints only return days that actually had traffic:
// with a sparse or short history that's 2-3 entries, which a `flex-1` bar
// chart renders as a couple of giant blocks rather than a real chart. This
// fills in every day across the selected range (as 0) so the chart always
// has one thin bar per day, whatever the underlying data density.
export function buildDailySeries(
  byDay: Array<Record<string, unknown>>,
  rangeDays: number,
  countKey: string,
): { date: string; value: number }[] {
  const map = new Map(byDay.map((d) => [String(d.date), Number(d[countKey]) || 0]));
  const series: { date: string; value: number }[] = [];
  const today = new Date();
  for (let i = rangeDays - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    series.push({ date: key, value: map.get(key) ?? 0 });
  }
  return series;
}
