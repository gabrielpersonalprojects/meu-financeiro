export const pad2 = (n: number) => String(n).padStart(2, "0");

export const addMonths = (base: Date, delta: number) => {
  const d = new Date(base);
  d.setDate(1);
  d.setMonth(d.getMonth() + delta);
  return d;
};

export const parseISODateLocal = (iso: string) => {
  const [y, m, d] = String(iso || "").split("-").map(Number);
  if (!y || !m || !d) return new Date(NaN);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
};

export const clampDay = (year: number, monthIndex0: number, day: number) => {
  const lastDay = new Date(year, monthIndex0 + 1, 0).getDate();
  return Math.max(1, Math.min(day, lastDay));
};

export const makeDate = (year: number, monthIndex0: number, day: number) => {
  const dd = clampDay(year, monthIndex0, day);
  return new Date(year, monthIndex0, dd, 12, 0, 0, 0);
};

export const formatDateOnlyISO = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const getInvoiceMonthKeyForTransaction = ({
  iso,
  diaFechamento,
  diaVencimento,
}: {
  iso: string;
  diaFechamento: number;
  diaVencimento: number;
}) => {
  const dt = parseISODateLocal(iso);
  if (Number.isNaN(dt.getTime())) return "";

  const fechamento = Math.max(1, Math.min(31, Number(diaFechamento ?? 1)));
  const vencimento = Math.max(1, Math.min(31, Number(diaVencimento ?? 1)));
  const invoiceOffset = vencimento > fechamento ? 0 : 1;

  const base = new Date(dt.getFullYear(), dt.getMonth(), 1, 12, 0, 0, 0);

  // O dia do fechamento ainda pertence à fatura atual.
  // A próxima fatura começa no dia seguinte ao fechamento.
  if (dt.getDate() >= fechamento) {
    base.setMonth(base.getMonth() + 1);
  }

  base.setMonth(base.getMonth() + invoiceOffset);

  return `${base.getFullYear()}-${pad2(base.getMonth() + 1)}`;
};