import type {
  StatementImportRow,
  StatementImportSourceFormat,
} from "../app/types";

function normalizeText(value: string) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function hashRow(value: string) {
  let hash = 0;
  const input = String(value ?? "");

  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }

  return `row_${Math.abs(hash)}`;
}

function normalizeDateCandidate(value: string) {
  const v = normalizeText(value);

  if (!v) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;

  const br = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) {
    return `${br[3]}-${br[2]}-${br[1]}`;
  }

  return null;
}

function normalizeAmountCandidate(value: string) {
  const raw = normalizeText(value)
    .replace(/\s/g, "")
    .replace(/R\$/gi, "");

  if (!raw) return null;

  const hasComma = raw.includes(",");
  const hasDot = raw.includes(".");

  let normalized = raw;

  if (hasComma && hasDot) {
    // Ex.: 1.234,56  -> 1234.56
    normalized = raw.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    // Ex.: 1234,56 -> 1234.56
    normalized = raw.replace(",", ".");
  } else {
    // Ex.: 1234.56 -> mantém como decimal com ponto
    normalized = raw;
  }

  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function buildRow(params: {
  lineIndex: number;
  rawDate: string;
  rawDescription: string;
  rawAmount: string;
}): StatementImportRow {
  const normalizedDate = normalizeDateCandidate(params.rawDate);
  const normalizedDescription = normalizeText(params.rawDescription);
  const amount = normalizeAmountCandidate(params.rawAmount);

  const parseStatus =
    normalizedDate && normalizedDescription && amount !== null
      ? "valid"
      : "invalid";

  const direction =
    amount === null ? null : amount < 0 ? "saida" : "entrada";

  return {
    lineIndex: params.lineIndex,
    rawDate: params.rawDate || null,
    normalizedDate,
    rawDescription: params.rawDescription,
    normalizedDescription,
    amount,
    direction,
    parseStatus,
duplicateStatus: "none",
selected: parseStatus === "valid",
editedDescription: normalizedDescription,
selectedCategory: "",
rowHash: hashRow(
      `${params.lineIndex}|${params.rawDate}|${params.rawDescription}|${params.rawAmount}`
    ),
  };
}

function splitCsvLine(line: string) {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current.trim());
  return result.map((item) => item.replace(/^"(.*)"$/, "$1").trim());
}

function parseCsvRows(rawContent: string): StatementImportRow[] {
  const lines = String(rawContent ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return [];

  const headerCols = splitCsvLine(lines[0]).map((col) =>
    normalizeText(col).toLowerCase()
  );

  const dataIndex = headerCols.findIndex((col) => col === "data");
  const valorIndex = headerCols.findIndex((col) => col === "valor");
  const descricaoIndex = headerCols.findIndex((col) => col === "descrição" || col === "descricao");

  const dataLines = lines.slice(1);

  return dataLines.slice(0, 50).map((line, index) => {
    const cols = splitCsvLine(line);

    return buildRow({
      lineIndex: index + 1,
      rawDate: dataIndex >= 0 ? cols[dataIndex] ?? "" : "",
      rawDescription: descricaoIndex >= 0 ? cols[descricaoIndex] ?? "" : "",
      rawAmount: valorIndex >= 0 ? cols[valorIndex] ?? "" : "",
    });
  });
}

function parseOfxRows(rawContent: string): StatementImportRow[] {
  const blocks = String(rawContent ?? "").split("<STMTTRN>").slice(1);

  return blocks.slice(0, 50).map((block, index) => {
    const dateMatch = block.match(/<DTPOSTED>(\d{8})/i);
    const memoMatch = block.match(/<MEMO>(.*)/i);
    const amountMatch = block.match(/<TRNAMT>([-\d.,]+)/i);

    const rawDate = dateMatch
      ? `${dateMatch[1].slice(0, 4)}-${dateMatch[1].slice(4, 6)}-${dateMatch[1].slice(6, 8)}`
      : "";

    return buildRow({
      lineIndex: index + 1,
      rawDate,
      rawDescription: memoMatch?.[1] ?? "",
      rawAmount: amountMatch?.[1] ?? "",
    });
  });
}

export function parseStatementImportPreview(params: {
  format: StatementImportSourceFormat;
  rawContent: string;
}) {
  const rows =
    params.format === "csv"
      ? parseCsvRows(params.rawContent)
      : parseOfxRows(params.rawContent);

  const validRows = rows.filter((row) => row.parseStatus === "valid").length;
  const invalidRows = rows.filter((row) => row.parseStatus !== "valid").length;

  return {
    rows,
    summary: {
      total: rows.length,
      valid: validRows,
      invalid: invalidRows,
    },
  };
}