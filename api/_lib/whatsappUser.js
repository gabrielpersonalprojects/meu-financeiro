const { ApiError } = require("./http");

const BRAZIL_COUNTRY_CODE = "55";

function onlyDigits(value) {
  return String(value ?? "").replace(/\D/g, "");
}

function getBrazilLocalDigits(digits) {
  if (digits.startsWith(BRAZIL_COUNTRY_CODE) && (digits.length === 12 || digits.length === 13)) {
    return digits.slice(2);
  }

  if (digits.length === 10 || digits.length === 11) {
    return digits;
  }

  return "";
}

function toCanonicalBrazilPhone(value) {
  const digits = onlyDigits(value);
  const localDigits = getBrazilLocalDigits(digits);

  if (!localDigits) return digits;

  return `${BRAZIL_COUNTRY_CODE}${localDigits}`;
}

function toEquivalentDigits(value) {
  const digits = onlyDigits(value);
  if (!digits) return [];

  const variants = new Set([digits]);
  const localDigits = getBrazilLocalDigits(digits);

  if (localDigits) {
    variants.add(localDigits);
    variants.add(`${BRAZIL_COUNTRY_CODE}${localDigits}`);
  }

  return Array.from(variants);
}

function normalizeWhatsappPhone(phone) {
  const digits = onlyDigits(phone);

  if (!digits || digits.length < 10 || digits.length > 15) {
    throw new ApiError(
      400,
      "INVALID_WHATSAPP_PHONE",
      "whatsapp_phone must be a valid international phone number."
    );
  }

  return toCanonicalBrazilPhone(digits);
}

function normalizeStoredPhone(phone) {
  return onlyDigits(phone);
}

async function resolveWhatsappUser(supabase, whatsappPhone) {
  const normalizedPhone = normalizeWhatsappPhone(whatsappPhone);
  const inputVariants = new Set(toEquivalentDigits(normalizedPhone));

  const { data, error } = await supabase
    .from("user_access")
    .select("user_id, whatsapp_number")
    .not("whatsapp_number", "is", null);

  if (error) throw error;

  const matches = (data ?? []).filter(
    (row) => {
      const storedPhone = normalizeStoredPhone(row?.whatsapp_number);
      if (!storedPhone) return false;

      const storedVariants = toEquivalentDigits(storedPhone);
      return storedVariants.some((item) => inputVariants.has(item));
    }
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
