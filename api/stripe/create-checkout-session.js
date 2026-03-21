const Stripe = require("stripe");

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const appUrl = process.env.APP_URL;
const stripePriceId = process.env.STRIPE_PRICE_ID;

if (!stripeSecretKey) {
  throw new Error("Missing STRIPE_SECRET_KEY");
}

if (!appUrl) {
  throw new Error("Missing APP_URL");
}

if (!stripePriceId) {
  throw new Error("Missing STRIPE_PRICE_ID");
}

const stripe = new Stripe(stripeSecretKey);

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { email, userId } = req.body || {};

    if (!email || !userId) {
      return res.status(400).json({ error: "Missing email or userId" });
    }

    console.log("DEBUG CHECKOUT ENV", {
      stripePriceId,
      stripeSecretKeyStartsWith: stripeSecretKey?.slice(0, 8),
      appUrl,
    });

    try {
      const prices = await stripe.prices.list({ limit: 10 });
      console.log(
        "DEBUG STRIPE PRICES",
        prices.data.map((p) => ({
          id: p.id,
          product: p.product,
          active: p.active,
          livemode: p.livemode,
          unit_amount: p.unit_amount,
          recurring: p.recurring?.interval || null,
        }))
      );
    } catch (priceListError) {
      console.error("DEBUG STRIPE PRICES ERROR", priceListError);
    }

    try {
      const selectedPrice = await stripe.prices.retrieve(stripePriceId);
      console.log("DEBUG SELECTED PRICE", {
        id: selectedPrice.id,
        product: selectedPrice.product,
        active: selectedPrice.active,
        livemode: selectedPrice.livemode,
        unit_amount: selectedPrice.unit_amount,
        recurring: selectedPrice.recurring?.interval || null,
      });
    } catch (selectedPriceError) {
      console.error("DEBUG SELECTED PRICE ERROR", selectedPriceError);
      throw selectedPriceError;
    }
console.error("DEBUG CHECKOUT ENV", {
  stripePriceId,
  stripeSecretKeyStartsWith: stripeSecretKey?.slice(0, 8),
  appUrl,
});

try {
  const prices = await stripe.prices.list({ limit: 10 });
  console.error(
    "DEBUG STRIPE PRICES",
    prices.data.map((p) => ({
      id: p.id,
      product: p.product,
      active: p.active,
      livemode: p.livemode,
      unit_amount: p.unit_amount,
      recurring: p.recurring?.interval || null,
    }))
  );
} catch (priceListError) {
  console.error("DEBUG STRIPE PRICES ERROR", priceListError);
}

try {
  const selectedPrice = await stripe.prices.retrieve(stripePriceId);
  console.error("DEBUG SELECTED PRICE", {
    id: selectedPrice.id,
    product: selectedPrice.product,
    active: selectedPrice.active,
    livemode: selectedPrice.livemode,
    unit_amount: selectedPrice.unit_amount,
    recurring: selectedPrice.recurring?.interval || null,
  });
} catch (selectedPriceError) {
  console.error("DEBUG SELECTED PRICE ERROR", selectedPriceError);
  throw selectedPriceError;
}
const stripeAccount = await stripe.accounts.retrieve();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      locale: "pt-BR",
      payment_method_types: ["card"],
      customer_email: email,
      line_items: [
        {
          price: stripePriceId,
          quantity: 1,
        },
      ],
      metadata: {
        userId: String(userId),
      },
      subscription_data: {
        metadata: {
          userId: String(userId),
        },
      },
      success_url: `${appUrl}?checkout=success`,
      cancel_url: `${appUrl}?checkout=cancel`,
    });

    return res.status(200).json({ url: session.url });
} catch (error) {
  console.error("Erro ao criar checkout session:", error);

  let stripeAccountId = null;
  let stripeAccountEmail = null;

  try {
    const stripeAccount = await stripe.accounts.retrieve();
    stripeAccountId = stripeAccount?.id || null;
    stripeAccountEmail = stripeAccount?.email || null;
  } catch (_) {}

  return res.status(500).json({
    error: error?.message || "Internal server error",
    type: error?.type || null,
    code: error?.code || null,
    param: error?.param || null,
    stripePriceId,
    stripeSecretKeyStartsWith: stripeSecretKey?.slice(0, 8),
    stripeAccountId,
    stripeAccountEmail,
    appUrl,
  });
}
};