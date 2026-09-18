const crypto = require("crypto");
const { getSupabaseAdmin } = require("../_lib/supabaseAdmin");
const { normalizeWhatsappPhone } = require("../_lib/whatsappUser");

const MAX_ATTEMPTS = 3;
const REQUEST_TIMEOUT_MS = 10000;

function json(res, statusCode, body) {
  return res.status(statusCode).json(body);
}

function bearerToken(req) {
  const authorization = String(req.headers?.authorization || "").trim();
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return String(match?.[1] || "").trim();
}

function firstNameFromUser(user) {
  const metadata = user?.user_metadata || {};
  const fullName = String(
    metadata.display_name ||
      metadata.full_name ||
      metadata.name ||
      ""
  ).trim();
  const fallback = String(user?.email || "").split("@")[0].trim();
  return String(fullName || fallback)
    .split(/\s+/)[0]
    .replace(/[<>\u0000-\u001f]/g, "")
    .slice(0, 80);
}

function eventIdFor(userId, whatsapp) {
  return `fluxmoney-user-whatsapp-linked-${crypto
    .createHash("sha256")
    .update(`${userId}:${whatsapp}`)
    .digest("hex")}`;
}

async function sendWebhook({ url, payload, eventId }) {
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Idempotency-Key": eventId,
          "X-FluxMoney-Event": "user.whatsapp_linked",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const responseText = await response.text().catch(() => "");
      if (response.ok) {
        return { status: response.status, responseText };
      }

      lastError = new Error(`Nimble webhook returned HTTP ${response.status}.`);
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        break;
      }
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError || new Error("Nimble webhook delivery failed.");
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { ok: false, error: "METHOD_NOT_ALLOWED" });
  }

  const token = bearerToken(req);
  if (!token) {
    return json(res, 401, { ok: false, error: "AUTH_REQUIRED" });
  }

  const webhookUrl = String(
    process.env.NIMBLE_USER_REGISTRATION_WEBHOOK_URL || ""
  ).trim();
  if (!webhookUrl) {
    return json(res, 503, {
      ok: false,
      error: "NIMBLE_WEBHOOK_NOT_CONFIGURED",
    });
  }

  const supabase = getSupabaseAdmin();
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  const user = authData?.user;

  if (authError || !user?.id) {
    return json(res, 401, { ok: false, error: "INVALID_SESSION" });
  }

  const { data: access, error: accessError } = await supabase
    .from("user_access")
    .select("whatsapp_number, whatsapp_number_normalized")
    .eq("user_id", user.id)
    .maybeSingle();

  if (accessError) throw accessError;

  const whatsapp = normalizeWhatsappPhone(
    access?.whatsapp_number_normalized || access?.whatsapp_number || ""
  );
  const firstName = firstNameFromUser(user);

  if (!whatsapp) {
    return json(res, 409, { ok: false, error: "WHATSAPP_NOT_REGISTERED" });
  }

  if (!firstName) {
    return json(res, 409, { ok: false, error: "FIRST_NAME_NOT_REGISTERED" });
  }

  const eventId = eventIdFor(user.id, whatsapp);
  const { data: claimed, error: claimError } = await supabase.rpc(
    "claim_nimble_welcome_delivery",
    {
      p_user_id: user.id,
      p_whatsapp: whatsapp,
      p_event_id: eventId,
    }
  );

  if (claimError) throw claimError;

  if (claimed !== true) {
    return json(res, 200, {
      ok: true,
      status: "already_sent_or_in_progress",
      event_id: eventId,
    });
  }

  const payload = {
    whatsapp,
    first_name: firstName,
  };

  try {
    const delivery = await sendWebhook({ url: webhookUrl, payload, eventId });

    const { error: markError } = await supabase
      .from("user_access")
      .update({
        nimble_welcome_status: "sent",
        nimble_welcome_sent_at: new Date().toISOString(),
        nimble_welcome_last_error: null,
      })
      .eq("user_id", user.id)
      .eq("nimble_welcome_event_id", eventId);

    if (markError) throw markError;

    return json(res, 200, {
      ok: true,
      status: "sent",
      event_id: eventId,
      webhook_status: delivery.status,
    });
  } catch (error) {
    const safeMessage = String(error?.message || "Nimble webhook delivery failed.")
      .slice(0, 500);

    await supabase
      .from("user_access")
      .update({
        nimble_welcome_status: "failed",
        nimble_welcome_last_error: safeMessage,
      })
      .eq("user_id", user.id)
      .eq("nimble_welcome_event_id", eventId);

    console.error("NIMBLE_USER_REGISTRATION_WEBHOOK_ERROR", {
      user_id: user.id,
      event_id: eventId,
      message: safeMessage,
    });

    return json(res, 502, {
      ok: false,
      error: "NIMBLE_WEBHOOK_DELIVERY_FAILED",
      retryable: true,
      event_id: eventId,
    });
  }
};

module.exports.firstNameFromUser = firstNameFromUser;
module.exports.eventIdFor = eventIdFor;
module.exports.sendWebhook = sendWebhook;
