const nativeCategories = require("../../shared/nativeCategories.json");
const { normalizeCatalogName } = require("./catalogNames");
const { ApiError } = require("./http");

const CATEGORY_TYPES = new Set(["receita", "despesa"]);

function previewCategoryDebug(stage, details) {
  if (process.env.VERCEL_ENV !== "preview") return;
  console.log(`[whatsapp-category-debug] ${JSON.stringify({ stage, ...details })}`);
}

function requireCategoryType(type) {
  const cleanType = String(type ?? "").trim().toLowerCase();

  if (!CATEGORY_TYPES.has(cleanType)) {
    throw new Error("type must be receita or despesa.");
  }

  return cleanType;
}

async function resolveAvailableCategories(options) {
  const { supabase, userId, type } = options;
  const action = options.action;
  const cleanType = requireCategoryType(type);
  previewCategoryDebug("resolveAvailableCategories:entry", {
    action: action || "category_resolution",
    userIdPresent: Boolean(String(userId ?? "").trim()),
    rawType: type,
    normalizedType: cleanType,
    argumentFormat: "object",
    argumentOrder: ["supabase", "userId", "type", "action"],
  });
  const { data, error } = await supabase
    .from("user_categories")
    .select("id, tipo, nome, normalized_name")
    .eq("user_id", userId)
    .eq("tipo", cleanType)
    .order("nome", { ascending: true });

  if (error) throw error;

  const categoriesByName = new Map();
  const nativeNames = nativeCategories[cleanType] ?? [];
  previewCategoryDebug("resolveAvailableCategories:native-loaded", {
    action: action || "category_resolution",
    normalizedType: cleanType,
    nativeCount: nativeNames.length,
    nativeNormalizedNames: nativeNames.map((name) => normalizeCatalogName(name)),
  });
  for (const name of nativeNames) {
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

  const resolved = [...categoriesByName.values()].sort((left, right) =>
    left.name.localeCompare(right.name, "pt-BR")
  );
  previewCategoryDebug("resolveAvailableCategories:resolved", {
    action: action || "category_resolution",
    normalizedType: cleanType,
    nativeCount: nativeNames.length,
    customCount: (data ?? []).length,
    totalResolved: resolved.length,
    availableNormalizedNames: resolved.map((item) => item.normalized_name),
  });
  return resolved;
}

async function resolveCategoryByName(options) {
  const cleanName = String(options.category ?? "").trim();
  if (!cleanName) return null;
  const normalizedName = normalizeCatalogName(cleanName);
  const categories = await resolveAvailableCategories(options);
  const found = categories.find((item) => item.normalized_name === normalizedName) ?? null;
  previewCategoryDebug("resolveCategoryByName:result", {
    action: options.action || "category_resolution",
    userIdPresent: Boolean(String(options.userId ?? "").trim()),
    rawType: options.type,
    normalizedType: String(options.type ?? "").trim().toLowerCase(),
    rawCategory: options.category,
    normalizedCategory: normalizedName,
    nativeCount: categories.filter((item) => item.source === "native").length,
    customCount: categories.filter((item) => item.source === "custom").length,
    totalResolved: categories.length,
    availableNormalizedNames: categories.map((item) => item.normalized_name),
    matchedCategory: found
      ? { id: found.id, type: found.type, name: found.name, normalizedName: found.normalized_name }
      : null,
  });
  return found;
}

async function validateCategoryIfProvided(options) {
  const { supabase, userId, type, category, action } = options;
  const cleanCategory = String(category ?? "").trim();
  if (!cleanCategory) return "";

  previewCategoryDebug("validateCategoryIfProvided:entry", {
    action: action || "category_validation",
    userIdPresent: Boolean(String(userId ?? "").trim()),
    rawType: type,
    normalizedType: String(type ?? "").trim().toLowerCase(),
    rawCategory: category,
    normalizedCategory: normalizeCatalogName(cleanCategory),
    argumentFormat: "object",
    argumentOrder: Object.keys(options),
  });

  const found = await resolveCategoryByName({
    supabase,
    userId,
    type,
    category: cleanCategory,
    action,
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
