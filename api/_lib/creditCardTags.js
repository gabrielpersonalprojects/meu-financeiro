const { normalizeCatalogName } = require("./catalogNames");
const { ApiError } = require("./http");

function getCanonicalTagName(row) {
  return String(row?.nome ?? "").trim();
}

function getEffectiveNormalizedTagName(row) {
  const canonicalName = getCanonicalTagName(row);
  if (!canonicalName) return "";

  const normalizedFromName = normalizeCatalogName(canonicalName);
  const storedNormalizedName = String(row?.normalized_name ?? "").trim();
  if (!storedNormalizedName) return normalizedFromName;

  try {
    const normalizedStoredName = normalizeCatalogName(storedNormalizedName);
    return normalizedStoredName === normalizedFromName
      ? normalizedStoredName
      : normalizedFromName;
  } catch {
    return normalizedFromName;
  }
}

async function listCreditCardTags({ supabase, userId }) {
  const { data, error } = await supabase
    .from("user_tags")
    .select("id, nome, normalized_name")
    .eq("user_id", userId)
    .order("nome", { ascending: true });

  if (error) throw error;

  return (data ?? [])
    .map((row) => {
      const name = getCanonicalTagName(row);
      if (!name) return null;

      return {
        id: row.id,
        name,
        normalized_name: getEffectiveNormalizedTagName(row),
      };
    })
    .filter(Boolean);
}

async function resolveCreditCardTagByName({ supabase, userId, tag }) {
  const cleanTag = String(tag ?? "").trim();
  if (!cleanTag) return null;

  const normalizedName = normalizeCatalogName(cleanTag);
  const availableTags = await listCreditCardTags({ supabase, userId });
  return availableTags.find((item) => item.normalized_name === normalizedName) ?? null;
}

async function validateCreditCardTagIfProvided({ supabase, userId, tag }) {
  const cleanTag = String(tag ?? "").trim();
  if (!cleanTag) return "";

  const found = await resolveCreditCardTagByName({
    supabase,
    userId,
    tag: cleanTag,
  });

  if (!found) {
    throw new ApiError(
      400,
      "TAG_NOT_FOUND",
      "tag does not exist for this user."
    );
  }

  return found.name;
}

module.exports = {
  listCreditCardTags,
  resolveCreditCardTagByName,
  validateCreditCardTagIfProvided,
};