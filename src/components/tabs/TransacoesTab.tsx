import type { ReactNode } from "react";
import CustomDateInput from "../CustomDateInput";
import CustomDropdown from "../CustomDropdown";
import { TransactionsList } from "../TransactionsList";
import TransactionItem from "../TransactionItem";
import { EditIcon, TrashIcon } from "../LucideIcons";

import { formatarMoeda, formatarData } from "../../utils/formatters";
import { getContaBadge, getContaLabel } from "../../domain";
import { asId } from "../../utils/asId";
import { getContaPartsById } from "../../app/transactions/logic";

const isPaid = (v: any) => {
  const s = String(v ?? "").toLowerCase();
  return v === true || v === 1 || s === "1" || s === "true" || s === "pago";
};

type Props = {
  filtroMes: string;
  setFiltroMes: (v: string) => void;

  filtroLancamento: string; // "todos" | "receita" | "despesa"
  setFiltroLancamento: (v: any) => void;

  filtroConta: string;
  setFiltroConta: (v: string) => void;

  filtroCategoria: string;
  setFiltroCategoria: (v: string) => void;

  categoriasFiltradasTransacoes: string[];

  filtroTipoGasto: string;
  setFiltroTipoGasto: (v: string) => void;

  handleLimparFiltros: () => void;

  profiles: any[];
  renderContaOptionLabel: (p: any) => ReactNode;

  mostrarReceitasResumo: boolean;
  mostrarDespesasResumo: boolean;
  totalFiltradoReceitas: number;
  totalFiltradoDespesas: number;

  anoRef: number | string;
  totalAnualReceitas: number;
  totalAnualDespesas: number;

  itemsFiltrados: any[];
  transactions: any[];

  hojeStr: string;
  togglePago: (id: any) => void;

  handleEditClick: (t: any) => void;
  confirmDelete: (t: any) => void;

  // ✅ NOVO: cards de resumo abaixo dos filtros (opcional)
  stats?: {
    saldoTotal: number;
    receitasMes: number;
    despesasMes: number;
    pendenteReceita: number;
    pendenteDespesa: number;
  };
};

export default function TransacoesTab({
  filtroMes,
  setFiltroMes,

  filtroLancamento,
  setFiltroLancamento,

  filtroConta,
  setFiltroConta,

  filtroCategoria,
  setFiltroCategoria,

  categoriasFiltradasTransacoes,

  filtroTipoGasto,
  setFiltroTipoGasto,

  handleLimparFiltros,

  profiles,
  renderContaOptionLabel,

  mostrarReceitasResumo,
  mostrarDespesasResumo,
  totalFiltradoReceitas,
  totalFiltradoDespesas,

  anoRef,
  totalAnualReceitas,
  totalAnualDespesas,

  itemsFiltrados,
  transactions,

  hojeStr,
  togglePago,

  handleEditClick,
  confirmDelete,

  stats,
}: Props) {
  const getFilteredTransactions = (itemsFiltrados || []).filter((t: any) => {
    const tipo = String(t?.tipo ?? "").toLowerCase();

    // mantém: não mostrar transações internas de cartão nessa lista
    if (tipo === "cartao_credito") return false;

    // novo: filtro do dropdown (Entradas/Saídas/Transferências/Todos)
    if (filtroLancamento === "todos") return true;

    if (filtroLancamento === "receita") return tipo === "receita";

    if (filtroLancamento === "despesa") return tipo === "despesa";

    if (filtroLancamento === "transferencia") {
      // cobre modelos antigos e novos
      return (
        tipo === "transferencia" ||
        Boolean(t?.transferId) ||
        Boolean(t?.transferenciaId) ||
        Boolean(t?.transfer_id) ||
        Boolean(t?.transferencia_id)
      );
    }

    return true;
  });

  const isFiltroTransferencias = filtroLancamento === "transferencia";
  const isGeral = !filtroConta || String(filtroConta).toLowerCase() === "todas";
  const contaSelecionada = isGeral
    ? "Geral"
    : profiles.find((p: any) => String(p?.id) === String(filtroConta))?.name ?? "Conta";

  const badgeLabel = contaSelecionada;

  const ContaBadge = ({ label }: { label: string }) => (
    <span
      className="
        inline-flex items-center gap-2
        px-2.5 py-1 rounded-full
        text-[10px] font-extrabold uppercase tracking-wider
        border border-slate-200/80
        bg-white text-slate-900
        dark:border-white/15 dark:bg-black/25 dark:text-white
        backdrop-blur-xl shadow-sm
      "
      title={`Filtro de conta: ${label}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-violet-600 dark:bg-violet-300" />
      {label}
    </span>
  );

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 pb-6 border-b border-slate-50 dark:border-slate-800">
        {/* Barra de filtros */}
        <div className="w-full overflow-visible grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
          <div className="w-full lg:col-span-3">
            <CustomDateInput type="month" value={filtroMes} onChange={setFiltroMes} className="w-full" />
          </div>

          <div className="w-full lg:col-span-3">
            <CustomDropdown
              placeholder="Lançamento"
              value={
                filtroLancamento === "todos"
                  ? "Entradas + Saídas"
                  : filtroLancamento === "receita"
                  ? "Somente Entradas"
                  : filtroLancamento === "despesa"
                  ? "Somente Saídas"
                  : "Transferências"
              }
              options={["Entradas + Saídas", "Somente Entradas", "Somente Saídas", "Transferências"]}
              onSelect={(val) => {
                if (val === "Somente Entradas") setFiltroLancamento("receita");
                else if (val === "Somente Saídas") setFiltroLancamento("despesa");
                else if (val === "Transferências") setFiltroLancamento("transferencia");
                else setFiltroLancamento("todos");
              }}
              className="w-full"
            />
          </div>

          {!isFiltroTransferencias && (
            <>
              <div className="w-full lg:col-span-3">
                <CustomDropdown
                  placeholder="Conta"
                  value={filtroConta}
                  options={[
                    {
                      label: (
                        <span className="inline-flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-600/25 text-indigo-300 border border-indigo-500/20">
                            TODAS
                          </span>
                          <span className="text-slate-100">as contas</span>
                        </span>
                      ),
                      value: "todas",
                    },
                    ...profiles.map((p) => ({ label: renderContaOptionLabel(p), value: p.id })),
                  ]}
                  onSelect={(val) => setFiltroConta(String(val))}
                  className="w-full"
                />
              </div>

              {filtroLancamento !== "todos" && (
                <div className="w-full lg:col-span-3">
                  <CustomDropdown
                    placeholder="Categorias"
                    value={filtroCategoria}
                    options={["Todas", ...categoriasFiltradasTransacoes]}
                    onSelect={(val) => setFiltroCategoria(val === "Todas" ? "" : val)}
                    className="w-full"
                  />
                </div>
              )}

              {filtroLancamento === "despesa" && (
                <div className="w-full lg:col-span-2">
                  <CustomDropdown
                    placeholder="Tipo Gasto"
                    value={filtroTipoGasto}
                    options={["Todos", "Fixo", "Variável"]}
                    onSelect={(val) => setFiltroTipoGasto(val === "Todos" ? "" : val)}
                    className="w-full"
                  />
                </div>
              )}
            </>
          )}

          <div className="w-full lg:col-span-2 lg:justify-self-end">
            <button
              type="button"
              onClick={handleLimparFiltros}
              className="h-10 w-full sm:w-auto px-4 rounded-xl
                border border-slate-200 dark:border-slate-700
                bg-white dark:bg-slate-900
                text-slate-700 dark:text-slate-200 text-sm font-semibold
                hover:bg-slate-50 dark:hover:bg-slate-800
                transition"
            >
              Limpar
            </button>
          </div>
        </div>

        {/* ✅ Cards abaixo dos filtros (somente se stats vier do App) */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
            {/* Saldo */}
            <div
              className="
                relative overflow-hidden rounded-2xl
                pt-8 px-8 pb-12
                shadow-xl flex flex-col justify-center min-h-[160px]
                text-white bg-gradient-to-r from-[#220055] to-[#4600ac]
                shadow-[0_18px_50px_-35px_rgba(70,0,172,0.9)]
              "
            >
              <div className="pointer-events-none absolute inset-0 bg-black/45" />
              <div className="pointer-events-none absolute inset-0 bg-black/20 backdrop-blur-xl" />
              <div className="pointer-events-none absolute top-24 -right-24 h-56 w-56 rounded-full bg-white/12 blur-3xl" />

              <div className="relative">
                <p className="text-[10px] font-black text-white/80 uppercase tracking-[0.25em] mb-4">
                  Saldo Disponível
                </p>

                <p className="text-4xl font-black text-white tracking-tight">
                  {formatarMoeda(stats.saldoTotal)}
                </p>
              </div>

              {/* Badge fora do fluxo do conteúdo (não quebra alinhamento) */}
              <div className="absolute bottom-4 left-8 z-10 translate-y-1">
                <ContaBadge label={badgeLabel} />
              </div>
            </div>

            {/* Entradas */}
            <div className="relative overflow-hidden rounded-2xl p-8 border border-slate-200/70 dark:border-slate-800/70 bg-white/80 dark:bg-slate-900/70 backdrop-blur-xl shadow-[0_18px_50px_-35px_rgba(0,0,0,0.35)] flex flex-col justify-center min-h-[160px]">
              <div className="pointer-events-none absolute top-24 -right-24 h-56 w-56 rounded-full bg-emerald-500/10 blur-3xl" />
              <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-4">
                Entradas (mês)
              </p>
              <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                {formatarMoeda(stats.receitasMes)}
              </p>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mt-1">
                Pendente:{" "}
                <span className="text-emerald-600 dark:text-emerald-400">
                  {formatarMoeda(stats.pendenteReceita)}
                </span>
              </p>
            </div>

            {/* Saídas */}
            <div className="relative overflow-hidden rounded-2xl p-8 border border-slate-200/70 dark:border-slate-800/70 bg-white/80 dark:bg-slate-900/70 backdrop-blur-xl shadow-[0_18px_50px_-35px_rgba(0,0,0,0.35)] flex flex-col justify-center min-h-[160px]">
              <div className="pointer-events-none absolute top-24 -right-24 h-56 w-56 rounded-full bg-rose-500/10 blur-3xl" />
              <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-4">
                Saídas (mês)
              </p>
              <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                {formatarMoeda(stats.despesasMes)}
              </p>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mt-1">
                Pendente:{" "}
                <span className="text-rose-600 dark:text-rose-400">
                  {formatarMoeda(stats.pendenteDespesa)}
                </span>
              </p>
            </div>
          </div>
        )}

        {/* Resumo mensal/anual */}
        <div className="flex flex-col gap-2 mt-4">
          <div className="flex flex-wrap items-center gap-3 text-[10px] uppercase tracking-wider">
            <span className="text-slate-400/80 dark:text-slate-500/80">Mensal</span>

            {mostrarReceitasResumo && (
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                +{formatarMoeda(totalFiltradoReceitas)}
              </span>
            )}

            {mostrarDespesasResumo && (
              <span className="font-semibold text-rose-600 dark:text-rose-400">
                -{formatarMoeda(totalFiltradoDespesas)}
              </span>
            )}

            <span className="mx-1 text-slate-400/50 dark:text-slate-600/50">•</span>

            <span className="text-slate-400/80 dark:text-slate-500/80">Anual ({anoRef})</span>

            {mostrarReceitasResumo && (
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                +{formatarMoeda(totalAnualReceitas)}
              </span>
            )}

            {mostrarDespesasResumo && (
              <span className="font-semibold text-rose-600 dark:text-rose-400">
                -{formatarMoeda(totalAnualDespesas)}
              </span>
            )}
          </div>
        </div>

        <div className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
          {getFilteredTransactions.length} Lançamentos Encontrados
        </div>
      </div>

      <div className="space-y-3">
        {getFilteredTransactions.length > 0 ? (
          <div className="space-y-3">
            <TransactionsList
              items={getFilteredTransactions}
              renderItem={(t) => {
                const paidRaw = (t as any)?.pago;
                const paidStr = String(paidRaw ?? "").toLowerCase();

                const paid =
                  paidRaw === true ||
                  paidRaw === 1 ||
                  paidStr === "1" ||
                  paidStr === "true" ||
                  paidStr === "pago";

                const atrasada = !paid && t.data < hojeStr;

                const isReceita = t.tipo === "receita";
                const baseBg = isReceita
                  ? "bg-emerald-50/20 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-700/20"
                  : "bg-rose-50/20 dark:bg-rose-900/10 border-rose-100 dark:border-rose-700/20";

                const glowAtraso = atrasada
                  ? "ring-2 ring-rose-400/60 dark:ring-rose-500/30 bg-rose-50/25 dark:bg-rose-500/10 shadow-[0_0_26px_rgba(244,63,94,0.28)]"
                  : "";

                // ===== FUSÃO VISUAL DE TRANSFERÊNCIA (1 card só) =====
                const transferId = (t as any).transferId as string | undefined;
                const isTransfer =
                  Boolean(transferId) ||
                  String((t as any).categoria || "").toLowerCase().includes("transfer");

                let origemLabel = "";
                let destinoLabel = "";
                let origemBadge = "";
                let destinoBadge = "";
                let valorAbs = 0;

                if (isTransfer) {
                  const legs = (transactions || []).filter(
                    (x: any) => String(x?.transferId ?? "") === String(transferId ?? "")
                  ) as any[];

                  if (!legs || legs.length < 2) {
                    return (
                      <TransactionItem
                        key={String((t as any)?.id ?? "")}
                        t={t}
                        profiles={profiles}
                        hojeStr={hojeStr}
                        togglePago={togglePago}
                        formatarData={formatarData}
                        formatarMoeda={formatarMoeda}
                        getContaPartsById={getContaPartsById}
                        onEdit={handleEditClick}
                        onDelete={confirmDelete}
                      />
                    );
                  }

                  const saida =
                    legs.find((x: any) => String(x?.tipo) === "despesa") ??
                    legs.find((x: any) => Number(x?.valor ?? 0) < 0) ??
                    legs[0];

                  const entrada =
                    legs.find((x: any) => String(x?.tipo) === "receita") ??
                    legs.find((x: any) => Number(x?.valor ?? 0) > 0 && String(x?.id) !== String(saida?.id)) ??
                    legs.find((x: any) => String(x?.id) !== String(saida?.id)) ??
                    legs[1];

                  const saidaId = String(saida?.id ?? "");
                  const entradaId = String(entrada?.id ?? "");
                  const tId = String((t as any)?.id ?? "");

                  const saidaInList = getFilteredTransactions.some((x: any) => String(x?.id) === saidaId);
                  const entradaInList = getFilteredTransactions.some((x: any) => String(x?.id) === entradaId);

                  if (saidaInList && entradaInList) {
                    if (tId !== saidaId) return null;
                  }

                  if (saidaInList && !entradaInList) {
                    if (tId !== saidaId) return null;
                  }
                  if (!saidaInList && entradaInList) {
                    if (tId !== entradaId) return null;
                  }

                  const sourceIds = [saida?.id, entrada?.id].filter(Boolean).map((x) => String(x));

                  const paidTransfer = isPaid(saida?.pago) && isPaid(entrada?.pago);

                  const fromId = asId(
                    (saida as any).contaOrigemId ??
                      (saida as any).transferFromId ??
                      (saida as any).profileId ??
                      ""
                  );

                  const toId = asId(
                    (saida as any).contaDestinoId ??
                      (saida as any).transferToId ??
                      (entrada as any)?.profileId ??
                      ""
                  );

                  const contaOrigem = profiles.find((p: any) => asId(p.id) === fromId);
                  const contaDestino = profiles.find((p: any) => asId(p.id) === toId);

                  origemLabel = contaOrigem ? getContaLabel(contaOrigem) : "Origem";
                  destinoLabel = contaDestino ? getContaLabel(contaDestino) : "Destino";
                  origemBadge = contaOrigem ? getContaBadge(contaOrigem) : "";
                  destinoBadge = contaDestino ? getContaBadge(contaDestino) : "";

                  valorAbs = Math.abs(Number((saida as any).valor ?? 0));

                  return (
                    <div
                      key={`tr-${transferId}`}
                      className="
                        group flex items-center justify-between p-4 rounded-2xl border transition-all
                        bg-white/70 border-slate-200/70 shadow-sm
                        dark:bg-slate-900/40 dark:border-violet-500/20 dark:shadow-lg dark:shadow-black/20
                        hover:bg-white/90 dark:hover:bg-slate-900/55
                      "
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <button
                          type="button"
                          onClick={() => togglePago({ _sourceIds: sourceIds })}
                          className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold transition-all ${
                            paidTransfer
                              ? "bg-indigo-600 border-indigo-600 text-white shadow-[0_10px_30px_-18px_rgba(79,70,229,0.85)]"
                              : "bg-transparent border-slate-300 dark:border-slate-700 text-slate-400"
                          }`}
                          title={paidTransfer ? "Marcar como pendente" : "Marcar como pago"}
                        >
                          {paidTransfer ? "✓" : ""}
                        </button>

                        <div className="min-w-0">
                          <p className="font-bold leading-none text-slate-900 dark:text-slate-100">
                            {(saida as any).descricao || "Transferência"}
                          </p>

                          <div className="mt-1 flex items-center gap-2 flex-wrap text-[12px]">
                            <span
                              className="
                                px-2 py-1 rounded-full font-semibold
                                bg-rose-500/10 text-rose-700 border border-rose-500/15
                                dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/20
                              "
                            >
                              {origemBadge ? `${origemBadge} · ` : ""}
                              {origemLabel}
                            </span>

                            <span className="font-bold text-slate-500 dark:text-violet-300">↔</span>

                            <span
                              className="
                                px-2 py-1 rounded-full font-semibold
                                bg-emerald-500/10 text-emerald-700 border border-emerald-500/15
                                dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20
                              "
                            >
                              {destinoBadge ? `${destinoBadge} · ` : ""}
                              {destinoLabel}
                            </span>
                          </div>

                          <div className="mt-1 flex items-center gap-2 text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            <span>{formatarData((saida as any).data ?? t.data)}</span>
                            <span className="text-slate-300 dark:text-slate-600">•</span>
                            <span>Transferência</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end shrink-0">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-2 shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                            {!(saida as any)?.transferId &&
                              !String((saida as any)?.categoria ?? "")
                                .toLowerCase()
                                .normalize("NFD")
                                .replace(/[\u0300-\u036f]/g, "")
                                .includes("transfer") && (
                                <button
                                  type="button"
                                  onClick={() => handleEditClick(saida)}
                                  className="p-1.5 rounded-lg text-violet-400 hover:text-violet-300 hover:bg-violet-500/10 transition-colors"
                                  title="Editar"
                                >
                                  <EditIcon className="w-4 h-4" />
                                </button>
                              )}

                            <button
                              type="button"
                              onClick={() => confirmDelete(saida)}
                              className="p-1.5 rounded-lg text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                              title="Excluir"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </div>

                          <p className="font-bold text-slate-900 dark:text-slate-100">
                            {formatarMoeda(valorAbs)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <TransactionItem
                    key={String((t as any)?.id ?? "")}
                    t={t}
                    profiles={profiles}
                    hojeStr={hojeStr}
                    togglePago={togglePago}
                    formatarData={formatarData}
                    formatarMoeda={formatarMoeda}
                    getContaPartsById={getContaPartsById}
                    onEdit={handleEditClick}
                    onDelete={confirmDelete}
                  />
                );
              }}
            />
          </div>
        ) : (
          <div className="py-20 text-center space-y-2">
            <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              Nenhum registro encontrado para estes filtros.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}