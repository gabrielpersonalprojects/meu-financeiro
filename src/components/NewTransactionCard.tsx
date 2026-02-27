import type { Categories, PaymentMethod, Profile, TransactionType } from "../app/types";
import CustomDateInput from "./CustomDateInput";
import CustomDropdown from "./CustomDropdown";
import { PlusIcon } from "./LucideIcons";
import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useEffect } from "react";

type PrazoMode = "com_prazo" | "sem_prazo" | null;

type Props = {
  openAddCreditCardModal: () => void;
  // tipo
  formTipo: TransactionType;
  setFormTipo: (v: TransactionType) => void;

  // cartão de crédito
  creditCards: any[];
  selectedCreditCardId: string;
  setSelectedCreditCardId: (v: string) => void;
  openAddAccountModal: () => void;

  ccIsParceladoMode: boolean | null;
  setCcIsParceladoMode: (v: boolean | null) => void;

  // despesa (parcelado)
  isParceladoMode: boolean | null;
  setIsParceladoMode: (v: boolean | null) => void;

  formParcelas: number;
  setFormParcelas: (v: number) => void;

  formTipoGasto: any;
  setFormTipoGasto: any;

  // descrição/valor/data/pago
  formDesc: string;
  setFormDesc: (v: string) => void;

  formValor: string;
  setFormValor: (v: string) => void;

  formData: string;
  setFormData: (v: string) => void;

  formPago: boolean;
  setFormPago: (v: boolean) => void;

  // tag (só cartão de crédito)
  formTagCC: string;
  setFormTagCC: (v: string) => void;

  ccTags: string[];

  onRemoveCCTag: (tag: string) => void;

  // mantive no props por compatibilidade (não uso aqui)
  handleFormatCurrencyInput: (value: string, setter: (v: string) => void) => void;

  // categoria
  categorias: Categories;
  formCat: any;
  setFormCat: (v: any) => void;
  removerCategoria: (tipo: "despesa" | "receita", idx: string | number) => void;
  onOpenCategoriaModal: () => void;

  // método/conta
  formMetodo: any;
  setFormMetodo: (v: PaymentMethod) => void;

  profiles: Profile[];
  formQualCartao: string;
  setFormQualCartao: (v: string) => void;

  handleDeleteAccount: (id: string) => void;

  // abrir modal de conta
  tiposConta: string[];
  setEditingProfileId: (v: string | null) => void;
  setAccBanco: (v: string) => void;
  setAccNumeroConta: (v: string) => void;
  setAccNumeroAgencia: (v: string) => void;
  setAccPerfilConta: (v: "PF" | "PJ") => void;
  setAccTipoConta: (v: string) => void;
  setAccSaldoInicial: (v: string) => void;

  setAccPossuiCC: (v: boolean) => void;
  setAccLimiteCC: (v: string) => void;
  setAccFechamentoCC: (v: number) => void;
  setAccVencimentoCC: (v: number) => void;

  setIsAddAccountOpen: (v: boolean) => void;

  // transferência
  formContaOrigem: string;
  formContaDestino: string;
  inverterContas: () => void;
  setAccountPickerOpen: (v: any) => void;

  // fixas/recorrentes
  prazoMode: PrazoMode;
  setPrazoMode: (v: PrazoMode) => void;
  formDataTerminoFixa: string;
  setFormDataTerminoFixa: (v: string) => void;
  SEM_PRAZO_MESES: number;

  // submit
  handleAddTransaction: () => void;

  // layout do centro
  setModoCentro?: Dispatch<SetStateAction<"normal" | "credito">>;
};

function safeStr(v: any) {
  return String(v ?? "").trim();
}

function getCardLabel(card: any) {
  // tenta montar um label “premium” com o que existir no objeto
  const banco = safeStr(card?.banco || card?.bank || card?.issuer || card?.emissor);
  const nome = safeStr(card?.nome || card?.name || card?.apelido || card?.nickname);
  const categoria = safeStr(card?.categoria || card?.category || card?.tier);
  const perfil = safeStr(card?.perfil || card?.profile || card?.tipoPerfil || card?.scope);

  const base = [banco || nome || "Cartão", categoria].filter(Boolean).join(" ");
  const suffix = perfil ? `• ${perfil.toLowerCase()}` : "";

  return `${base}${suffix ? ` ${suffix}` : ""}`.trim();
}

/**
 * ✅ Normaliza o valor vindo do CustomDropdown para SEMPRE virar string.
 * Evita salvar objeto (que viraria "[object Object]" na UI).
 */
function normalizeCategory(val: any): string {
  if (val == null) return "";
  if (typeof val === "string") return val.trim();

  if (typeof val === "object") {
    const direct = val.nome ?? val.name ?? val.label ?? val.titulo ?? val.value;

    const nested =
      val.value && typeof val.value === "object"
        ? (val.value.nome ?? val.value.name ?? val.value.label ?? val.value.titulo ?? val.value.value)
        : null;

    const pick = direct ?? nested;
    return pick != null ? String(pick).trim() : "";
  }

  return String(val).trim();
}

export default function NewTransactionCard({
  openAddCreditCardModal,
  formTipo,
  setFormTipo,

  creditCards,
  selectedCreditCardId,
  setSelectedCreditCardId,
  openAddAccountModal,

  ccIsParceladoMode,
  setCcIsParceladoMode,

  isParceladoMode,
  setIsParceladoMode,

  formParcelas,
  setFormParcelas,

  formTipoGasto,
  setFormTipoGasto,

  formDesc,
  setFormDesc,

  formValor,
  setFormValor,

  formData,
  setFormData,

  formPago,
  setFormPago,

  formTagCC,
  setFormTagCC,

  ccTags,

  onRemoveCCTag,

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  handleFormatCurrencyInput,

  categorias,
  formCat,
  setFormCat,
  removerCategoria,
  onOpenCategoriaModal,

  formMetodo,
  setFormMetodo,

  profiles,
  formQualCartao,
  setFormQualCartao,

  handleDeleteAccount,

  tiposConta,
  setEditingProfileId,
  setAccBanco,
  setAccNumeroConta,
  setAccNumeroAgencia,
  setAccPerfilConta,
  setAccTipoConta,
  setAccSaldoInicial,
  setAccPossuiCC,
  setAccLimiteCC,
  setAccFechamentoCC,
  setAccVencimentoCC,
  setIsAddAccountOpen,

  formContaOrigem,
  formContaDestino,
  inverterContas,
  setAccountPickerOpen,

  prazoMode,
  setPrazoMode,
  formDataTerminoFixa,
  setFormDataTerminoFixa,
  SEM_PRAZO_MESES,

  setModoCentro,
  handleAddTransaction,
}: Props) {
  // trocar aba / tipo (mata espelhamento e seta layout do centro certo)
  const trocarTipo = (tipo: TransactionType) => {
    setModoCentro?.(tipo === "cartao_credito" ? "credito" : "normal");
    setFormTipo(tipo);
    setFormValor("");

    // resets “para não vazar estado” entre modos
    if (tipo !== "despesa") setIsParceladoMode(null);
    if (tipo !== "cartao_credito") setCcIsParceladoMode(null);

    // ao entrar no cartão, defaults bons
    if (tipo === "cartao_credito") {
      // default: à vista
      if (ccIsParceladoMode === null) setCcIsParceladoMode(false);
      setPrazoMode(null);
      setFormDataTerminoFixa("");
    }
  };

  // ✅ digitação “normal” + formatação no blur (sem explodir zeros)
  const normalizeBRLInput = (raw: string) => {
    let v = raw.replace(/[^\d,]/g, "");

    const firstComma = v.indexOf(",");
    if (firstComma !== -1) {
      v = v.slice(0, firstComma + 1) + v.slice(firstComma + 1).replace(/,/g, "");
    }

    const [intPartRaw, decPartRaw = ""] = v.split(",");
    const intPart = intPartRaw.replace(/^0+(?=\d)/, "");
    const decPart = decPartRaw.slice(0, 2);

    if (firstComma !== -1) return `${intPart || "0"},${decPart}`;
    return intPart;
  };

  const formatBRLOnBlur = (raw: string) => {
    const s = String(raw ?? "").trim();
    if (!s) return "";

    const normalized = s.replace(/\./g, "").replace(",", ".");
    const n = Number(normalized);

    if (!Number.isFinite(n)) return "";
    return n.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

const [isTagOpen, setIsTagOpen] = useState(false);
const isCC = formTipo === "cartao_credito";
const ccHasCardSelected = safeStr(selectedCreditCardId) !== "";
const hasAccounts = isCC
  ? (creditCards || []).length > 0
  : (profiles || []).length > 0;
// --- conta obrigatória ---
const contaNormalSelecionada = safeStr(formQualCartao) !== ""; // despesa/receita

const transferenciaOk =
  safeStr(formContaOrigem) !== "" &&
  safeStr(formContaDestino) !== "" &&
  safeStr(formContaOrigem) !== safeStr(formContaDestino);

// cartão: precisa ter conta vinculada no cadastro do cartão
const selectedCard = (creditCards || []).find(
  (c: any) => String(c?.id ?? c?.cardId ?? "") === String(selectedCreditCardId)
);

// tenta achar um campo de conta no objeto do cartão (compatível com variações antigas)
const contaIdDoCartao = safeStr(
  selectedCard?.contaPaganteId ??
  selectedCard?.contaId ??
  selectedCard?.profileId ??
  selectedCard?.accountId ??
  ""
);

const ccTemContaVinculada = contaIdDoCartao !== "";

// regra final de submit
const canSubmit =
  hasAccounts &&
  (!isCC || ccHasCardSelected) &&
  (formTipo === "transferencia"
    ? transferenciaOk
    : isCC
      ? true
      : contaNormalSelecionada);

  useEffect(() => {
  if (!isCC) {
    setFormTipoGasto("");
    setPrazoMode("sem_prazo");
    setCcIsParceladoMode(false);
    setFormParcelas(1);
  }
}, [isCC]);

  const ccCardOptions =
    (creditCards || []).map((c: any) => ({
      label: getCardLabel(c),
      value: String(c?.id ?? c?.cardId ?? ""),
    })) || [];

  const ccCardValue =
    ccHasCardSelected && ccCardOptions.some((o) => String(o.value) === String(selectedCreditCardId))
      ? selectedCreditCardId
      : "";

  const ccCategoryOptions = (categorias as any).despesa as any; // gasto no cartão é despesa

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6">
     <div className="flex items-center justify-between mb-4">
  <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100">
    <PlusIcon /> Novo Lançamento
  </h2>

  <button
    type="button"
    onClick={openAddAccountModal}
className="h-9 px-2 rounded-xl text-[15px] font-bold
           text-[#5752ea] hover:text-[#7b76fc]
           transition"
  >
    + Gerenciar Contas
  </button>
</div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-1.5">
          
          </label>

          <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-slate-100/70 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700/60 backdrop-blur-xl">
            <button
              type="button"
              onClick={() => trocarTipo("despesa")}
              className={`w-full h-11 rounded-2xl text-sm font-semibold transition-all border backdrop-blur-xl
                ${
                  formTipo === "despesa"
                    ? "bg-rose-600/90 border-rose-500/40 text-white shadow-[0_14px_40px_-25px_rgba(225,29,72,0.85)]"
                    : "bg-white/70 dark:bg-slate-900/60 border-slate-200/70 dark:border-slate-800/70 text-slate-700 dark:text-slate-100 hover:bg-white/90 dark:hover:bg-slate-900/80"
                }`}
            >
              Despesa
            </button>

            <button
              type="button"
              onClick={() => trocarTipo("receita")}
              className={`w-full h-11 rounded-2xl text-sm font-semibold transition-all border backdrop-blur-xl
                ${
                  formTipo === "receita"
                    ? "bg-emerald-600/90 border-emerald-500/40 text-white shadow-[0_14px_40px_-25px_rgba(5,150,105,0.85)]"
                    : "bg-white/70 dark:bg-slate-900/60 border-slate-200/70 dark:border-slate-800/70 text-slate-700 dark:text-slate-100 hover:bg-white/90 dark:hover:bg-slate-900/80"
                }`}
            >
              Receita
            </button>

            <button
              type="button"
              onClick={() => trocarTipo("transferencia")}
              className={`w-full h-11 rounded-2xl text-sm font-semibold transition-all border backdrop-blur-xl
                ${
                  formTipo === "transferencia"
                    ? "bg-indigo-600/90 border-indigo-500/40 text-white shadow-[0_14px_40px_-25px_rgba(79,70,229,0.85)]"
                    : "bg-white/70 dark:bg-slate-900/60 border-slate-200/70 dark:border-slate-800/70 text-slate-700 dark:text-slate-100 hover:bg-white/90 dark:hover:bg-slate-900/80"
                }`}
            >
              Transferência
            </button>

            <button
              type="button"
              onClick={() => trocarTipo("cartao_credito")}
              className={`w-full h-11 rounded-2xl text-sm font-semibold transition-all border backdrop-blur-xl
                ${
                  formTipo === "cartao_credito"
                    ? "bg-violet-600/90 border-violet-500/40 text-white shadow-[0_14px_40px_-25px_rgba(124,58,237,0.90)]"
                    : "bg-white/70 dark:bg-slate-900/60 border-slate-200/70 dark:border-slate-800/70 text-slate-700 dark:text-slate-100 hover:bg-white/90 dark:hover:bg-slate-900/80"
                }`}
            >
              Cartão de Crédito
            </button>
          </div>
        </div>

        {formTipo === "transferencia" && (
          <div className="mt-2 px-3 py-2 rounded-xl border border-slate-200/60 dark:border-slate-700/60 bg-slate-50/60 dark:bg-slate-800/30 flex justify-center">
            <p className="text-[12px] leading-snug text-slate-500 dark:text-slate-400 text-center">
              Transfira valores{" "}
              <span className="font-semibold text-slate-600 dark:text-slate-300">entre suas contas cadastradas</span>:
            </p>
          </div>
        )}

{/* Cartão (obrigatório) + Tag lado a lado - só no modo cartão */}
{isCC && (
  <div className="mt-1 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
    <div className="min-w-0 w-full">
      <div className="w-full">
        <CustomDropdown
          label="Cartão"
          value={ccCardValue}
          options={ccCardOptions as any}
          onSelect={(val) => setSelectedCreditCardId(String(val))}
          onAddNew={() => {
            openAddCreditCardModal();
          }}
        />
      </div>
    </div>

    <div className="min-w-0 w-full">
<label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-1.5">
  Tag (opcional)
</label>

      <div className="relative w-full">
        <input
          type="text"
          value={formTagCC}
          onChange={(e) => setFormTagCC(e.target.value)}
          onFocus={() => setIsTagOpen(true)}
          onBlur={() => {
            window.setTimeout(() => setIsTagOpen(false), 120);
          }}
          placeholder="Casa, pai, carro..."
          className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-sm font-semibold outline-none focus:ring-2 focus:ring-violet-100 dark:focus:ring-violet-900"
        />

        {isTagOpen && (ccTags?.length ?? 0) > 0 && (
          <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-2xl border border-slate-200/70 dark:border-slate-700/60 bg-white dark:bg-slate-900 shadow-lg">
            <div className="max-h-56 overflow-auto p-1">
              {(ccTags || [])
                .filter((t) => {
                  const q = (formTagCC || "").trim().toLowerCase();
                  if (!q) return true;
                  return t.toLowerCase().includes(q);
                })
                .slice(0, 30)
                .map((t) => (
                  <div
                    key={t}
                    className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl hover:bg-slate-100/70 dark:hover:bg-slate-800/60 transition"
                  >
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setFormTagCC(t);
                        setIsTagOpen(false);
                      }}
                      className="flex-1 text-left text-sm font-semibold text-slate-800 dark:text-slate-100"
                      title="Selecionar tag"
                    >
                      {t}
                    </button>

                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => onRemoveCCTag(t)}
                      className="h-8 w-8 rounded-lg border border-slate-200/70 dark:border-slate-700/60 bg-white/60 dark:bg-slate-900/40 hover:bg-white/80 dark:hover:bg-slate-800/60 text-slate-600 dark:text-slate-200"
                      title="Remover tag"
                      aria-label={`Remover tag ${t}`}
                    >
                      ×
                    </button>
                  </div>
                ))}

              {(ccTags || []).filter((t) => {
                const q = (formTagCC || "").trim().toLowerCase();
                if (!q) return true;
                return t.toLowerCase().includes(q);
              }).length === 0 && (
                <div className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">
                  Nenhuma tag encontrada.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
)}

        {/* Descrição */}
        <div>
          <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-1.5">
            Descrição
          </label>
          <input
            type="text"
            value={formDesc}
            onChange={(e) => setFormDesc(e.target.value)}
            placeholder={formTipo === "transferencia" ? "Ex: Valor poupança, Reembolso..." : "Ex: Mercado, Aluguel..."}
            className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 font-medium text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900"
          />
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1.5">
              <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase">Valor (R$)</label>

{!isCC && (
  <label className="flex items-center gap-2 ml-2">
    <input
      type="checkbox"
      checked={formPago}
      onChange={(e) => setFormPago(e.target.checked)}
      className="h-3 w-3 rounded border border-slate-200 dark:border-slate-700 accent-indigo-600"
    />
    <span className="text-[11px] leading-none font-medium text-slate-600 dark:text-slate-300 select-none">
      Pago
    </span>
  </label>
)}
            </div>

            <input
              type="text"
              inputMode="decimal"
              value={formValor}
              onChange={(e) => setFormValor(normalizeBRLInput(e.target.value))}
              onBlur={() => setFormValor(formatBRLOnBlur(formValor))}
              placeholder="0,00"
              className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-bold outline-none"
            />
          </div>

          <div className="flex-1">
            <CustomDateInput label="Data" value={formData} onChange={setFormData} />
          </div>
        </div>

        {/* ===== CARTÃO DE CRÉDITO: botões À vista/Parcelado ABAIXO de Valor/Data (como pediu) ===== */}
        {isCC && (
          <div className="mt-1 space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-1.5">
                Modelo de Pagamento
              </label>

              <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-slate-100/70 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700/60 backdrop-blur-xl">
                <button
                  type="button"
onClick={() => {
  setCcIsParceladoMode(false);
  setFormParcelas(1);

  // RESETAR como no comportamento da Despesa
  setFormTipoGasto(""); // volta pro "Selecione"
  setPrazoMode("sem_prazo");
}}
                  className={`w-full h-9 rounded-xl text-[13px] font-semibold transition-all border
                    ${
                      ccIsParceladoMode === false
                        ? "bg-violet-600/90 border-violet-500/40 text-white"
                        : "bg-white/70 dark:bg-slate-900/60 border-slate-200/70 dark:border-slate-800/70 text-slate-700 dark:text-slate-100 hover:bg-white/90 dark:hover:bg-slate-900/80"
                    }`}
                >
                  À vista
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCcIsParceladoMode(true);
                    if (!formParcelas || formParcelas < 2) setFormParcelas(2);

                    // parcelado: não faz sentido abrir "fixo / prazo"
                    setPrazoMode(null);
                    setFormDataTerminoFixa("");
                    setFormTipoGasto(""); // volta pro "Selecione"
                    setPrazoMode("sem_prazo");
                  }}
                  className={`w-full h-9 rounded-xl text-[13px] font-semibold transition-all border
                    ${
                      ccIsParceladoMode === true
                        ? "bg-violet-600/90 border-violet-500/40 text-white"
                        : "bg-white/70 dark:bg-slate-900/60 border-slate-200/70 dark:border-slate-800/70 text-slate-700 dark:text-slate-100 hover:bg-white/90 dark:hover:bg-slate-900/80"
                    }`}
                >
                  Parcelado
                </button>
              </div>
            </div>

            {/* Tipo de Gasto (esq) + Categoria (dir) SEMPRE aqui, abaixo dos botões */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {ccIsParceladoMode === true ? (
                <div>
                  <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-1.5">
                    Número de parcelas
                  </label>
                  <input
                    type="number"
                    min={2}
                    value={formParcelas}
                    onChange={(e) => {
                      const n = parseInt(e.target.value || "2", 10);
                      setFormParcelas(Number.isFinite(n) ? Math.max(2, n) : 2);
                    }}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-bold outline-none focus:ring-2 focus:ring-violet-100 dark:focus:ring-violet-900"
                  />
                </div>
              ) : (
                <CustomDropdown
                  label="Tipo de Gasto"
                  value={formTipoGasto}
                  options={["Variável", "Fixo"] as any}
                  onSelect={(val) => {
                    setFormTipoGasto(val);
                    if (String(val) !== "Fixo") {
                      setPrazoMode(null);
                      setFormDataTerminoFixa("");
                    }
                  }}
                />
              )}

              <CustomDropdown
                label="Categoria"
                value={formCat}
                options={ccCategoryOptions as any}
                onSelect={(val) => setFormCat(normalizeCategory(val))}
                onDelete={(idx) => removerCategoria("despesa", idx)}
                onAddNew={onOpenCategoriaModal}
              />
            </div>

            {/* Cartão: Fixo -> Com prazo / Sem prazo (igual despesa) */}
            {ccIsParceladoMode === false && String(formTipoGasto) === "Fixo" && (
              <div className="mt-1 space-y-2">
                <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase">
                  Lançamento fixo
                </label>

                <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-slate-100/70 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700/60 backdrop-blur-xl">
                  <button
                    type="button"
                    onClick={() => setPrazoMode("com_prazo")}
                    className={`w-full h-9 rounded-xl text-[13px] font-semibold transition-all border
                      ${
                        prazoMode === "com_prazo"
                          ? "bg-violet-600/90 border-violet-500/40 text-white"
                          : "bg-white/70 dark:bg-slate-900/60 border-slate-200/70 dark:border-slate-800/70 text-slate-700 dark:text-slate-100 hover:bg-white/90 dark:hover:bg-slate-900/80"
                      }`}
                  >
                    Com prazo
                  </button>

                  <button
                    type="button"
                    onClick={() => setPrazoMode("sem_prazo")}
                    className={`w-full h-9 rounded-xl text-[13px] font-semibold transition-all border
                      ${
                        prazoMode === "sem_prazo"
                          ? "bg-violet-600/90 border-violet-500/40 text-white"
                          : "bg-white/70 dark:bg-slate-900/60 border-slate-200/70 dark:border-slate-800/70 text-slate-700 dark:text-slate-100 hover:bg-white/90 dark:hover:bg-slate-900/80"
                      }`}
                  >
                    Sem prazo
                  </button>
                </div>

                {prazoMode === "com_prazo" && (
                  <div className="mt-2">
                    <CustomDateInput
                      label="Último lançamento em:"
                      value={formDataTerminoFixa}
                      onChange={setFormDataTerminoFixa}
                    />
                  </div>
                )}

                {prazoMode === "sem_prazo" && (
                  <div className="mt-2 px-3 py-2 rounded-xl border border-slate-200/60 dark:border-slate-700/60 bg-slate-50/60 dark:bg-slate-800/30">
                    <p className="text-[12px] leading-snug text-slate-500 dark:text-slate-400">
                      Sem prazo: vamos considerar <span className="font-bold">{SEM_PRAZO_MESES} meses</span> (5 anos) ou
                      até você excluir este lançamento.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Categoria + Método/Conta (apenas fora do cartão e fora da transferência) */}
        {formTipo !== "transferencia" && !isCC && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <CustomDropdown
              label="Categoria"
              value={formCat}
              options={(formTipo === "receita" ? (categorias as any).receita : (categorias as any).despesa) as any}
              onSelect={(val) => setFormCat(normalizeCategory(val))}
              onDelete={(idx) => removerCategoria(formTipo === "receita" ? "receita" : "despesa", idx)}
              onAddNew={onOpenCategoriaModal}
            />

            {formTipo === "despesa" ? (
              <CustomDropdown
                label="Método de Pagamento"
                value={formMetodo}
                options={[
                  { label: "Pix", value: "pix" },
                  { label: "Transferência bancária", value: "transferencia_bancaria" },
                  { label: "Débito/Conta", value: "debito_conta" },
                  { label: "Boleto", value: "boleto" },
                  { label: "Dinheiro", value: "dinheiro" },
                ]}
                onSelect={(val) => setFormMetodo(val as PaymentMethod)}
              />
            ) : (
              <CustomDropdown
                label="Conta"
                value={formQualCartao}
                options={profiles.map((p) => ({ label: p.name, value: p.id })) as any}
                onSelect={(val) => setFormQualCartao(String(val))}
                onAddNew={() => {
                  setEditingProfileId(null);
                  setAccBanco("");
                  setAccNumeroConta("");
                  setAccNumeroAgencia("");
                  setAccPerfilConta("PF");
                  setAccTipoConta(tiposConta[0]);
                  setAccSaldoInicial("");
                  setAccPossuiCC(false);
                  setAccLimiteCC("");
                  setAccFechamentoCC(1);
                  setAccVencimentoCC(10);
                  setIsAddAccountOpen(true);
                }}
              />
            )}
          </div>
        )}

        {/* Despesa: Parcelado + Tipo de Gasto + Conta */}
        {formTipo === "despesa" && (
          <div className="mt-2 space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-1.5">
                Parcelado?
              </label>

              <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-slate-100/70 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700/60 backdrop-blur-xl">
                <button
                  type="button"
                  onClick={() => {
                    setIsParceladoMode(false);
                    setFormParcelas(1);
                  }}
                  className={`w-full h-9 rounded-xl text-[13px] font-semibold transition-all border
                    ${
                      isParceladoMode === false
                        ? "bg-indigo-600/90 border-indigo-500/40 text-white"
                        : "bg-white/70 dark:bg-slate-900/60 border-slate-200/70 dark:border-slate-800/70 text-slate-700 dark:text-slate-100 hover:bg-white/90 dark:hover:bg-slate-900/80"
                    }`}
                >
                  À vista
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsParceladoMode(true);
                    if (!formParcelas || formParcelas < 2) setFormParcelas(2);
                    setFormTipoGasto("");
                    setPrazoMode(null);
                    setFormDataTerminoFixa("");
                  }}
                  className={`w-full h-9 rounded-xl text-[13px] font-semibold transition-all border
                    ${
                      isParceladoMode === true
                        ? "bg-indigo-600/90 border-indigo-500/40 text-white"
                        : "bg-white/70 dark:bg-slate-900/60 border-slate-200/70 dark:border-slate-800/70 text-slate-700 dark:text-slate-100 hover:bg-white/90 dark:hover:bg-slate-900/80"
                    }`}
                >
                  Parcelado
                </button>
              </div>
            </div>

            {isParceladoMode !== null && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {isParceladoMode === true ? (
                  <div>
                    <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-1.5">
                      Número de parcelas
                    </label>
                    <input
                      type="number"
                      min={2}
                      value={formParcelas}
                      onChange={(e) => {
                        const n = parseInt(e.target.value || "2", 10);
                        setFormParcelas(Number.isFinite(n) ? Math.max(2, n) : 2);
                      }}
                      className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-bold outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900"
                    />
                  </div>
                ) : (
                  <CustomDropdown
                    label="Tipo de Gasto"
                    value={formTipoGasto}
                    options={["Variável", "Fixo"] as any}
                    onSelect={(val) => {
                      setFormTipoGasto(val);
                      if (String(val) !== "Fixo") {
                        setPrazoMode(null);
                        setFormDataTerminoFixa("");
                      }
                    }}
                  />
                )}

                <CustomDropdown
                  label="Conta"
                  value={formQualCartao}
                  options={profiles.map((p) => ({ label: p.name, value: p.id })) as any}
                  onSelect={(val) => setFormQualCartao(String(val))}
                
                  onAddNew={() => {
                    setEditingProfileId(null);
                    setAccBanco("");
                    setAccNumeroConta("");
                    setAccNumeroAgencia("");
                    setAccPerfilConta("PF");
                    setAccTipoConta(tiposConta[0]);
                    setAccSaldoInicial("");
                    setAccPossuiCC(false);
                    setAccLimiteCC("");
                    setAccFechamentoCC(1);
                    setAccVencimentoCC(10);
                    setIsAddAccountOpen(true);
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* Transferência */}
        {formTipo === "transferencia" && (
          <div className="mt-2">
            <div className="grid grid-cols-[minmax(0,1fr)_44px_minmax(0,1fr)] gap-x-3 gap-y-1 items-end">
              <p className="col-start-1 row-start-1 pl-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Origem
              </p>
              <p className="col-start-3 row-start-1 pl-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Destino
              </p>

              <div className="col-start-1 row-start-2 min-w-0">
                <button
                  type="button"
                  onClick={() => setAccountPickerOpen("origem")}
                  className="w-full min-w-0 text-left rounded-2xl border border-slate-200/70 dark:border-slate-700/60 bg-white/60 dark:bg-slate-900/35 px-4 py-2.5 hover:bg-white/80 dark:hover:bg-slate-800/45 transition"
                  title="Selecionar conta origem"
                >
                  <p className="min-w-0 truncate text-[13px] font-extrabold text-slate-900 dark:text-slate-100">
                    {profiles.find((p) => p.id === formContaOrigem)?.name || "Selecione"}
                  </p>
                </button>
              </div>

              <div className="col-start-2 row-start-2 flex items-center justify-center">
                <button
                  type="button"
                  onClick={inverterContas}
                  className="h-10 w-10 rounded-xl border border-violet-500/45 dark:border-violet-400/35 bg-transparent hover:bg-violet-500/10 dark:hover:bg-violet-500/10 transition flex items-center justify-center"
                  title="Inverter contas"
                >
                  <span className="text-[16px] font-black leading-none text-violet-600 dark:text-violet-200">
                    {"<>"}
                  </span>
                </button>
              </div>

              <div className="col-start-3 row-start-2 min-w-0">
                <button
                  type="button"
                  onClick={() => setAccountPickerOpen("destino")}
                  className="w-full min-w-0 text-left rounded-2xl border border-slate-200/70 dark:border-slate-700/60 bg-white/60 dark:bg-slate-900/35 px-4 py-2.5 hover:bg-white/80 dark:hover:bg-slate-800/45 transition"
                  title="Selecionar conta destino"
                >
                  <p className="min-w-0 truncate text-[13px] font-extrabold text-slate-900 dark:text-slate-100">
                    {profiles.find((p) => p.id === formContaDestino)?.name || "Selecione"}
                  </p>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Fixas/recorrentes (somente despesa à vista + fixo) */}
        {formTipo === "despesa" && isParceladoMode === false && String(formTipoGasto) === "Fixo" && (
          <div className="mt-2 space-y-2">
            <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase">
              Lançamento fixo
            </label>

            <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-slate-100/70 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700/60 backdrop-blur-xl">
              <button
                type="button"
                onClick={() => setPrazoMode("com_prazo")}
                className={`w-full h-9 rounded-xl text-[13px] font-semibold transition-all border
                  ${
                    prazoMode === "com_prazo"
                      ? "bg-indigo-600/90 border-indigo-500/40 text-white"
                      : "bg-white/70 dark:bg-slate-900/60 border-slate-200/70 dark:border-slate-800/70 text-slate-700 dark:text-slate-100 hover:bg-white/90 dark:hover:bg-slate-900/80"
                  }`}
              >
                Com prazo
              </button>

              <button
                type="button"
                onClick={() => setPrazoMode("sem_prazo")}
                className={`w-full h-9 rounded-xl text-[13px] font-semibold transition-all border
                  ${
                    prazoMode === "sem_prazo"
                      ? "bg-indigo-600/90 border-indigo-500/40 text-white"
                      : "bg-white/70 dark:bg-slate-900/60 border-slate-200/70 dark:border-slate-800/70 text-slate-700 dark:text-slate-100 hover:bg-white/90 dark:hover:bg-slate-900/80"
                  }`}
              >
                Sem prazo
              </button>
            </div>

            {prazoMode === "com_prazo" && (
              <div className="mt-2">
                <CustomDateInput label="Último lançamento em:" value={formDataTerminoFixa} onChange={setFormDataTerminoFixa} />
              </div>
            )}

            {prazoMode === "sem_prazo" && (
              <div className="mt-2 px-3 py-2 rounded-xl border border-slate-200/60 dark:border-slate-700/60 bg-slate-50/60 dark:bg-slate-800/30">
                <p className="text-[12px] leading-snug text-slate-500 dark:text-slate-400">
                  Sem prazo: vamos considerar{" "}
                  <span className="font-bold">{SEM_PRAZO_MESES} meses</span> (5 anos) ou até você excluir este lançamento.
                </p>
              </div>
            )}
          </div>
        )}

<button
  type="button"
  disabled={!canSubmit || !hasAccounts}
  onClick={() => {
    // 0) sem contas (primeiro uso)
    if (!hasAccounts) {
      openAddAccountModal();
      return;
    }

    // 1) cartão sem cartão selecionado
    if (isCC && !ccHasCardSelected) {
      openAddAccountModal();
      return;
    }

    // 2) transferência sem origem/destino (ou iguais)
    if (formTipo === "transferencia" && !transferenciaOk) {
      alert("Selecione conta de ORIGEM e DESTINO (e elas não podem ser iguais).");
      setAccountPickerOpen("origem");
      return;
    }

    // 3) despesa/receita sem conta
    if (!isCC && formTipo !== "transferencia" && !contaNormalSelecionada) {
      if ((profiles || []).length === 0) openAddAccountModal();
      else alert("Selecione uma conta para salvar o lançamento.");
      return;
    }

    handleAddTransaction();
  }}
  className={`mt-4 w-full h-12 rounded-2xl bg-gradient-to-r from-[#220055] to-[#4600ac]
    text-white font-black tracking-wide shadow-lg shadow-violet-900/20
    hover:brightness-110 active:scale-[0.99] transition
    ${!canSubmit ? "opacity-60 cursor-not-allowed" : ""}`}
>
  Efetuar Lançamento
</button>
      </div>
    </div>
  );
}