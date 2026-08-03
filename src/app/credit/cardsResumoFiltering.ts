export type CardsResumoItemFilterValues = {
  month: string;
  cardId: string;
  category: string;
  tag: string;
  searchMatches: boolean;
};

export type CardsResumoSelectedFilters = {
  month: string;
  cardId: string;
  category: string;
  tag: string;
};

export const matchesCardsResumoFilters = (
  item: CardsResumoItemFilterValues,
  selected: CardsResumoSelectedFilters
) =>
  (!selected.month || item.month === selected.month) &&
  (selected.cardId === "todos" || item.cardId === selected.cardId) &&
  (selected.category === "todas" || item.category === selected.category) &&
  (selected.tag === "todas" || item.tag === selected.tag) &&
  item.searchMatches;

export const summarizeFilteredCardsResumo = <T>(
  filteredItems: readonly T[],
  getCardId: (item: T) => string,
  getValue: (item: T) => number
) => {
  const groups = new Map<string, { items: T[]; total: number }>();
  let total = 0;

  for (const item of filteredItems) {
    const cardId = getCardId(item);
    if (!cardId) continue;

    const value = Math.abs(Number(getValue(item) || 0));
    const current = groups.get(cardId) ?? { items: [], total: 0 };
    groups.set(cardId, {
      items: [...current.items, item],
      total: current.total + value,
    });
    total += value;
  }

  return { groups, total, count: filteredItems.length };
};
