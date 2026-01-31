import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Transaction } from "../types";

import { limparFiltros } from "./filter";
import { passarFiltroConta as passarFiltroContaLogic } from "./logic";

type FilterSetters = {
  setFiltroMes: Dispatch<SetStateAction<string>>;
  setFiltroLancamento: Dispatch<SetStateAction<"despesa" | "receita" | "todos">>;
  setFiltroCategoria: Dispatch<SetStateAction<string>>;
  setFiltroMetodo: Dispatch<SetStateAction<string>>;
  setFiltroTipoGasto: Dispatch<SetStateAction<string>>;
};

export function useFilterActions(args: {
  filtroConta: string | null | undefined;
  activeProfileId: string;
  setters: FilterSetters;
}) {
  const { filtroConta, activeProfileId, setters } = args;

  const handleLimparFiltros = useCallback(() => {
    limparFiltros(setters);
  }, [setters]);

  const passarFiltroConta = useCallback(
    (t: Transaction) => {
      return passarFiltroContaLogic(t, filtroConta, activeProfileId);
    },
    [filtroConta, activeProfileId]
  );

  return { handleLimparFiltros, passarFiltroConta };
}
