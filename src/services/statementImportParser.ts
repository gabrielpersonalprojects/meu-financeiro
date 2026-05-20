import type {
  StatementImportPlanningConfig,
  StatementImportRow,
  StatementImportSourceFormat,
} from "../app/types";

function normalizeText(value: string) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildRowHash(params: {
  lineIndex: number;
  rawDate: string;
  rawDescription: string;
  rawAmount: string;
}) {
  return [
    "row",
    String(params.lineIndex),
    normalizeText(params.rawDate),
    normalizeText(params.rawDescription),
    normalizeText(params.rawAmount),
  ].join("|");
}

function detectInstallmentFromDescription(value: string) {
  const input = normalizeText(value).toLowerCase();

  if (!input) {
    return { current: null, total: null };
  }

  const slashMatch = input.match(/\b(\d{1,2})\s*\/\s*(\d{1,2})\b/);
  if (slashMatch) {
    const current = Number(slashMatch[1]);
    const total = Number(slashMatch[2]);

    if (
      Number.isInteger(current) &&
      Number.isInteger(total) &&
      current >= 1 &&
      total >= 2 &&
      current <= total
    ) {
      return { current, total };
    }
  }

  const parcelaPorExtensoMatch = input.match(
    /\bparcela\s+(\d{1,2})\s+de\s+(\d{1,2})\b/
  );
  if (parcelaPorExtensoMatch) {
    const current = Number(parcelaPorExtensoMatch[1]);
    const total = Number(parcelaPorExtensoMatch[2]);

    if (
      Number.isInteger(current) &&
      Number.isInteger(total) &&
      current >= 1 &&
      total >= 2 &&
      current <= total
    ) {
      return { current, total };
    }
  }

  return { current: null, total: null };
}

function buildDefaultPlanning(params: {
  rawDescription: string;
  direction: "entrada" | "saida" | null;
}): StatementImportPlanningConfig {
  const installmentSuggestion =
    params.direction === "saida"
      ? detectInstallmentFromDescription(params.rawDescription)
      : { current: null, total: null };

  const hasInstallmentSuggestion =
    Number(installmentSuggestion.current) > 0 &&
    Number(installmentSuggestion.total) > 1;

  return {
    type: "normal",
    endDate: null,
    installment: hasInstallmentSuggestion
      ? {
          current: installmentSuggestion.current,
          total: installmentSuggestion.total,
        }
      : null,
    touched: false,
  };
}

function normalizeDateCandidate(value: string) {
  const v = normalizeText(value);

  if (!v) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;

  const br = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) {
    return `${br[3]}-${String(br[2]).padStart(2, "0")}-${String(br[1]).padStart(2, "0")}`;
  }

  const brDash = v.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (brDash) {
    return `${brDash[3]}-${String(brDash[2]).padStart(2, "0")}-${String(brDash[1]).padStart(2, "0")}`;
  }

  const isoWithTime = v.match(/^(\d{4})-(\d{2})-(\d{2})[T\s]/);
  if (isoWithTime) {
    return `${isoWithTime[1]}-${isoWithTime[2]}-${isoWithTime[3]}`;
  }

  return null;
}

function normalizeAmountCandidate(value: string) {
  let raw = normalizeText(value)
    .replace(/\s/g, "")
    .replace(/R\$/gi, "")
    .replace(/[^\d.,\-+()]/g, "");

  if (!raw) return null;

  const isNegativeByParentheses = raw.startsWith("(") && raw.endsWith(")");
  raw = raw.replace(/[()]/g, "");

  const isNegative = isNegativeByParentheses || raw.startsWith("-");
  raw = raw.replace(/^[+-]/, "");

  if (!raw) return null;

  const lastComma = raw.lastIndexOf(",");
  const lastDot = raw.lastIndexOf(".");
  const decimalSeparator =
    lastComma > lastDot ? "," : lastDot > lastComma ? "." : "";

  let normalized = raw;

  if (decimalSeparator === ",") {
    normalized = raw.replace(/\./g, "").replace(",", ".");
  } else if (decimalSeparator === ".") {
    normalized = raw.replace(/,/g, "");
  }

  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;

  return isNegative ? -Math.abs(n) : n;
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

  const planning = buildDefaultPlanning({
    rawDescription: normalizedDescription,
    direction,
  });

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
    planning,
rowHash: buildRowHash({
  lineIndex: params.lineIndex,
  rawDate: params.rawDate,
  rawDescription: params.rawDescription,
  rawAmount: params.rawAmount,
}),
  };
}

function normalizeHeaderCandidate(value: string) {
  return normalizeText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/["']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function detectCsvDelimiter(line: string) {
  const delimiters = [",", ";", "\t"];

  const countDelimiter = (delimiter: string) => {
    let count = 0;
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const next = line[i + 1];

      if (char === '"') {
        if (inQuotes && next === '"') {
          i++;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (char === delimiter && !inQuotes) {
        count++;
      }
    }

    return count;
  };

  return delimiters
    .map((delimiter) => ({
      delimiter,
      count: countDelimiter(delimiter),
    }))
    .sort((a, b) => b.count - a.count)[0]?.delimiter ?? ",";
}

function splitCsvLine(line: string, delimiter = ",") {
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

    if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current.trim());
  return result.map((item) => item.replace(/^"(.*)"$/, "$1").trim());
}

function findHeaderIndex(headers: string[], acceptedNames: string[]) {
  const accepted = acceptedNames.map(normalizeHeaderCandidate);

  return headers.findIndex((header) => {
    const normalized = normalizeHeaderCandidate(header);

    return accepted.some(
      (acceptedHeader) =>
        normalized === acceptedHeader ||
        normalized.includes(acceptedHeader) ||
        acceptedHeader.includes(normalized)
    );
  });
}

function parseCsvRows(rawContent: string): StatementImportRow[] {
  const lines = String(rawContent ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return [];

  const headerLineIndex = lines.findIndex((line) => {
    const delimiter = detectCsvDelimiter(line);
    const cols = splitCsvLine(line, delimiter).map(normalizeHeaderCandidate);

    const hasDate = findHeaderIndex(cols, [
      "data",
      "date",
      "data lancamento",
      "data de lancamento",
      "lancamento",
      "posted date",
      "transaction date",
    ]) >= 0;

    const hasDescription = findHeaderIndex(cols, [
      "descricao",
      "descrição",
      "historico",
      "histórico",
      "titulo",
      "title",
      "memo",
      "detalhes",
      "description",
      "nome",
      "estabelecimento",
    ]) >= 0;

    const hasAmount = findHeaderIndex(cols, [
      "valor",
      "amount",
      "valor r$",
      "quantia",
      "montante",
      "value",
      "debito",
      "débito",
      "credito",
      "crédito",
    ]) >= 0;

    return hasDate && hasDescription && hasAmount;
  });

  if (headerLineIndex < 0) {
    return lines.slice(0, 50).map((line, index) => {
      const delimiter = detectCsvDelimiter(line);
      const cols = splitCsvLine(line, delimiter);

      return buildRow({
        lineIndex: index + 1,
        rawDate: cols[0] ?? "",
        rawDescription: cols[1] ?? "",
        rawAmount: cols[2] ?? "",
      });
    });
  }

  const delimiter = detectCsvDelimiter(lines[headerLineIndex]);
  const headerCols = splitCsvLine(lines[headerLineIndex], delimiter).map(
    normalizeHeaderCandidate
  );

  const dataIndex = findHeaderIndex(headerCols, [
    "data",
    "date",
    "data lancamento",
    "data de lancamento",
    "lancamento",
    "posted date",
    "transaction date",
  ]);

  const descricaoIndex = findHeaderIndex(headerCols, [
    "descricao",
    "descrição",
    "historico",
    "histórico",
    "titulo",
    "title",
    "memo",
    "detalhes",
    "description",
    "nome",
    "estabelecimento",
  ]);

  const valorIndex = findHeaderIndex(headerCols, [
    "valor",
    "amount",
    "valor r$",
    "quantia",
    "montante",
    "value",
  ]);

  const debitoIndex = findHeaderIndex(headerCols, [
    "debito",
    "débito",
    "saida",
    "saída",
    "withdrawal",
    "debit",
  ]);

  const creditoIndex = findHeaderIndex(headerCols, [
    "credito",
    "crédito",
    "entrada",
    "deposito",
    "depósito",
    "credit",
  ]);

  const dataLines = lines.slice(headerLineIndex + 1);

  return dataLines.slice(0, 50).map((line, index) => {
    const cols = splitCsvLine(line, delimiter);

    const valorPrincipal = valorIndex >= 0 ? cols[valorIndex] ?? "" : "";
    const valorDebito = debitoIndex >= 0 ? cols[debitoIndex] ?? "" : "";
    const valorCredito = creditoIndex >= 0 ? cols[creditoIndex] ?? "" : "";

    const rawAmount =
      valorPrincipal ||
      (valorDebito ? `-${valorDebito}` : "") ||
      valorCredito ||
      "";

    return buildRow({
      lineIndex: headerLineIndex + index + 1,
      rawDate: dataIndex >= 0 ? cols[dataIndex] ?? "" : "",
      rawDescription: descricaoIndex >= 0 ? cols[descricaoIndex] ?? "" : "",
      rawAmount,
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