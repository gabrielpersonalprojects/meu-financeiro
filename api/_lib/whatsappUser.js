const { ApiError } = require("./http");

function normalizeWhatsappPhone(phone) {
  const digits = String(phone ?? "").replace(/\D/g, "");

  if (!digits || digits.length < 10 || digits.length > 15) {
    throw new ApiError(
      400,
      "INVALID_WHATSAPP_PHONE",
      "whatsapp_phone must be a valid international phone number."
    );
  }

  return digits;
}

function normalizeStoredPhone(phone) {
  return String(phone ?? "").replace(/\D/g, "");
}

async function resolveWhatsappUser(supabase, whatsappPhone) {
  const normalizedPhone = normalizeWhatsappPhone(whatsappPhone);

  const { data, error } = await supabase
    .from("user_access")
    .select("user_id, whatsapp_number")
    .not("whatsapp_number", "is", null);

  if (error) throw error;

  const matches = (data ?? []).filter(
    (row) => normalizeStoredPhone(row?.whatsapp_number) === normalizedPhone
  );

  if (matches.length === 0) {
    throw new ApiError(
      404,
      "WHATSAPP_NOT_LINKED",
      "WhatsApp phone is not linked to a FluxMoney user."
    );
  }

  const userIds = Array.from(
    new Set(
      matches.map((row) => String(row?.user_id ?? "").trim()).filter(Boolean)
    )
  );

  if (userIds.length !== 1) {
    throw new ApiError(
      409,
      "WHATSAPP_PHONE_AMBIGUOUS",
      "WhatsApp phone is linked ambiguously."
    );
  }

  return {
    user_id: userIds[0],
    whatsapp_phone_normalized: normalizedPhone,
  };
}

module.exports = {
  normalizeWhatsappPhone,
  resolveWhatsappUser,
};
