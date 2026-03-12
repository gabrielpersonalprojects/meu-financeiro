export function getContaBadge(p: any) {
  const perfil = String(
    p?.perfilConta ??
      p?.tipo ??
      p?.perfil ??
      p?.scope ??
      "PF"
  )
    .trim()
    .toUpperCase();

  return perfil === "PJ" ? "PJ" : "PF";
}