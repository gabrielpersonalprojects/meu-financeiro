const { ApiError, json, requireMethod, withApi } = require("../_lib/http");
const { renewOpenEndedRecurrences } = require("../_lib/recurrenceRenewal");

module.exports = withApi(async function handler(req, res) {
  requireMethod(req, "GET");
  const expected = String(process.env.CRON_SECRET || "").trim();
  const authorization = String(req.headers.authorization || "").trim();
  if (!expected || authorization !== `Bearer ${expected}`) {
    return json(res, 401, { ok: false, error: { code: "INVALID_CRON_TOKEN", message: "Invalid cron token." } });
  }
  const today = new Date().toISOString().slice(0, 10);
  try {
    const { getSupabaseAdmin } = require("../_lib/supabaseAdmin");
    const result = await renewOpenEndedRecurrences({ supabase: getSupabaseAdmin(), today });
    json(res, 200, { ok: true, date: today, ...result });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error("RECURRING_CRON_ERROR", {
      code: String(error?.code || "UNEXPECTED_ERROR"),
    });
    throw new ApiError(
      500,
      "RECURRING_RENEWAL_FAILED",
      "Automatic recurrence renewal failed. A retry is safe."
    );
  }
});
