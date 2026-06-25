const crypto = require("crypto");
const { ApiError } = require("./http");

function stableStringify(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(",")}}`;
}

function hashPayload(payload) {
  return crypto
    .createHash("sha256")
    .update(stableStringify(payload ?? {}))
    .digest("hex");
}

function requireIdempotencyKey(req) {
  const key = String(req.headers["x-idempotency-key"] ?? "").trim();

  if (!key) {
    throw new ApiError(
      400,
      "IDEMPOTENCY_KEY_REQUIRED",
      "X-Idempotency-Key header is required."
    );
  }

  return key;
}

async function runIdempotentCommand({
  supabase,
  userId,
  providerMessageId,
  idempotencyKey,
  route,
  requestBody,
  execute,
}) {
  const requestHash = hashPayload(requestBody);

  const { data: existingRows, error: fetchError } = await supabase
    .from("whatsapp_idempotency_keys")
    .select("request_hash, response_body, status_code")
    .eq("user_id", userId)
    .eq("idempotency_key", idempotencyKey)
    .eq("route", route)
    .limit(1);

  if (fetchError) {
    throw new ApiError(
      500,
      "IDEMPOTENCY_STORE_UNAVAILABLE",
      "Idempotency store is unavailable. Apply docs/database/whatsapp_v12_phase1.sql before using POST commands."
    );
  }

  const existing = existingRows?.[0] ?? null;

  if (existing) {
    if (String(existing.request_hash ?? "") !== requestHash) {
      throw new ApiError(
        409,
        "IDEMPOTENCY_PAYLOAD_MISMATCH",
        "Same idempotency key was used with a different payload."
      );
    }

    return {
      statusCode: Number(existing.status_code ?? 200),
      body: existing.response_body,
      replayed: true,
    };
  }

  const result = await execute();
  const statusCode = Number(result?.statusCode ?? 200);
  const responseBody = result?.body ?? {};

  const { error: insertError } = await supabase
    .from("whatsapp_idempotency_keys")
    .insert({
      user_id: userId,
      provider_message_id: providerMessageId,
      idempotency_key: idempotencyKey,
      route,
      request_hash: requestHash,
      response_body: responseBody,
      status_code: statusCode,
    });

  if (insertError) {
    throw new ApiError(
      500,
      "IDEMPOTENCY_STORE_UNAVAILABLE",
      "Idempotency response could not be stored."
    );
  }

  return {
    statusCode,
    body: responseBody,
    replayed: false,
  };
}

module.exports = {
  hashPayload,
  requireIdempotencyKey,
  runIdempotentCommand,
};
