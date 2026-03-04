export function shiftYm(ym: string, deltaMonths: number) {
  const base = String(ym ?? "").slice(0, 7); // garante YYYY-MM
  const [yStr, mStr] = base.split("-");
  const y = Number(yStr);
  const m = Number(mStr);

  if (!y || !m) return base || String(ym ?? "");

  const d = new Date(y, m - 1 + deltaMonths, 1);
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${yy}-${mm}`;
}