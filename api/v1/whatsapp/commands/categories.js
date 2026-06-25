const { getSupabaseAdmin } = require("../../../_lib/supabaseAdmin");
const {
  ApiError,
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

const ROUTE = "/api/v1/whatsapp/commands/categories";

function normalizeType(value) {
  const type = String(value ?? "").trim();
  if (type !== "receita" && type !== "despesa") {
    throw new ApiError(
      400,
      "INVALID_CATEGORY_TYPE",
      "type must be either receita or despesa."
    );
  }
  return type;
}

function normalizeProfileId(value) {
  const profileId = String(value ?? "").trim().toLowerCase();

  if (profileId !== "pf" && profileId !== "pj") {
    throw new ApiError(
      400,
      "INVALID_PROFILE_ID",
      "profile_id must be pf or pj."
    );
  }

  return profileId;
}

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
  const type = normalizeType(body.type);
  const name = String(body.name ?? "").trim();
  const normalizedName = normalizeCatalogName(body.name);
  const profileId = normalizeProfileId(body.profile_id);

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
        .from("user_categories")
        .select("id, profile_id, tipo, nome, normalized_name")
        .eq("user_id", user.user_id)
        .eq("profile_id", profileId)
        .eq("tipo", type)
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
            category: {
              id: existing.id,
              profile_id: profileId,
              type: existing.tipo,
              name: existing.nome,
              normalized_name: existing.normalized_name || normalizedName,
            },
          },
        };
      }

      const payload = {
        user_id: user.user_id,
        profile_id: profileId,
        tipo: type,
        nome: name,
        normalized_name: normalizedName,
      };

      const { data: created, error: insertError } = await supabase
        .from("user_categories")
        .insert(payload)
        .select("id, profile_id, tipo, nome, normalized_name")
        .single();

      if (insertError) throw insertError;

      return {
        statusCode: 201,
        body: {
          ok: true,
          status: "created",
          category: {
            id: created.id,
            profile_id: profileId,
            type: created.tipo,
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
