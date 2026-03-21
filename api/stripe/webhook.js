const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
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
  console.log("=== STRIPE SUBSCRIPTION EVENT ===");
console.log("event.type:", event.type);
console.log("subscription.id:", subscription?.id);
console.log("subscription.status:", subscription?.status);
console.log("subscription.cancel_at_period_end:", subscription?.cancel_at_period_end);
console.log("subscription.current_period_end:", subscription?.current_period_end);
console.log("subscription.cancel_at:", subscription?.cancel_at);
console.log(
  "subscription.items.data[0].current_period_end:",
  subscription?.items?.data?.[0]?.current_period_end
);
console.log(
  "event.previous_attributes:",
  event?.data?.previous_attributes || null
);
console.log(
  "subscription payload:",
  JSON.stringify(subscription, null, 2)
);

  const userIdFromMetadata = subscription?.metadata?.userId || null;
  const stripeCustomerId = subscription.customer || null;
  const stripeSubscriptionId = subscription.id || null;
  const status = subscription.status || "inactive";
  const priceId = subscription?.items?.data?.[0]?.price?.id || null;

  // Stripe pode trazer o fim do período no item da assinatura.
  const currentPeriodEndUnix =
    subscription?.current_period_end ||
    subscription?.items?.data?.[0]?.current_period_end ||
    subscription?.cancel_at ||
    null;

  const currentPeriodEnd = currentPeriodEndUnix
    ? new Date(currentPeriodEndUnix * 1000).toISOString()
    : null;

  const cancelAtPeriodEnd = Boolean(subscription?.cancel_at_period_end);

  let targetRow = null;
  let findError = null;

  if (userIdFromMetadata) {
    const result = await supabase
      .from("subscriptions")
      .select("id, user_id, stripe_customer_id, stripe_subscription_id")
      .eq("user_id", userIdFromMetadata)
      .maybeSingle();

    targetRow = result.data;
    findError = result.error;
  }

  if (!targetRow && stripeSubscriptionId) {
    const result = await supabase
      .from("subscriptions")
      .select("id, user_id, stripe_customer_id, stripe_subscription_id")
      .eq("stripe_subscription_id", stripeSubscriptionId)
      .maybeSingle();

    targetRow = result.data;
    findError = result.error;
  }

  if (!targetRow && stripeCustomerId) {
    const result = await supabase
      .from("subscriptions")
      .select("id, user_id, stripe_customer_id, stripe_subscription_id")
      .eq("stripe_customer_id", stripeCustomerId)
      .maybeSingle();

    targetRow = result.data;
    findError = result.error;
  }

  if (findError) {
    console.error(`Erro ao localizar assinatura para ${event.type}:`, findError);
    throw findError;
  }

  if (!targetRow?.id) {
    console.error(`Nenhuma assinatura encontrada para ${event.type}`, {
      userIdFromMetadata,
      stripeCustomerId,
      stripeSubscriptionId,
      status,
      cancelAtPeriodEnd,
      currentPeriodEnd,
      previousAttributes: event?.data?.previous_attributes || null,
    });
    break;
  }

  console.log("=== PAYLOAD QUE VAI PARA O SUPABASE ===", {
  stripe_customer_id: stripeCustomerId,
  stripe_subscription_id: stripeSubscriptionId,
  status,
  price_id: priceId,
  current_period_end: currentPeriodEnd,
  cancel_at_period_end: cancelAtPeriodEnd,
});

  const payloadToUpdate = {
    stripe_customer_id: stripeCustomerId,
    stripe_subscription_id: stripeSubscriptionId,
    status,
    price_id: priceId,
    current_period_end: currentPeriodEnd,
    cancel_at_period_end: cancelAtPeriodEnd,
    updated_at: new Date().toISOString(),
  };

  console.log(`[${event.type}] payload normalizado`, {
    rowId: targetRow.id,
    userId: targetRow.user_id,
    stripeCustomerId,
    stripeSubscriptionId,
    status,
    cancelAtPeriodEnd,
    currentPeriodEnd,
    previousAttributes: event?.data?.previous_attributes || null,
  });

  const { error } = await supabase
    .from("subscriptions")
    .update(payloadToUpdate)
    .eq("id", targetRow.id);

  if (error) {
    console.error(`Erro ao atualizar ${event.type}:`, error);
    throw error;
  }

  console.log(`Assinatura atualizada com sucesso para ${event.type}`, {
    rowId: targetRow.id,
    userId: targetRow.user_id,
    ...payloadToUpdate,
  });

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