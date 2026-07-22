import test from "node:test";
import assert from "node:assert/strict";
import { json, sendError, ApiError } from "../api/_lib/http";
import { buildInstallmentsSummary, buildFixedSummary } from "../api/_lib/transactionsCommon";

interface MockResponse {
  statusCode: number;
  headers: Record<string, string>;
  sentBody: any;
  rawJsonString: string;
  rawBuffer: Buffer;
  setHeader(name: string, value: string): void;
  status(code: number): MockResponse;
  json(body: any): MockResponse;
}

function createMockResponse(): MockResponse {
  const res: MockResponse = {
    statusCode: 200,
    headers: {},
    sentBody: null,
    rawJsonString: "",
    rawBuffer: Buffer.alloc(0),
    setHeader(name: string, value: string) {
      res.headers[name.toLowerCase()] = value;
    },
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(body: any) {
      res.sentBody = body;
      res.rawJsonString = JSON.stringify(body);
      res.rawBuffer = Buffer.from(res.rawJsonString, "utf8");
      return res;
    },
  };
  return res;
}

const corruptedPatterns = [/Ã/, /Â/, /Ãƒ/];

function assertValidUtf8JsonResponse(res: MockResponse, expectedOriginalText: string, checkField: "message" | "details" = "message") {
  // 1. o header contém application/json; charset=utf-8
  assert.equal(res.headers["content-type"], "application/json; charset=utf-8");

  // 2. o texto antes da resposta é igual ao enviado
  assert.ok(res.sentBody, "Body deve existir");
  const extracted = checkField === "message" ? res.sentBody.message : res.sentBody.details;
  assert.equal(extracted, expectedOriginalText);

  // 3. o JSON pode ser lido por JSON.parse
  const parsed = JSON.parse(res.rawJsonString);
  assert.deepEqual(parsed, res.sentBody);

  // 4. os caracteres continuam corretos após a serialização
  const parsedExtracted = checkField === "message" ? parsed.message : parsed.details;
  assert.equal(parsedExtracted, expectedOriginalText);

  // 5. não aparecem sequências como Ã, Â, Ãƒ
  for (const pattern of corruptedPatterns) {
    assert.equal(pattern.test(res.rawJsonString), false, `String JSON não deve conter padrão de corrupção ${pattern}`);
  }

  // 6. não existe JSON serializado dentro de outra string JSON
  assert.equal(typeof res.sentBody.message, "string");
  assert.equal(res.sentBody.message?.startsWith("{"), false);
  assert.equal(res.sentBody.message?.startsWith("["), false);

  // 7. os bytes reais da resposta são UTF-8 válidos
  const decodedFromBuffer = res.rawBuffer.toString("utf8");
  assert.equal(decodedFromBuffer, res.rawJsonString);
}

test("01 - Retorna UTF-8 correto para: Para pagar a fatura, informe de qual conta bancária o valor deve sair.", () => {
  const text = "Para pagar a fatura, informe de qual conta bancária o valor deve sair.";
  const res = createMockResponse();
  json(res, 400, { message: text });

  assertValidUtf8JsonResponse(res, text);
});

test("02 - Retorna UTF-8 correto para: Esta fatura ainda não está fechada.", () => {
  const text = "Esta fatura ainda não está fechada.";
  const res = createMockResponse();
  json(res, 400, { message: text });

  assertValidUtf8JsonResponse(res, text);
});

test("03 - Retorna UTF-8 correto para: Transação não encontrada.", () => {
  const text = "Transação não encontrada.";
  const res = createMockResponse();
  json(res, 404, { message: text });

  assertValidUtf8JsonResponse(res, text);
});

test("04 - Retorna UTF-8 correto para: Descrição inválida.", () => {
  const text = "Descrição inválida.";
  const res = createMockResponse();
  json(res, 400, { message: text });

  assertValidUtf8JsonResponse(res, text);
});

test("05 - Retorna UTF-8 correto para: Não foi possível concluir a operação.", () => {
  const text = "Não foi possível concluir a operação.";
  const res = createMockResponse();
  sendError(res, new ApiError(500, "OPERATION_FAILED", text));

  assert.equal(res.sentBody?.error?.message, text);
  assert.equal(res.headers["content-type"], "application/json; charset=utf-8");
  assert.equal(corruptedPatterns.some((p) => p.test(res.rawJsonString)), false);
});

test("06 - Retorna UTF-8 correto para conjunto completo de acentos e cedilha: á, à, ã, â, é, ê, í, ó, ô, õ, ú e ç.", () => {
  const text = "Acentos: á, à, ã, â, é, ê, í, ó, ô, õ, ú e ç.";
  const res = createMockResponse();
  json(res, 200, { message: text, details: { full: text } });

  assertValidUtf8JsonResponse(res, text);
});

test("07 - Valida que helpers de transação retornam UTF-8 sem caracteres corrompidos", () => {
  const installmentsSummary = buildInstallmentsSummary("despesa", "Mercado", 3);
  assert.equal(installmentsSummary, "Despesa Mercado parcelada em 3x lançada com sucesso.");
  assert.equal(corruptedPatterns.some((p) => p.test(installmentsSummary)), false);

  const fixedSummary = buildFixedSummary("receita", "Salário", "com_prazo");
  assert.equal(fixedSummary, "Receita Salário fixa com prazo lançada com sucesso.");
  assert.equal(corruptedPatterns.some((p) => p.test(fixedSummary)), false);
});
