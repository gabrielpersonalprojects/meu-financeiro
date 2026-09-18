const { ApiError } = require("./http");

const BRAZIL_COUNTRY_CODE = "55";
const DDD_WITH_MANDATORY_NINTH_DIGIT = new Set([
  "11", "12", "13", "14", "15", "16", "17", "18", "19",
  "22", "24", "27", "28",
]);

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

  if (!localDigits) return "";

  const ddd = localDigits.slice(0, 2);
  let subscriber = localDigits.slice(2);

  if (DDD_WITH_MANDATORY_NINTH_DIGIT.has(ddd)) {
    if (subscriber.length === 8) subscriber = `9${subscriber}`;
    if (subscriber.length !== 9) return "";
  } else {
    if (subscriber.length === 9 && subscriber.startsWith("9")) {
      subscriber = subscriber.slice(1);
    }
    if (subscriber.length !== 8) return "";
  }

  return `${BRAZIL_COUNTRY_CODE}${ddd}${subscriber}`;
}

function toEquivalentDigits(value) {
  const digits = onlyDigits(value);
  if (!digits) return [];

  const variants = new Set([digits]);
  const localDigits = getBrazilLocalDigits(digits);
  const canonical = toCanonicalBrazilPhone(digits);

  if (localDigits) {
    variants.add(localDigits);
    variants.add(`${BRAZIL_COUNTRY_CODE}${localDigits}`);
  }

  if (canonical) {
    const canonicalLocal = canonical.slice(2);
    variants.add(canonical);
    variants.add(canonicalLocal);

    const ddd = canonicalLocal.slice(0, 2);
    const subscriber = canonicalLocal.slice(2);
    if (!DDD_WITH_MANDATORY_NINTH_DIGIT.has(ddd) && subscriber.length === 8) {
      variants.add(`${ddd}9${subscriber}`);
      variants.add(`${BRAZIL_COUNTRY_CODE}${ddd}9${subscriber}`);
    }
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

  const canonical = toCanonicalBrazilPhone(digits);
  if (!canonical) {
    throw new ApiError(
      400,
      "INVALID_WHATSAPP_PHONE",
      "whatsapp_phone must be a valid Brazilian phone number with DDD."
    );
  }

  return canonical;
}

function normalizeStoredPhone(phone) {
  return toCanonicalBrazilPhone(phone) || onlyDigits(phone);
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
  toEquivalentDigits,
};
