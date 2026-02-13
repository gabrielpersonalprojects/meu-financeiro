// src/domain/credit/invoiceCycle.ts
export type InvoiceRange = {
  start: Date; // início da fatura (inclusive)
  end: Date;   // fechamento da fatura (inclusive)
  closingDate: Date;
};

function daysInMonth(year: number, month0: number) {
  return new Date(year, month0 + 1, 0).getDate();
}

function clampDay(year: number, month0: number, day: number) {
  return Math.min(day, daysInMonth(year, month0));
}

function makeDate(y: number, m0: number, d: number) {
  return new Date(y, m0, clampDay(y, m0, d), 12, 0, 0, 0);
}

function addMonths(d: Date, delta: number) {
  const y = d.getFullYear();
  const m0 = d.getMonth() + delta;
  const day = d.getDate();
  const base = new Date(y, m0, 1, 12, 0, 0, 0);
  return makeDate(base.getFullYear(), base.getMonth(), day);
}

export function getInvoiceRange(today: Date, closingDay: number): InvoiceRange {
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0, 0, 0);

  // se hoje (dia) <= fechamento => fechamento é neste mês; senão, no próximo mês
  const closingThisMonth = makeDate(t.getFullYear(), t.getMonth(), closingDay);
  const closingDate = t.getDate() <= closingDay ? closingThisMonth : addMonths(closingThisMonth, 1);

  const prevClosing = addMonths(closingDate, -1);
  const start = new Date(prevClosing.getFullYear(), prevClosing.getMonth(), prevClosing.getDate() + 1, 0, 0, 0, 0);
  const end = new Date(closingDate.getFullYear(), closingDate.getMonth(), closingDate.getDate(), 23, 59, 59, 999);

  return { start, end, closingDate };
}

export function computeDueDate(closingDate: Date, dueDay: number) {
  // vencimento normalmente no mês seguinte ao fechamento
  const nextMonth = addMonths(closingDate, 1);
  return makeDate(nextMonth.getFullYear(), nextMonth.getMonth(), dueDay);
}

export function isBetween(d: Date, start: Date, end: Date) {
  const x = d.getTime();
  return x >= start.getTime() && x <= end.getTime();
}

type DateInput = Date | string | number | null | undefined;

function toValidDate(input: DateInput): Date | null {
  if (!input) return null;

  // Já é Date
  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? null : input;
  }

  // Timestamp (ms)
  if (typeof input === "number") {
    const d = new Date(input);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // String (ISO, ou "dd/mm/aaaa", etc)
  if (typeof input === "string") {
    const s = input.trim();
    if (!s) return null;

    // tenta Date padrão (ISO costuma funcionar)
    let d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d;

    // tenta dd/mm/aaaa
    const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) {
      const dd = Number(m[1]);
      const mm = Number(m[2]);
      const yyyy = Number(m[3]);
      d = new Date(yyyy, mm - 1, dd);
      return Number.isNaN(d.getTime()) ? null : d;
    }

    return null;
  }

  return null;
}

export function formatBR(input: DateInput): string {
  const d = toValidDate(input);
  if (!d) return "--/--/----";
  return new Intl.DateTimeFormat("pt-BR").format(d);
}

