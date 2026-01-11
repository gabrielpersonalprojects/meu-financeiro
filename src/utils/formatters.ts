
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
  if (!valor) return 0;
  const cleanValue = valor.replace(/\./g, '').replace(',', '.');
  return parseFloat(cleanValue) || 0;
};
