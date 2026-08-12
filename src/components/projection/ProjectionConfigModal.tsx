import { Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { formatarData, formatarMoeda } from "../../utils/formatters";
import type { Transaction } from "../../app/types";
import {
  getProjectionAccountId,
  getProjectionCardId,
  getProjectionTransactionGroupKey,
  getProjectionTransactionId,
  normalizeProjectionPreferences,
  transactionBelongsToProjectionProfile,
  type ProjectionPreferences,
  type ProjectionProfile,
} from "../../app/transactions/projectionPreferences";
import {
  getProjectionMovementDirection,
  matchesProjectionMovementFilter,
  matchesProjectionOriginFilter,
  matchesProjectionSearch,
  type ProjectionMovementFilter,
  type ProjectionOriginFilter,
  type ProjectionOriginType,
} from "./projectionModalFilters";

type Props = {
  profile: ProjectionProfile;
  profiles: any[];
  creditCards: any[];
  transactions: Transaction[];
  initialPreferences: ProjectionPreferences;
  isLoadingInitial?: boolean;
  loadingError?: string | null;
  onRetryLoad?: () => void;
  onCancel: () => void;
  onApply: (preferences: ProjectionPreferences) => Promise<void>;
};

const profileOf = (entity: any) =>
  String(entity?.perfilConta ?? entity?.perfil ?? entity?.brand ?? "").trim().toLowerCase();

const transactionBadge = (transaction: any) => {
  const installments = Number(transaction?.totalParcelas ?? transaction?.payload?.totalParcelas ?? 0);
  if (installments > 1) return `Parcelado ${installments}x`;
  const spending = String(transaction?.tipoGasto ?? transaction?.payload?.tipoGasto ?? "").toLowerCase();
  if (spending === "fixo") return "Fixo/Mensal";
  if (String(transaction?.tipo ?? "").toLowerCase() === "receita") return "Receita";
  return "Variável";
};

export default function ProjectionConfigModal({
  profile,
  profiles,
  creditCards,
  transactions,
  initialPreferences,
  isLoadingInitial = false,
  loadingError = null,
  onRetryLoad,
  onCancel,
  onApply,
}: Props) {
  const [draft, setDraft] = useState(() => normalizeProjectionPreferences(initialPreferences));
  const [isApplying, setIsApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [origin, setOrigin] = useState<ProjectionOriginFilter>("todos");
  const [movement, setMovement] = useState<ProjectionMovementFilter>("todos");

  useEffect(() => {
    setDraft(normalizeProjectionPreferences(initialPreferences));
    setApplyError(null);
  }, [initialPreferences, profile]);

  const handleApply = async () => {
    if (isApplying || isLoadingInitial) return;
    setIsApplying(true);
    setApplyError(null);
    try {
      await onApply(draft);
    } catch (error: any) {
      setApplyError(
        String(error?.message ?? "") ||
          "Não foi possível salvar a configuração da projeção. Tente novamente."
      );
    } finally {
      setIsApplying(false);
    }
  };

  const accounts = useMemo(
    () => (profiles ?? []).filter((item) => profileOf(item) === profile),
    [profiles, profile]
  );
  const cards = useMemo(
    () => (creditCards ?? []).filter((item) => profileOf(item) === profile),
    [creditCards, profile]
  );
  const excludedAccounts = new Set(draft.excludedAccountIds);
  const excludedCards = new Set(draft.excludedCardIds);

  const visibleEntries = useMemo(() => {
    const byKey = new Map<string, {
      transaction: any;
      count: number;
      originId: string;
      originLabel: string;
      originType: ProjectionOriginType;
    }>();

    for (const transaction of transactions ?? []) {
      if (!transactionBelongsToProjectionProfile({ transaction, profile, profiles, creditCards })) continue;
      const isCard = String((transaction as any)?.tipo ?? "").toLowerCase() === "cartao_credito";
      const originId = isCard
        ? getProjectionCardId(transaction, creditCards)
        : getProjectionAccountId(transaction);
      if (!originId || (isCard ? excludedCards.has(originId) : excludedAccounts.has(originId))) continue;
      const originType: ProjectionOriginType = isCard ? "cartoes" : "contas";
      if (!matchesProjectionOriginFilter(origin, originType)) continue;
      const entity = (isCard ? cards : accounts).find((item: any) => String(item?.id ?? "") === originId);
      const originLabel = String(
        isCard
          ? entity?.emissor ?? entity?.bankText ?? entity?.name ?? entity?.nome ?? "Cartão"
          : entity?.name ?? entity?.banco ?? "Conta"
      ).trim();
      const movementDirection = getProjectionMovementDirection(transaction);
      if (!matchesProjectionMovementFilter(movement, movementDirection)) continue;
      if (!matchesProjectionSearch(search, [transaction.descricao, transaction.categoria, transaction.tag, originLabel])) {
        continue;
      }
      const groupKey = getProjectionTransactionGroupKey(transaction);
      const transactionId = getProjectionTransactionId(transaction);
      const selectionKey = groupKey || (transactionId ? `transaction:${transactionId}` : "");
      if (!selectionKey) continue;
      const current = byKey.get(selectionKey);
      byKey.set(selectionKey, current
        ? { ...current, count: current.count + 1 }
        : { transaction, count: 1, originId, originLabel, originType });
    }
    return Array.from(byKey.entries()).sort(([, a], [, b]) =>
      a.originLabel.localeCompare(b.originLabel, "pt-BR") ||
      String(a.transaction?.data ?? "").localeCompare(String(b.transaction?.data ?? ""))
    );
  }, [transactions, profile, profiles, creditCards, accounts, cards, draft, search, origin, movement]);

  const toggleExcluded = (field: "excludedAccountIds" | "excludedCardIds", id: string) => {
    setDraft((current) => {
      const values = new Set(current[field]);
      values.has(id) ? values.delete(id) : values.add(id);
      return { ...current, [field]: Array.from(values) };
    });
  };

  const toggleAll = (field: "excludedAccountIds" | "excludedCardIds", ids: string[]) => {
    setDraft((current) => {
      const allIncluded = ids.every((id) => !current[field].includes(id));
      return { ...current, [field]: allIncluded ? ids : [] };
    });
  };

  const toggleTransaction = (selectionKey: string) => {
    const isGroup = !selectionKey.startsWith("transaction:");
    const field = isGroup ? "excludedGroupIds" : "excludedTransactionIds";
    const id = isGroup ? selectionKey : selectionKey.slice("transaction:".length);
    setDraft((current) => {
      const values = new Set(current[field]);
      values.has(id) ? values.delete(id) : values.add(id);
      return { ...current, [field]: Array.from(values) };
    });
  };

  return (
    <div className="fixed inset-0 z-[10000] bg-slate-950/60 p-2 backdrop-blur-sm sm:p-4" role="dialog" aria-modal="true">
      <div className="mx-auto flex max-h-[calc(100vh-16px)] w-full max-w-4xl flex-col overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900 sm:max-h-[calc(100vh-32px)]">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4 dark:border-white/10 sm:px-6">
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white">Configurar projeção {profile.toUpperCase()}</h2>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Escolha o que participa dos cálculos.</p>
          </div>
          <button type="button" onClick={onCancel} className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10" aria-label="Fechar"><X className="h-5 w-5" /></button>
        </div>

        <div data-projection-config-scroll className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4 sm:px-6 [scrollbar-width:thin] [scrollbar-color:rgba(64,0,156,0.55)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#40009c]/55 hover:[&::-webkit-scrollbar-thumb]:bg-[#40009c]/80">
          {loadingError && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:border-rose-400/30 dark:bg-rose-500/10 dark:text-rose-200">
              {loadingError}
              {onRetryLoad && (
                <button
                  type="button"
                  onClick={onRetryLoad}
                  className="ml-2 rounded-lg border border-rose-300 px-2 py-1 text-[11px] font-bold text-rose-700 dark:border-rose-300/30 dark:text-rose-200"
                >
                  Tentar novamente
                </button>
              )}
            </div>
          )}

          {isLoadingInitial ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-600 dark:border-white/10 dark:bg-slate-950/60 dark:text-slate-300">
              Carregando configuração da projeção...
            </div>
          ) : (
            <>
          {([[
            "Contas", accounts, "excludedAccountIds", "Selecionar todas"
          ], [
            "Cartões", cards, "excludedCardIds", "Selecionar todos"
          ]] as const).map(([title, entries, field, allLabel]) => {
            const ids = entries.map((item: any) => String(item?.id ?? "").trim()).filter(Boolean);
            const allIncluded = ids.every((id) => !draft[field].includes(id));
            return (
              <section key={title}>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">{title}</h3>
                  <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-violet-700 dark:text-violet-300">
                    <input type="checkbox" checked={allIncluded} onChange={() => toggleAll(field, ids)} className="h-4 w-4 accent-violet-700" /> {allLabel}
                  </label>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {entries.map((item: any) => {
                    const id = String(item?.id ?? "").trim();
                    const included = !draft[field].includes(id);
                    const name = String(title === "Contas" ? item?.name ?? item?.banco ?? "Conta" : item?.name ?? item?.nome ?? item?.emissor ?? item?.bankText ?? "Cartão").trim();
                    const detail = title === "Contas"
                      ? [item?.banco, item?.tipoConta].filter(Boolean).join(" · ")
                      : String(item?.emissor ?? item?.bankText ?? "").trim();
                    return <label key={id} className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 p-3 dark:border-white/10">
                      <input type="checkbox" checked={included} onChange={() => toggleExcluded(field, id)} className="h-4 w-4 accent-violet-700" />
                      <span className="min-w-0"><span className="block truncate text-sm font-bold text-slate-800 dark:text-white">{name}</span><span className="block truncate text-xs text-slate-500">{detail || profile.toUpperCase()}</span></span>
                    </label>;
                  })}
                </div>
              </section>
            );
          })}

          <section>
            <h3 className="mb-2 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Lançamentos considerados</h3>
            <div className="mb-3 space-y-2">
              <label className="relative block"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar lançamento..." className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none dark:border-white/10 dark:bg-slate-950 dark:text-white" /></label>

              <div className="flex flex-wrap items-start gap-2">
                <div>
                  <p className="mb-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Origem</p>
                  <div className="inline-flex rounded-2xl border border-slate-200 p-1 dark:border-white/10">
                    {(["todos", "contas", "cartoes"] as const).map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setOrigin(value)}
                        className={`rounded-xl px-3 py-1.5 text-xs font-bold ${
                          origin === value
                            ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                            : "text-slate-500"
                        }`}
                      >
                        {value === "todos" ? "Todos" : value === "contas" ? "Contas" : "Cartões"}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Movimentação</p>
                  <div className="inline-flex rounded-2xl border border-slate-200 p-1 dark:border-white/10">
                    {(["todos", "entradas", "saidas"] as const).map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setMovement(value)}
                        className={`rounded-xl px-3 py-1.5 text-xs font-bold ${
                          movement === value
                            ? value === "entradas"
                              ? "bg-emerald-600 text-white"
                              : value === "saidas"
                                ? "bg-rose-600 text-white"
                                : "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                            : "text-slate-500"
                        }`}
                      >
                        {value === "todos" ? "Todos" : value === "entradas" ? "Entradas" : "Saídas"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              {visibleEntries.map(([selectionKey, entry], index) => {
                const excluded = selectionKey.startsWith("transaction:")
                  ? draft.excludedTransactionIds.includes(selectionKey.slice("transaction:".length))
                  : draft.excludedGroupIds.includes(selectionKey);
                const tx: any = entry.transaction;
                const previousEntry = index > 0 ? visibleEntries[index - 1]?.[1] : null;
                const startsOriginGroup = !previousEntry || previousEntry.originId !== entry.originId;
                return <div key={selectionKey}>
                  {startsOriginGroup && <div className="mb-1 mt-3 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 first:mt-0">{entry.originType === "cartoes" ? "Cartão" : "Conta"} · {entry.originLabel}</div>}
                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 p-3 dark:border-white/10">
                  <input type="checkbox" checked={!excluded} onChange={() => toggleTransaction(selectionKey)} className="mt-1 h-4 w-4 accent-violet-700" aria-label="Considerar na projeção" title="Considerar na projeção" />
                  <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><span className="truncate text-sm font-bold text-slate-800 dark:text-white">{tx?.descricao || "Sem descrição"}</span><span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-black text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">{transactionBadge(tx)}</span>{entry.count > 1 && <span className="text-[10px] font-bold text-slate-400">{entry.count} ocorrências</span>}</span><span className="mt-1 block text-xs text-slate-500">{entry.originLabel} · {formatarData(tx?.data)} · {String(tx?.categoria ?? "Sem categoria")}{tx?.tag ? ` · ${tx.tag}` : ""}</span></span>
                  <span className="shrink-0 text-sm font-black text-slate-800 dark:text-white">{formatarMoeda(Math.abs(Number(tx?.valor ?? 0)))}</span>
                </label></div>;
              })}
              {!visibleEntries.length && <div className="py-6 text-center text-sm text-slate-500">Nenhum lançamento encontrado.</div>}
            </div>
          </section>
            </>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-4 py-3 dark:border-white/10 sm:px-6">
          {applyError && (
            <div className="w-full rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:border-rose-400/30 dark:bg-rose-500/10 dark:text-rose-200">
              {applyError}
            </div>
          )}
          <button type="button" onClick={onCancel} className="h-10 rounded-xl px-4 text-sm font-bold text-slate-600 dark:text-slate-300">Cancelar</button>
          <button type="button" onClick={() => { void handleApply(); }} disabled={isApplying || isLoadingInitial} className="h-10 rounded-xl bg-[#4600ac] px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60">{isApplying ? "Salvando..." : "Aplicar"}</button>
        </div>
      </div>
    </div>
  );
}
