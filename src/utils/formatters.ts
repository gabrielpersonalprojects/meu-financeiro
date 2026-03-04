
export const formatarMoeda = (valor: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(valor);
};

export const formatarData = (data: string): string => {
  if (!data || typeof data !== 'string') return '';
  const parts = data.split('-');
  if (parts.length !== 3) return data;
  const [ano, mes, dia] = parts;
  return `${dia}/${mes}/${ano}`;
};

export const getMesAnoExtenso = (dataStr: string): string => {
  if (!dataStr || typeof dataStr !== 'string') return '';
  const parts = dataStr.split('-');
  if (parts.length < 2) return dataStr;
  
  const ano = parseInt(parts[0]);
  const mes = parseInt(parts[1]);
  
  if (isNaN(ano) || isNaN(mes)) return dataStr;
  
  const data = new Date(ano, mes - 1);
  return data.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
};

export const extrairValorMoeda = (valor: string): number => {
  const s = String(valor ?? "").trim();
  if (!s) return 0;

  // mantém só dígitos, ponto, vírgula e sinal
  const cleaned = s.replace(/[^\d.,-]/g, "");
  const sign = cleaned.startsWith("-") ? -1 : 1;

  const hasSep = cleaned.includes(",") || cleaned.includes(".");

  // Caso 1: veio só dígitos (máscara) -> "13" = 0.13, "1400" = 14.00
  if (!hasSep) {
    const digits = cleaned.replace(/\D/g, "");
    const cents = Number(digits || "0");
    return sign * (cents / 100);
  }

  // Caso 2: veio formatado -> usa o último separador como decimal
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  const lastSep = Math.max(lastComma, lastDot);

  const intPart = cleaned.slice(0, lastSep).replace(/\D/g, "");
  const decPart = cleaned.slice(lastSep + 1).replace(/\D/g, "").slice(0, 2);

  const numStr = `${sign < 0 ? "-" : ""}${intPart || "0"}.${(decPart || "0").padEnd(2, "0")}`;
  const n = Number(numStr);
  return Number.isFinite(n) ? n : 0;
};
