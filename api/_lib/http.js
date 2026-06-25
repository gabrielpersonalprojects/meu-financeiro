const isProduction = process.env.NODE_ENV === "production";

class ApiError extends Error {
  constructor(statusCode, code, message, details) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

function json(res, statusCode, body) {
  res.status(statusCode).json(body);
}

function errorResponse(code, message, details) {
  return {
    ok: false,
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
  };
}

function sendError(res, err) {
  const statusCode = Number(err?.statusCode || 500);
  const code = String(err?.code || "INTERNAL_ERROR");
  const message =
    err instanceof ApiError
      ? err.message
      : "Internal server error";

  const details =
    err instanceof ApiError
      ? err.details
      : isProduction
      ? undefined
      : String(err?.message || err);

  json(res, statusCode, errorResponse(code, message, details));
}

function requireMethod(req, allowedMethods) {
  const allowed = Array.isArray(allowedMethods) ? allowedMethods : [allowedMethods];

  if (!allowed.includes(req.method)) {
    throw new ApiError(405, "METHOD_NOT_ALLOWED", "Method not allowed.", {
      allowed_methods: allowed,
    });
  }
}

async function parseJson(req) {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }

  if (typeof req.body === "string" && req.body.trim()) {
    try {
      return JSON.parse(req.body);
    } catch {
      throw new ApiError(400, "INVALID_JSON", "Request body must be valid JSON.");
    }
  }

  const chunks = [];

  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch {
    throw new ApiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }
}

function requireString(value, code, message) {
  const cleaned = String(value ?? "").trim();
  if (!cleaned) {
    throw new ApiError(400, code, message);
  }
  return cleaned;
}

function withApi(handler) {
  return async function wrappedHandler(req, res) {
    try {
      await handler(req, res);
    } catch (err) {
      if (!(err instanceof ApiError)) {
        console.error("WHATSAPP_API_ERROR", err);
      }
      sendError(res, err);
    }
  };
}

module.exports = {
  ApiError,
  errorResponse,
  json,
  parseJson,
  requireMethod,
  requireString,
  sendError,
  withApi,
};
