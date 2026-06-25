const { getSupabaseAdmin } = require("../../_lib/supabaseAdmin");
const { json, requireMethod, requireString, withApi } = require("../../_lib/http");
const { validateSupplierAuth } = require("../../_lib/whatsappAuth");
const { resolveWhatsappUser } = require("../../_lib/whatsappUser");

function mapAccount(row) {
  return {
    id: row.id,
    name: row.name || row.banco || "Conta",
    bank: row.banco || "",
    account_type: row.tipo_conta || "",
    profile_type: row.perfil_conta || "",
  };
}

function mapCreditCard(row) {
  return {
    id: row.id,
    name: row.nome || "",
    issuer: row.bank_text || row.titular || "",
    category: row.categoria || "",
    closing_day: Number(row.dia_fechamento || 1),
    due_day: Number(row.dia_vencimento || 10),
    is_active: row.is_active !== false,
  };
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

  const [
    accountsResult,
    cardsResult,
    categoriesResult,
    tagsResult,
  ] = await Promise.all([
    supabase
      .from("accounts")
      .select("id, banco, name, tipo_conta, perfil_conta")
      .eq("user_id", user.user_id)
      .order("created_at", { ascending: true }),
    supabase
      .from("credit_cards")
      .select("id, nome, titular, bank_text, categoria, dia_fechamento, dia_vencimento, is_active")
      .eq("user_id", user.user_id)
      .order("created_at", { ascending: false }),
    supabase
      .from("user_categories")
      .select("id, profile_id, tipo, nome")
      .eq("user_id", user.user_id)
      .order("nome", { ascending: true }),
    supabase
      .from("user_tags")
      .select("id, nome")
      .eq("user_id", user.user_id)
      .order("nome", { ascending: true }),
  ]);

  for (const result of [accountsResult, cardsResult, categoriesResult, tagsResult]) {
    if (result.error) throw result.error;
  }

  json(res, 200, {
    ok: true,
    user: {
      user_id: user.user_id,
      whatsapp_phone_normalized: user.whatsapp_phone_normalized,
    },
    accounts: (accountsResult.data ?? []).map(mapAccount),
    credit_cards: (cardsResult.data ?? []).map(mapCreditCard),
    categories: (categoriesResult.data ?? []).map((row) => ({
      id: row.id,
      profile_id: String(row.profile_id ?? "").trim().toLowerCase(),
      type: row.tipo,
      name: row.nome,
    })),
    profiles: [
      { id: "pf", label: "PF" },
      { id: "pj", label: "PJ" },
    ],
    credit_card_tags: (tagsResult.data ?? []).map((row) => ({
      id: row.id,
      name: row.nome,
    })),
    rules: {
      public_contract_language: "en",
      transaction_types: ["receita", "despesa", "transferencia", "cartao_credito"],
      category_types: ["receita", "despesa"],
      user_id_from_supplier_body: "not_accepted",
      invoice_ref_format: "credit_card_id:YYYY-MM",
    },
  });
});
