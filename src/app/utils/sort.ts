// src/app/utils/sort.ts

export const sortStringsAsc = (items: string[]) => {
  // mantém o comportamento do .sort() padrão (ordem lexicográfica)
  return [...items].sort();
};

export const sortByValueDesc = <T extends { value: number }>(items: T[]) => {
  return [...items].sort((a, b) => b.value - a.value);
};
