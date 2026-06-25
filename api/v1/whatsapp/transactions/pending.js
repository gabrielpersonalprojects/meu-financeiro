const { getSupabaseAdmin } = require("../../../_lib/supabaseAdmin");
const { json, requireMethod, requireString, withApi } = require("../../../_lib/http");
const { validateSupplierAuth } = require("../../../_lib/whatsappAuth");
const { resolveWhatsappUser } = require("../../../_lib/whatsappUser");

function parseLimit(value) {
  const limit = Number(value || 50);
  if (!Number.isFinite(limit)) return 50;
  return Math.min(Math.max(Math.trunc(limit), 1), 100);
}

module.exports = withApi(async function handler(req, res) {
  requireMethod(req, "GET");
  validateSupplierAuth(req);

  const whatsappPhone = requireString(
    req.query?.whatsapp_phone,
    "WHATSAPP_PHONE_REQUIRED",
    "whatsapp_phone query parameter is required."
  );

  const supabase = getSupabaseAdmin();
  const user = await resolveWhatsappUser(supabase, whatsappPhone);
  const limit = parseLimit(req.query?.limit);
  const type = String(req.query?.type ?? "").trim();
  const accountId = String(req.query?.account_id ?? "").trim();

  let query = supabase
    .from("transactions")
    .select("id, tipo, valor, data, descricao, categoria, tag, conta_id, qual_conta, pago, payload")
    .eq("user_id", user.user_id)
    .eq("pago", false)
    .in("tipo", ["receita", "despesa"])
    .order("data", { ascending: true })
    .limit(limit);

  if (type === "receita" || type === "despesa") {
    query = query.eq("tipo", type);
  }

  if (accountId) {
    query = query.eq("conta_id", accountId);
  }

  const { data, error } = await query;
  if (error) throw error;

  json(res, 200, {
    ok: true,
    transactions: (data ?? []).map((row) => ({
      id: row.id,
      type: row.tipo,
      amount: Number(row.valor || 0),
      date: row.data,
      description: row.descricao || "",
      category: row.categoria || "",
      tag: row.tag || "",
      account_id: row.conta_id || row.qual_conta || null,
      paid: Boolean(row.pago),
    })),
  });
});
