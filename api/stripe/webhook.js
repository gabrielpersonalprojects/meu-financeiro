const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getRawBody(readable) {
  const chunks = [];

  for await (const chunk of readable) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  return Buffer.concat(chunks);
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  const sig = req.headers["stripe-signature"];

  let event;

  try {
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;

        const userId = session?.metadata?.userId || null;
        const stripeCustomerId = session.customer || null;
        const stripeSubscriptionId = session.subscription || null;

        if (userId) {
          const { error } = await supabase
            .from("subscriptions")
            .update({
              stripe_customer_id: stripeCustomerId,
              stripe_subscription_id: stripeSubscriptionId,
              status: "active",
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", userId);

          if (error) {
            console.error("Erro ao atualizar checkout.session.completed:", error);
            throw error;
          }
        }

        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object;

        const userId = subscription?.metadata?.userId || null;
        const stripeCustomerId = subscription.customer || null;
        const stripeSubscriptionId = subscription.id || null;
        const status = subscription.status || "inactive";
        const priceId = subscription?.items?.data?.[0]?.price?.id || null;
        const currentPeriodEndUnix = subscription.current_period_end || null;
        const currentPeriodEnd = currentPeriodEndUnix
          ? new Date(currentPeriodEndUnix * 1000).toISOString()
          : null;
        const cancelAtPeriodEnd = !!subscription.cancel_at_period_end;

        if (userId) {
          const { error } = await supabase
            .from("subscriptions")
            .update({
              stripe_customer_id: stripeCustomerId,
              stripe_subscription_id: stripeSubscriptionId,
              status,
              price_id: priceId,
              current_period_end: currentPeriodEnd,
              cancel_at_period_end: cancelAtPeriodEnd,
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", userId);

          if (error) {
            console.error(`Erro ao atualizar ${event.type}:`, error);
            throw error;
          }
        }

        break;
      }

      default:
        console.log(`Evento ignorado: ${event.type}`);
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("Erro no processamento do webhook:", error);
    return res.status(500).json({ error: "Webhook handler failed" });
  }
};