import type { StatementImportSourceFormat } from "../app/types";

const MAX_STATEMENT_FILE_SIZE_BYTES = 5 * 1024 * 1024;

const EXTENSIONS_BY_FORMAT: Record<StatementImportSourceFormat, string[]> = {
  csv: [".csv"],
  ofx: [".ofx"],
};

function getFileExtension(fileName: string) {
  const clean = String(fileName ?? "").trim().toLowerCase();
  const dotIndex = clean.lastIndexOf(".");
  return dotIndex >= 0 ? clean.slice(dotIndex) : "";
}

export function validateStatementImportFile(
  file: File,
  expectedFormat: StatementImportSourceFormat
) {
  const name = String(file?.name ?? "").trim();
  const size = Number(file?.size ?? 0);
  const extension = getFileExtension(name);
  const allowedExtensions = EXTENSIONS_BY_FORMAT[expectedFormat] ?? [];

  if (!name) {
    throw new Error("Arquivo inválido.");
  }

  if (!allowedExtensions.includes(extension)) {
    throw new Error(
      expectedFormat === "csv"
        ? "Selecione um arquivo .csv válido."
        : "Selecione um arquivo .ofx válido."
    );
  }

  if (size <= 0) {
    throw new Error("O arquivo está vazio.");
  }

  if (size > MAX_STATEMENT_FILE_SIZE_BYTES) {
    throw new Error("O arquivo excede o limite de 5 MB.");
  }
}

export async function readStatementImportFileAsText(file: File) {
  const content = await file.text();
  const normalized = String(content ?? "").replace(/\uFEFF/g, "");

  if (!normalized.trim()) {
    throw new Error("Não foi possível ler conteúdo válido do arquivo.");
  }

  return normalized;
}