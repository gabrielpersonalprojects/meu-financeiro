const nativeCategories = require("../../shared/nativeCategories.json");
const { normalizeCatalogName } = require("./catalogNames");
const { ApiError } = require("./http");

const CATEGORY_TYPES = new Set(["receita", "despesa"]);

function requireCategoryType(type) {
  const cleanType = String(type ?? "").trim().toLowerCase();

  if (!CATEGORY_TYPES.has(cleanType)) {
    throw new Error("type must be receita or despesa.");
  }

  return cleanType;
}

async function resolveAvailableCategories({ supabase, userId, type }) {
  const cleanType = requireCategoryType(type);
  const { data, error } = await supabase
    .from("user_categories")
    .select("id, tipo, nome, normalized_name")
    .eq("user_id", userId)
    .eq("tipo", cleanType)
    .order("nome", { ascending: true });

  if (error) throw error;

  const categoriesByName = new Map();
  for (const name of nativeCategories[cleanType] ?? []) {
    const normalizedName = normalizeCatalogName(name);
    categoriesByName.set(normalizedName, {
      id: `native:${cleanType}:${normalizedName}`,
      type: cleanType,
      name,
      normalized_name: normalizedName,
      source: "native",
    });
  }

  for (const row of data ?? []) {
    const name = String(row.nome ?? "").trim();
    if (!name) continue;
    const normalizedName = normalizeCatalogName(name);
    if (categoriesByName.has(normalizedName)) continue;
    categoriesByName.set(normalizedName, {
      id: row.id,
      type: cleanType,
      name,
      normalized_name: normalizedName,
      source: "custom",
    });
  }

  return [...categoriesByName.values()].sort((left, right) =>
    left.name.localeCompare(right.name, "pt-BR")
  );
}

async function resolveCategoryByName(options) {
  const cleanName = String(options.category ?? "").trim();
  if (!cleanName) return null;
  const normalizedName = normalizeCatalogName(cleanName);
  const categories = await resolveAvailableCategories(options);
  return categories.find((item) => item.normalized_name === normalizedName) ?? null;
}

async function validateCategoryIfProvided({ supabase, userId, type, category }) {
  const cleanCategory = String(category ?? "").trim();
  if (!cleanCategory) return "";

  const found = await resolveCategoryByName({
    supabase,
    userId,
    type,
    category: cleanCategory,
  });

  if (!found) {
    throw new ApiError(
      400,
      "CATEGORY_NOT_FOUND",
      "category does not exist for this user and type."
    );
  }

  return found.name;
}

function buildContextCategories(categoryGroups) {
  return categoryGroups.flat().map((category) => ({
    id: category.id,
    type: category.type,
    name: category.name,
  }));
}

module.exports = {
  buildContextCategories,
  resolveAvailableCategories,
  resolveCategoryByName,
  validateCategoryIfProvided,
};
