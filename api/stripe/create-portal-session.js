const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const appUrl = process.env.APP_URL;

if (!stripeSecretKey) {
  throw new Error("Missing STRIPE_SECRET_KEY");
}

if (!supabaseUrl) {
  throw new Error("Missing SUPABASE_URL");
}

if (!supabaseServiceRoleKey) {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
}

if (!appUrl) {
  throw new Error("Missing APP_URL");
}

const stripe = new Stripe(stripeSecretKey);
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { userId } = req.body || {};

    if (!userId) {
      return res.status(400).json({ error: "Missing userId" });
    }

    const { data: subscription, error } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id, status")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("Erro ao buscar assinatura no Supabase:", error);
      return res.status(500).json({ error: "Failed to load subscription" });
    }

    if (!subscription?.stripe_customer_id) {
      return res.status(404).json({ error: "Stripe customer not found" });
    }

const portalSession = await stripe.billingPortal.sessions.create({
  customer: subscription.stripe_customer_id,
  return_url: `${appUrl}/?billing=returned`,
  locale: "pt-BR",
});

    return res.status(200).json({ url: portalSession.url });
  } catch (error) {
    console.error("Erro ao criar sessão do portal:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};