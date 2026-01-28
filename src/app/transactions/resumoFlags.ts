export function getResumoFlags(filtroLancamento: string) {
  return {
    mostrarReceitasResumo: filtroLancamento !== "despesa",
    mostrarDespesasResumo: filtroLancamento !== "receita",
  };
}
