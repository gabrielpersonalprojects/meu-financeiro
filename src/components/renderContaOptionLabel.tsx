type ContaLike = {
  banco?: string;
  name?: string;
  tipoConta?: string;
  perfilConta?: string;
};

function abreviarTipoConta(raw: string) {
  const s = raw.toLowerCase().trim();
  if (!s) return "";

  const has = (k: string) => s.includes(k);

  if (has("corrente") || s === "c/c" || has("cc")) return "C/C";
  if (has("poup")) return "C/POUP";
  if (has("invest")) return "C/INV";
  if (has("sal")) return "C/SAL";
  if (has("pag")) return "C/PAG";
  if (has("carteira") || has("dinheiro") || has("cash")) return "DIN";

  const compact = s.replace(/[^a-z0-9]/g, "").toUpperCase();
  return compact ? compact.slice(0, 6) : "";
}

function getContaLabelParts(p: ContaLike) {
  const banco = String(p.banco || p.name || "Conta").trim();

  const a = String(p.tipoConta || "").trim();
  const b = String(p.perfilConta || "").trim();

  const isPerfil = (v: string) => /^(pf|pj)$/i.test(v);

  const perfil = isPerfil(a) ? a.toUpperCase() : isPerfil(b) ? b.toUpperCase() : "";

  const tipoRaw = isPerfil(a) ? b : a;
  const tipo = abreviarTipoConta(tipoRaw);

  return { perfil, banco, tipo };
}

export function renderContaOptionLabel(p: ContaLike) {
  const info = getContaLabelParts(p);

  return (
    <div className="flex items-center gap-2">
      {!!info.perfil && (
        <span
          className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide
                     bg-indigo-600/20 text-indigo-300 border border-indigo-500/20"
        >
          {info.perfil}
        </span>
      )}

      <span className="text-slate-100">{info.banco}</span>

      {!!info.tipo && <span className="text-slate-400 text-xs">{info.tipo}</span>}
    </div>
  );
}
