type StatementImportMode = "conta" | "cartao";

type BuildStatementImportSourceHashInput = {
  userId: string;
  mode: StatementImportMode;
  targetAccountId?: string | null;
  targetCreditCardId?: string | null;
  occurredOn: string;
  amountCents: number;
  direction: "entrada" | "saida";
  description: string;
  category: string;
};

function normalizeText(value: string) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function toBaseString(input: BuildStatementImportSourceHashInput) {
  const targetId =
    input.mode === "conta"
      ? String(input.targetAccountId ?? "").trim()
      : String(input.targetCreditCardId ?? "").trim();

  return [
    String(input.userId).trim(),
    String(input.mode).trim(),
    targetId,
    String(input.occurredOn).trim(),
    String(input.amountCents),
    String(input.direction).trim(),
    normalizeText(input.description),
    normalizeText(input.category),
  ].join("|");
}

async function sha256Hex(value: string) {
  const data = new TextEncoder().encode(value);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function buildStatementImportSourceHash(
  input: BuildStatementImportSourceHashInput
) {
  const base = toBaseString(input);
  return sha256Hex(base);
}