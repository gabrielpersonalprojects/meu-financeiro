export function getContabodge(p: any) {
  return (p?.tipo ?? p?.perfil ?? p?.scope ?? "PF") as string;
}
