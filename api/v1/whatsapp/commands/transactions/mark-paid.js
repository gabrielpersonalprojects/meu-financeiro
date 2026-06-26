const { getSupabaseAdmin } = require("../../../../_lib/supabaseAdmin");
const {
  ApiError,
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
  isFutureDate,
  normalizePaymentMethod,
  parseIsoDate,
  requireOwnedAccount,
  requireOwnedCommonTransaction,
} = require("../../../../_lib/transactionsCommon");

const ROUTE = "/api/v1/whatsapp/commands/transactions/mark-paid";

function typeLabel(type) {
  return String(type ?? "") === "receita" ? "Receita" : "Despesa";
}

module.exports = withApi(async function handler(req, res) {
  requireMethod(req, "POST");
  validateSupplierAuth(req);

  const body = await parseJson(req);
  rejectUserIdFromSupplier(body);

  const transactionId = requireString(
    body.transaction_id,
    "TRANSACTION_ID_REQUIRED",
    "transaction_id is required."
  );
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
  const paidAt = parseIsoDate(body.paid_at, "INVALID_PAID_DATE", "paid_at");
  if (isFutureDate(paidAt)) {
    throw new ApiError(
      400,
      "INVALID_PAID_DATE",
      "paid_at cannot be in the future."
    );
  }
  const paymentMethod = normalizePaymentMethod(body.payment_method);

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
      const transaction = await requireOwnedCommonTransaction(
        supabase,
        user.user_id,
        transactionId
      );

      if (body.account_id !== undefined && String(body.account_id ?? "").trim()) {
        await requireOwnedAccount(supabase, user.user_id, body.account_id);
      }

      if (transaction.pago === true) {
        return {
          statusCode: 200,
          body: {
            ok: true,
            status: "already_paid",
            summary: "Esse lançamento já estava marcado como pago.",
            transaction: {
              id: transaction.id,
              paid: true,
            },
          },
        };
      }

      const payload = {
        ...(transaction.payload && typeof transaction.payload === "object"
          ? transaction.payload
          : {}),
        paidAt,
      };

      if (paymentMethod) {
        payload.metodoPagamento = paymentMethod;
      }

      const { data: updated, error } = await supabase
        .from("transactions")
        .update({
          pago: true,
          payload,
        })
        .eq("id", transaction.id)
        .eq("user_id", user.user_id)
        .select("id, tipo, descricao, pago, payload")
        .single();

      if (error) throw error;

      return {
        statusCode: 200,
        body: {
          ok: true,
          status: "updated",
          summary: `${typeLabel(updated.tipo)} ${updated.descricao || "lançamento"} marcada como paga.`,
          transaction: {
            id: updated.id,
            paid: true,
            paid_at: updated.payload?.paidAt || paidAt,
          },
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
