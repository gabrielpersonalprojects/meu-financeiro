const crypto = require("crypto");
const { ApiError } = require("./http");

const IDEMPOTENCY_TABLE = "whatsapp_idempotency_keys";
const PROCESSING_STATUS_CODE = 102;
const PROCESSING_STATE = "processing";

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

function isUniqueViolation(error) {
  const code = String(error?.code ?? "").trim();
  const message = String(error?.message ?? "").toLowerCase();
  return code === "23505" || message.includes("duplicate key");
}

function isProcessingRow(row) {
  return (
    Number(row?.status_code) === PROCESSING_STATUS_CODE &&
    String(row?.response_body?.idempotency?.state ?? "") === PROCESSING_STATE
  );
}

function storeUnavailable(message) {
  return new ApiError(500, "IDEMPOTENCY_STORE_UNAVAILABLE", message);
}

async function fetchStoredCommand({ supabase, userId, idempotencyKey, route }) {
  const { data: rows, error } = await supabase
    .from(IDEMPOTENCY_TABLE)
    .select("request_hash, response_body, status_code")
    .eq("user_id", userId)
    .eq("idempotency_key", idempotencyKey)
    .eq("route", route)
    .limit(1);

  if (error) {
    throw storeUnavailable(
      "Idempotency store is unavailable. Apply docs/database/whatsapp_v12_phase1.sql before using POST commands."
    );
  }

  return rows?.[0] ?? null;
}

function replayStoredCommand(existing, requestHash) {
  if (String(existing?.request_hash ?? "") !== requestHash) {
    throw new ApiError(
      409,
      "IDEMPOTENCY_PAYLOAD_MISMATCH",
      "Same idempotency key was used with a different payload."
    );
  }

  if (isProcessingRow(existing)) {
    throw new ApiError(
      409,
      "IDEMPOTENCY_IN_PROGRESS",
      "A request with this idempotency key is already being processed. Retry later with the same key and payload."
    );
  }

  return {
    statusCode: Number(existing?.status_code ?? 200),
    body: existing?.response_body ?? {},
    replayed: true,
  };
}

async function reserveCommand({
  supabase,
  userId,
  providerMessageId,
  idempotencyKey,
  route,
  requestHash,
}) {
  const reservationBody = {
    ok: false,
    idempotency: {
      state: PROCESSING_STATE,
    },
  };

  const { error } = await supabase.from(IDEMPOTENCY_TABLE).insert({
    user_id: userId,
    provider_message_id: providerMessageId,
    idempotency_key: idempotencyKey,
    route,
    request_hash: requestHash,
    response_body: reservationBody,
    status_code: PROCESSING_STATUS_CODE,
  });

  return error ?? null;
}

async function releaseReservation({
  supabase,
  userId,
  idempotencyKey,
  route,
  requestHash,
}) {
  try {
    await supabase
      .from(IDEMPOTENCY_TABLE)
      .delete()
      .eq("user_id", userId)
      .eq("idempotency_key", idempotencyKey)
      .eq("route", route)
      .eq("request_hash", requestHash)
      .eq("status_code", PROCESSING_STATUS_CODE);
  } catch (error) {
    console.error("WHATSAPP_IDEMPOTENCY_RESERVATION_RELEASE_ERROR", {
      code: error?.code,
      message: error?.message,
    });
  }
}

async function persistFinalResponse({
  supabase,
  userId,
  providerMessageId,
  idempotencyKey,
  route,
  requestHash,
  statusCode,
  responseBody,
}) {
  const finalRow = {
    user_id: userId,
    provider_message_id: providerMessageId,
    idempotency_key: idempotencyKey,
    route,
    request_hash: requestHash,
    response_body: responseBody,
    status_code: statusCode,
  };

  const runUpdate = async () =>
    supabase
      .from(IDEMPOTENCY_TABLE)
      .update({
        provider_message_id: providerMessageId,
        response_body: responseBody,
        status_code: statusCode,
      })
      .eq("user_id", userId)
      .eq("idempotency_key", idempotencyKey)
      .eq("route", route)
      .eq("request_hash", requestHash);

  let { error } = await runUpdate();
  if (!error) return;

  // One retry handles short transient failures without re-running the mutation.
  ({ error } = await runUpdate());
  if (!error) return;

  // Fallback keeps the reservation row and atomically replaces it through the
  // same unique key. This is safe against the fetch-then-insert race that used
  // to create a financial record and only then fail on the idempotency insert.
  const { error: upsertError } = await supabase
    .from(IDEMPOTENCY_TABLE)
    .upsert(finalRow, {
      onConflict: "user_id,route,idempotency_key",
    });

  if (upsertError) {
    console.error("WHATSAPP_IDEMPOTENCY_FINAL_STORE_ERROR", {
      code: upsertError?.code,
      message: upsertError?.message,
      details: upsertError?.details,
      hint: upsertError?.hint,
      route,
    });

    throw storeUnavailable(
      "The financial operation completed, but its idempotency response could not be finalized. Retry with the same key; the operation will not be executed again while the reservation exists."
    );
  }
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

  const existing = await fetchStoredCommand({
    supabase,
    userId,
    idempotencyKey,
    route,
  });

  if (existing) {
    return replayStoredCommand(existing, requestHash);
  }

  // Reserve the unique key BEFORE executing the financial mutation. This
  // closes the race where two concurrent retries both passed the initial read,
  // both created data, and one failed only when storing the response.
  const reservationError = await reserveCommand({
    supabase,
    userId,
    providerMessageId,
    idempotencyKey,
    route,
    requestHash,
  });

  if (reservationError) {
    if (isUniqueViolation(reservationError)) {
      const concurrent = await fetchStoredCommand({
        supabase,
        userId,
        idempotencyKey,
        route,
      });

      if (concurrent) {
        return replayStoredCommand(concurrent, requestHash);
      }
    }

    console.error("WHATSAPP_IDEMPOTENCY_RESERVATION_ERROR", {
      code: reservationError?.code,
      message: reservationError?.message,
      details: reservationError?.details,
      hint: reservationError?.hint,
      route,
    });

    throw storeUnavailable(
      "Idempotency key could not be reserved. The financial operation was not executed."
    );
  }

  let result;
  try {
    result = await execute();
  } catch (error) {
    // Preserve existing retry behavior for command errors. The reservation is
    // removed only when execute() throws; successful mutations never depend on
    // a later INSERT to establish idempotency.
    await releaseReservation({
      supabase,
      userId,
      idempotencyKey,
      route,
      requestHash,
    });
    throw error;
  }

  const statusCode = Number(result?.statusCode ?? 200);
  const responseBody = result?.body ?? {};

  await persistFinalResponse({
    supabase,
    userId,
    providerMessageId,
    idempotencyKey,
    route,
    requestHash,
    statusCode,
    responseBody,
  });

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
