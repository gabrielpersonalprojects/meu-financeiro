const { getSupabaseAdmin } = require("../../../_lib/supabaseAdmin");
const {
  json,
  parseJson,
  requireMethod,
  requireString,
  withApi,
} = require("../../../_lib/http");
const {
  rejectUserIdFromSupplier,
  validateSupplierAuth,
} = require("../../../_lib/whatsappAuth");
const { resolveWhatsappUser } = require("../../../_lib/whatsappUser");
const { normalizeCatalogName } = require("../../../_lib/catalogNames");
const {
  requireIdempotencyKey,
  runIdempotentCommand,
} = require("../../../_lib/idempotency");

const ROUTE = "/api/v1/whatsapp/commands/credit-card-tags";

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
  const name = String(body.name ?? "").trim();
  const normalizedName = normalizeCatalogName(body.name);

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
      const { data: existingRows, error: existingError } = await supabase
        .from("user_tags")
        .select("id, nome, normalized_name")
        .eq("user_id", user.user_id)
        .eq("normalized_name", normalizedName)
        .limit(1);

      if (existingError) throw existingError;

      const existing = existingRows?.[0] ?? null;

      if (existing) {
        return {
          statusCode: 200,
          body: {
            ok: true,
            status: "already_exists",
            tag: {
              id: existing.id,
              name: existing.nome,
              normalized_name: existing.normalized_name || normalizedName,
            },
          },
        };
      }

      const { data: created, error: insertError } = await supabase
        .from("user_tags")
        .insert({
          user_id: user.user_id,
          nome: name,
          normalized_name: normalizedName,
        })
        .select("id, nome, normalized_name")
        .single();

      if (insertError) throw insertError;

      return {
        statusCode: 201,
        body: {
          ok: true,
          status: "created",
          tag: {
            id: created.id,
            name: created.nome,
            normalized_name: created.normalized_name || normalizedName,
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
