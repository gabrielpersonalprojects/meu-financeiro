export function asId(v: unknown): string {
  // Mantém comportamento parecido com String(v), mas evita "undefined"/"null" quando preferível
  if (v === undefined || v === null) return "";
  return String(v);
}
