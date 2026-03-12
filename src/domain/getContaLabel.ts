export const getContaLabel = (p: any) => {
  const nome = p?.banco ?? p?.nome ?? p?.name ?? "Conta";

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

  const tipoCurto =
    t.includes("corrente") || t === "cc" || t.includes("c/c")
      ? "c/c"
      : t.includes("poup") || t === "cp" || t.includes("poupança") || t.includes("poupanca")
        ? "c/poup"
        : t.includes("sal") || t.includes("salário") || t.includes("salario")
          ? "c/sal"
          : t.includes("invest")
            ? "inv"
            : raw
              ? String(raw)
              : "";

  const perfil = String(
    p?.perfilConta ??
      p?.tipo ??
      p?.perfil ??
      p?.scope ??
      "PF"
  )
    .trim()
    .toUpperCase();

  const badge = perfil === "PJ" ? "PJ" : "PF";

  return `${nome} • ${badge}${tipoCurto ? ` ${tipoCurto}` : ""}`.trim();
};