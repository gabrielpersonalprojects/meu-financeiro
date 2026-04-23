const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const appUrl = process.env.APP_URL;
const stripePriceId = process.env.STRIPE_PRICE_ID;
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey =
  process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!stripeSecretKey) {
  throw new Error("Missing STRIPE_SECRET_KEY");
}

if (!appUrl) {
  throw new Error("Missing APP_URL");
}

if (!stripePriceId) {
  throw new Error("Missing STRIPE_PRICE_ID");
}

if (!supabaseUrl) {
  throw new Error("Missing SUPABASE_URL");
}

if (!supabaseAnonKey) {
  throw new Error("Missing SUPABASE_ANON_KEY");
}

const stripe = new Stripe(stripeSecretKey);

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length).trim()
      : "";

    if (!token) {
      return res.status(401).json({ error: "Missing bearer token" });
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser(token);

    if (authError || !user?.id || !user?.email) {
      console.error("Erro ao validar usuário da sessão:", authError);
      return res.status(401).json({ error: "Invalid session" });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      locale: "pt-BR",
      payment_method_types: ["card"],
      customer_email: user.email,
      client_reference_id: String(user.id),
      line_items: [
        {
          price: stripePriceId,
          quantity: 1,
        },
      ],
      metadata: {
        userId: String(user.id),
      },
      subscription_data: {
        metadata: {
          userId: String(user.id),
        },
      },
      success_url: `${appUrl}?checkout=success`,
      cancel_url: `${appUrl}?checkout=cancel`,
    });

    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error("Erro ao criar checkout session:", error);

    return res.status(500).json({
      error: error?.message || "Internal server error",
      type: error?.type || null,
      code: error?.code || null,
      param: error?.param || null,
    });
  }
};