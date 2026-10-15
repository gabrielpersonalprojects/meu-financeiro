const normalizeSearch = (value: string) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();

export const getDescriptionMatches = (
  value: string,
  suggestions: string[],
  limit = 6
) => {
  const query = normalizeSearch(value);
  if (!query) return [];

  const seen = new Set<string>();

  return suggestions
    .map((label, order) => ({
      label: String(label ?? "").trim(),
      normalized: normalizeSearch(label),
      order,
    }))
    .filter((item) => {
      if (
        !item.label ||
        item.normalized === query ||
        !item.normalized.includes(query) ||
        seen.has(item.normalized)
      ) {
        return false;
      }
      seen.add(item.normalized);
      return true;
    })
    .sort((a, b) => {
      const aStarts = a.normalized.startsWith(query) ? 0 : 1;
      const bStarts = b.normalized.startsWith(query) ? 0 : 1;
      return aStarts - bStarts || a.order - b.order;
    })
    .slice(0, limit)
    .map((item) => item.label);
};
