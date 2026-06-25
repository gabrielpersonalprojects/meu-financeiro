const { ApiError } = require("./http");

function normalizeCatalogName(name) {
  const normalized = String(name ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");

  if (!normalized) {
    throw new ApiError(400, "INVALID_CATALOG_NAME", "Catalog name is required.");
  }

  return normalized;
}

module.exports = {
  normalizeCatalogName,
};
