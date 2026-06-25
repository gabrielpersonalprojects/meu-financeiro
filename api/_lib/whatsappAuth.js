const { ApiError } = require("./http");

function validateSupplierAuth(req) {
  const expectedToken = String(process.env.SUPPLIER_API_TOKEN ?? "").trim();

  if (!expectedToken) {
    throw new ApiError(
      500,
      "SERVER_MISCONFIGURED",
      "Supplier API token is not configured."
    );
  }

  const header = String(req.headers.authorization ?? "").trim();
  const token = header.startsWith("Bearer ")
    ? header.slice("Bearer ".length).trim()
    : "";

  if (!token || token !== expectedToken) {
    throw new ApiError(401, "INVALID_TOKEN", "Invalid supplier token.");
  }
}

function rejectUserIdFromSupplier(body) {
  if (!body || typeof body !== "object") return;

  if (Object.prototype.hasOwnProperty.call(body, "user_id")) {
    throw new ApiError(
      400,
      "USER_ID_NOT_ACCEPTED",
      "Financial commands must resolve the user by whatsapp_phone."
    );
  }
}

module.exports = {
  rejectUserIdFromSupplier,
  validateSupplierAuth,
};
