export const getContaLabel = (p: any) => {
  const nome = p?.banco ?? p?.nome ?? p?.name ?? "Conta";

  // tenta descobrir o tipo curto
  const raw =
    (p?.tipoContaCurto ??
      p?.tipoCurto ??
      p?.subtipoCurto ??
      p?.tipoConta ??
      p?.subtipo ??
      p?.accountType ??
      p?.kind ??
      "") as string;

  const t = String(raw).toLowerCase().trim();

  // mapeia pra versão curtinha
  const tipoCurto =
    t.includes("corrente") || t === "cc" || t.includes("c/c")
      ? "c/c"
      : t.includes("poup") || t === "cp" || t.includes("poupança") || t.includes("poupanca")
      ? "c/POUP"
      : t.includes("sal") || t.includes("salário") || t.includes("salario")
      ? "c/SAL"
      : t.includes("invest")
      ? "INV"
      : raw ? String(raw) : "";

  return `${nome}${tipoCurto ? ` • ${tipoCurto}` : ""}`.trim();
};
