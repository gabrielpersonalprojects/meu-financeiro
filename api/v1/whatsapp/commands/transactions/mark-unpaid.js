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
  requireOwnedCommonTransaction,
} = require("../../../../_lib/transactionsCommon");

const ROUTE = "/api/v1/whatsapp/commands/transactions/mark-unpaid";

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

      if (transaction.pago !== true) {
        return {
          statusCode: 200,
          body: {
            ok: true,
            status: "already_unpaid",
            summary: "Esse lançamento já estava marcado como não pago.",
            transaction: {
              id: transaction.id,
              paid: false,
            },
          },
        };
      }

      const payload =
        transaction.payload && typeof transaction.payload === "object"
          ? { ...transaction.payload }
          : {};
      delete payload.paidAt;

      const { data: updated, error } = await supabase
        .from("transactions")
        .update({
          pago: false,
          payload,
        })
        .eq("id", transaction.id)
        .eq("user_id", user.user_id)
        .select("id, pago")
        .single();

      if (error) throw error;

      return {
        statusCode: 200,
        body: {
          ok: true,
          status: "updated",
          summary: "Lançamento marcado como não pago.",
          transaction: {
            id: updated.id,
            paid: false,
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
