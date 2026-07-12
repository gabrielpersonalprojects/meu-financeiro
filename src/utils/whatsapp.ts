const BRAZIL_COUNTRY_CODE = "55";

const onlyDigits = (value: unknown) => String(value ?? "").replace(/\D/g, "");

const toLocalBrazilDigits = (digits: string) => {
  if (digits.startsWith(BRAZIL_COUNTRY_CODE) && (digits.length === 12 || digits.length === 13)) {
    return digits.slice(2);
  }

  if (digits.length === 10 || digits.length === 11) {
    return digits;
  }

  return "";
};

export const toWhatsappDigitVariants = (value: unknown): string[] => {
  const digits = onlyDigits(value);
  if (!digits) return [];

  const variants = new Set<string>([digits]);
  const localDigits = toLocalBrazilDigits(digits);

  if (localDigits) {
    variants.add(localDigits);
    variants.add(`${BRAZIL_COUNTRY_CODE}${localDigits}`);
  }

  return Array.from(variants);
};

export const normalizeWhatsappForStorage = (value: unknown): string => {
  const digits = onlyDigits(value);
  if (!digits) return "";

  const localDigits = toLocalBrazilDigits(digits);
  if (!localDigits) return "";

  return `${BRAZIL_COUNTRY_CODE}${localDigits}`;
};

export const isValidBrazilWhatsapp = (value: unknown): boolean => {
  const canonical = normalizeWhatsappForStorage(value);
  return canonical.length === 12 || canonical.length === 13;
};

export const formatWhatsappForDisplay = (value: unknown): string => {
  const digits = onlyDigits(value);
  if (!digits) return "";

  const localDigits = toLocalBrazilDigits(digits) || digits.slice(0, 11);

  if (localDigits.length <= 10) {
    const ddd = localDigits.slice(0, 2);
    const p1 = localDigits.slice(2, 6);
    const p2 = localDigits.slice(6, 10);

    if (localDigits.length <= 2) return `(${ddd}`;
    if (localDigits.length <= 6) return `(${ddd}) ${p1}`;
    return `(${ddd}) ${p1}-${p2}`;
  }

  const ddd = localDigits.slice(0, 2);
  const p1 = localDigits.slice(2, 7);
  const p2 = localDigits.slice(7, 11);

  if (localDigits.length <= 2) return `(${ddd}`;
  if (localDigits.length <= 7) return `(${ddd}) ${p1}`;
  return `(${ddd}) ${p1}-${p2}`;
};
