const { getSupabaseAdmin } = require("../../../../_lib/supabaseAdmin");
const {
  json,
  parseJson,
  requireMethod,
  requireString,
  withApi,
} = require("../../../../_lib/http");
const {
  rejectUserIdFromSupplier,
  validateSupplierAuth,
} = require("../../../../_lib/whatsappAuth");
const { resolveWhatsappUser } = require("../../../../_lib/whatsappUser");
const {
  requireIdempotencyKey,
  runIdempotentCommand,
} = require("../../../../_lib/idempotency");
const {
  addMonthsLikeUi,
  buildInstallmentsSummary,
  getAccountProfileId,
  mapTransactionResponse,
  normalizePaymentMethod,
  normalizeTransactionType,
  parseBoolean,
  parseInstallments,
  parseIsoDate,
  parsePositiveAmount,
  requireOwnedAccount,
  validateCategoryIfProvided,
} = require("../../../../_lib/transactionsCommon");

const ROUTE = "/api/v1/whatsapp/commands/transactions/installments";

module.exports = withApi(async function handler(req, res) {
  requireMethod(req, "POST");
  validateSupplierAuth(req);

  const body = await parseJson(req);
  rejectUserIdFromSupplier(body);

  const idempotencyKey = requireIdempotencyKey(req);
  const whatsappPhone = requireString(
    body.whatsapp_phone,
    "WHATSAPP_PHONE_REQUIRED",
    "whatsapp_phone is required."
  );
  const providerMessageId = requireString(
    body.provider_message_id,
    "PROVIDER_MESSAGE_ID_REQUIRED",
    "provider_message_id is required."
  );
  const type = normalizeTransactionType(body.type);
  const description = requireString(
    body.description,
    "DESCRIPTION_REQUIRED",
    "description is required."
  );
  const amountAbs = parsePositiveAmount(body.amount);
  const date = parseIsoDate(body.date);
  const paid = parseBoolean(body.paid, "paid");
  const installments = parseInstallments(body.installments);
  const paymentMethod = normalizePaymentMethod(body.payment_method);
  const notes = String(body.notes ?? "").trim();

  const supabase = getSupabaseAdmin();
  const user = await resolveWhatsappUser(supabase, whatsappPhone);

  const result = await runIdempotentCommand({
    supabase,
    userId: user.user_id,
    providerMessageId,
    idempotencyKey,
    route: ROUTE,
    requestBody: body,
    execute: async () => {
      const account = await requireOwnedAccount(
        supabase,
        user.user_id,
        body.account_id
      );
      const profileId = getAccountProfileId(account);
      const category = await validateCategoryIfProvided({
        supabase,
        userId: user.user_id,
        profileId,
        type,
        category: body.category,
      });

      const installmentAbs = amountAbs / installments;
      const signedInstallment =
        type === "receita" ? Math.abs(installmentAbs) : -Math.abs(installmentAbs);
      const signedTotal = type === "receita" ? amountAbs : -amountAbs;
      const createdAt = Date.now();
      const recorrenciaId = `rec_${createdAt}`;

      const rows = Array.from({ length: installments }, (_, index) => ({
        user_id: user.user_id,
        tipo: type,
        valor: signedInstallment,
        data: addMonthsLikeUi(date, index),
        descricao: `${description} (${index + 1}/${installments})`,
        categoria: category,
        tag: "",
        pago: index === 0 ? paid : false,
        conta_id: account.id,
        conta_origem_id: null,
        conta_destino_id: null,
        cartao_id: null,
        transfer_from_id: "",
        transfer_to_id: "",
        qual_conta: account.id,
        criado_em: createdAt + index,
        payload: {
          metodoPagamento: paymentMethod,
          tipoGasto: type === "despesa" ? "fixo" : "",
          recorrenciaId,
          isRecorrente: false,
          recurrenceKind: "",
          recurrenceWindowMonths: null,
          recurrenceOriginDate: "",
          recurrenceWindowStart: "",
          recurrenceWindowEnd: "",
          recurrenceStatus: "",
          recurrenceRenewalDecision: "",
          recurrenceDismissedAt: "",
          recurrenceCanceledAt: "",
          recurrenceLastActionAt: "",
          contraParte: "",
          transferId: "",
          observacoes: notes,
          qualCartao: "",
        },
      }));

      const { data: created, error } = await supabase
        .from("transactions")
        .insert(rows)
        .select("*");

      if (error) throw error;

      const transactions = (created ?? []).map(mapTransactionResponse);

      return {
        statusCode: 201,
        body: {
          ok: true,
          status: "created",
          summary: buildInstallmentsSummary(type, description, installments),
          installment_group: {
            recorrencia_id: recorrenciaId,
            installments,
            total_amount: signedTotal,
            installment_amount: signedInstallment,
          },
          transactions,
        },
      };
    },
  });

  json(res, result.statusCode, {
    ...result.body,
    idempotency: {
      replayed: result.replayed,
    },
  });
});
