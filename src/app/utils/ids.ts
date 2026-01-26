// src/app/utils/ids.ts
export function newId(prefix?: string) {
  const uuid =
    (typeof crypto !== "undefined" && "randomUUID" in crypto && typeof crypto.randomUUID === "function")
      ? crypto.randomUUID()
      : `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  return prefix ? `${prefix}_${uuid}` : uuid;
}
