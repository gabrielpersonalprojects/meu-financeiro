import type { VercelRequest, VercelResponse } from "@vercel/node";
import Stripe from "stripe";

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

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2026-02-25.clover",
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { email, userId } = req.body ?? {};

    if (!email || !userId) {
      return res.status(400).json({ error: "Missing email or userId" });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
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
    return res.status(500).json({ error: "Internal server error" });
  }
}