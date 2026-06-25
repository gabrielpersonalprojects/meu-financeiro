const { getSupabaseAdmin } = require("../../../_lib/supabaseAdmin");
const { json, requireMethod, requireString, withApi } = require("../../../_lib/http");
const { validateSupplierAuth } = require("../../../_lib/whatsappAuth");
const { resolveWhatsappUser } = require("../../../_lib/whatsappUser");

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function getInvoiceMonth(dateIso, closingDay) {
  const date = new Date(`${dateIso}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;

  const closing = Math.min(Math.max(Number(closingDay || 1), 1), 31);
  const day = date.getUTCDate();

  if (day >= closing) {
    date.setUTCMonth(date.getUTCMonth() + 1);
  }

  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function invoiceDueDate(invoiceMonth, dueDay) {
  const [year, month] = String(invoiceMonth).split("-").map(Number);
  if (!year || !month) return null;

  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = Math.min(Math.max(Number(dueDay || 10), 1), lastDay);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
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

  const [cardsResult, txResult, paymentsResult, manualStatusResult] =
    await Promise.all([
      supabase
        .from("credit_cards")
        .select("id, nome, dia_fechamento, dia_vencimento, is_active")
        .eq("user_id", user.user_id),
      supabase
        .from("transactions")
        .select("id, tipo, valor, data, descricao, categoria, cartao_id, pago, payload")
        .eq("user_id", user.user_id)
        .eq("tipo", "cartao_credito"),
      supabase
        .from("invoice_payments")
        .select("credit_card_id, ciclo_key, amount")
        .eq("user_id", user.user_id),
      supabase
        .from("invoice_manual_status")
        .select("cartao_id, ciclo_key, status_manual")
        .eq("user_id", user.user_id),
    ]);

  for (const result of [cardsResult, txResult, paymentsResult, manualStatusResult]) {
    if (result.error) throw result.error;
  }

  const cardsById = new Map(
    (cardsResult.data ?? []).map((card) => [String(card.id), card])
  );
  const paidRefs = new Set(
    (manualStatusResult.data ?? [])
      .filter((row) => String(row?.status_manual ?? "") === "paga")
      .map((row) => `${row.cartao_id}:${row.ciclo_key}`)
  );
  const paymentTotals = new Map();

  for (const payment of paymentsResult.data ?? []) {
    const ref = `${payment.credit_card_id}:${payment.ciclo_key}`;
    paymentTotals.set(ref, (paymentTotals.get(ref) || 0) + Number(payment.amount || 0));
  }

  const invoices = new Map();

  for (const tx of txResult.data ?? []) {
    const cardId = String(tx.cartao_id || tx?.payload?.cartaoId || tx?.payload?.qualCartao || "").trim();
    const card = cardsById.get(cardId);
    if (!card || card.is_active === false) continue;

    const invoiceMonth = getInvoiceMonth(tx.data, card.dia_fechamento);
    if (!invoiceMonth) continue;

    const invoiceRef = `${cardId}:${invoiceMonth}`;
    const current = invoices.get(invoiceRef) ?? {
      invoice_ref: invoiceRef,
      credit_card_id: cardId,
      credit_card_name: card.nome || "",
      invoice_month: invoiceMonth,
      due_date: invoiceDueDate(invoiceMonth, card.dia_vencimento),
      amount: 0,
      transaction_count: 0,
    };

    current.amount += Math.abs(Number(tx.valor || 0));
    current.transaction_count += 1;
    invoices.set(invoiceRef, current);
  }

  const today = todayIso();
  const payable = Array.from(invoices.values())
    .filter((invoice) => invoice.amount > 0)
    .map((invoice) => {
      const paidAmount = Number(paymentTotals.get(invoice.invoice_ref) || 0);
      return {
        ...invoice,
        paid_amount: paidAmount,
        remaining_amount: Math.max(0, invoice.amount - paidAmount),
        status: invoice.due_date && invoice.due_date < today ? "overdue" : "closed",
      };
    })
    .filter((invoice) => {
      if (paidRefs.has(invoice.invoice_ref)) return false;
      if (invoice.remaining_amount <= 0) return false;
      return invoice.due_date && invoice.due_date <= today;
    })
    .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)));

  json(res, 200, {
    ok: true,
    representation: {
      invoice_id_available: false,
      invoice_ref_format: "credit_card_id:YYYY-MM",
    },
    invoices: payable,
  });
});
