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

function toIsoFromUnix(unixValue) {
  if (!unixValue) return null;
  return new Date(unixValue * 1000).toISOString();
}

async function findSubscriptionRow({
  userId,
  stripeCustomerId,
  stripeSubscriptionId,
}) {
  let result = null;

  if (userId) {
    result = await supabase
      .from("subscriptions")
      .select("id, user_id, stripe_customer_id, stripe_subscription_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (result.error) throw result.error;
    if (result.data) return result.data;
  }

  if (stripeSubscriptionId) {
    result = await supabase
      .from("subscriptions")
      .select("id, user_id, stripe_customer_id, stripe_subscription_id")
      .eq("stripe_subscription_id", stripeSubscriptionId)
      .maybeSingle();

    if (result.error) throw result.error;
    if (result.data) return result.data;
  }

  if (stripeCustomerId) {
    result = await supabase
      .from("subscriptions")
      .select("id, user_id, stripe_customer_id, stripe_subscription_id")
      .eq("stripe_customer_id", stripeCustomerId)
      .maybeSingle();

    if (result.error) throw result.error;
    if (result.data) return result.data;
  }

  return null;
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
        const stripeCustomerId = session?.customer || null;
        const stripeSubscriptionId = session?.subscription || null;

        if (!userId) {
          console.warn("checkout.session.completed sem userId no metadata", {
            sessionId: session?.id,
            stripeCustomerId,
            stripeSubscriptionId,
          });
          break;
        }

        let subscriptionDetails = null;

        if (stripeSubscriptionId) {
          subscriptionDetails = await stripe.subscriptions.retrieve(
            stripeSubscriptionId
          );
        }

        const priceId =
          subscriptionDetails?.items?.data?.[0]?.price?.id || null;

        const currentPeriodEndUnix =
          subscriptionDetails?.current_period_end ||
          subscriptionDetails?.items?.data?.[0]?.current_period_end ||
          subscriptionDetails?.cancel_at ||
          null;

        const currentPeriodEnd = toIsoFromUnix(currentPeriodEndUnix);
        const cancelAtPeriodEnd = Boolean(
          subscriptionDetails?.cancel_at_period_end
        );

        const targetRow = await findSubscriptionRow({
          userId,
          stripeCustomerId,
          stripeSubscriptionId,
        });

        if (!targetRow?.id) {
  throw new Error(
    "checkout.session.completed recebido, mas nenhuma subscription foi encontrada no Supabase"
  );
}

if (String(targetRow.user_id) !== String(userId)) {
  console.error("DIVERGÊNCIA DE USUÁRIO NO checkout.session.completed", {
    metadataUserId: userId,
    targetRowUserId: targetRow.user_id,
    stripeCustomerId,
    stripeSubscriptionId,
  });

  throw new Error(
    "Webhook bloqueado: a assinatura encontrada não pertence ao userId do metadata"
  );
}

        const payloadToUpdate = {
          stripe_customer_id: stripeCustomerId,
          stripe_subscription_id: stripeSubscriptionId,
          status: subscriptionDetails?.status || "active",
          price_id: priceId,
          current_period_end: currentPeriodEnd,
          cancel_at_period_end: cancelAtPeriodEnd,
          updated_at: new Date().toISOString(),
        };

        console.log("[checkout.session.completed] atualizando assinatura", {
          rowId: targetRow.id,
          userId: targetRow.user_id,
          ...payloadToUpdate,
        });

        const { error } = await supabase
          .from("subscriptions")
          .update(payloadToUpdate)
          .eq("id", targetRow.id);

        if (error) {
          console.error("Erro ao atualizar checkout.session.completed:", error);
          throw error;
        }

        break;
      }

case "customer.subscription.created":
case "customer.subscription.updated":
case "customer.subscription.deleted": {
  const subscriptionFromEvent = event.data.object;
  const subscriptionIdFromEvent = subscriptionFromEvent?.id || null;

  if (!subscriptionIdFromEvent) {
    throw new Error(`Evento ${event.type} chegou sem subscription id`);
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionIdFromEvent);

  const userIdFromMetadata = subscription?.metadata?.userId || null;
  const stripeCustomerId = subscription?.customer || null;
  const stripeSubscriptionId = subscription?.id || null;
  const status = subscription?.status || "inactive";
  const priceId = subscription?.items?.data?.[0]?.price?.id || null;

const cancelAtUnix = subscription?.cancel_at || null;

const currentPeriodEndUnix =
  subscription?.current_period_end ||
  subscription?.items?.data?.[0]?.current_period_end ||
  cancelAtUnix ||
  null;

const currentPeriodEnd = toIsoFromUnix(currentPeriodEndUnix);

const cancelAtPeriodEnd = Boolean(
  subscription?.cancel_at_period_end || cancelAtUnix
);

console.log("[subscription webhook] evento recebido + estado atual da Stripe", {
  eventType: event.type,
  subscriptionId: stripeSubscriptionId,
  customerId: stripeCustomerId,
  userIdFromMetadata,
  status,
  cancel_at_period_end_raw: subscription?.cancel_at_period_end ?? null,
  cancel_at_raw: subscription?.cancel_at || null,
  cancelAtPeriodEnd,
  currentPeriodEnd,
  previousAttributes: event?.data?.previous_attributes || null,
});

  const targetRow = await findSubscriptionRow({
    userId: userIdFromMetadata,
    stripeCustomerId,
    stripeSubscriptionId,
  });

  if (!targetRow?.id) {
  console.error("Nenhuma assinatura encontrada para atualizar", {
    eventType: event.type,
    userIdFromMetadata,
    stripeCustomerId,
    stripeSubscriptionId,
    status,
    cancelAtPeriodEnd,
    currentPeriodEnd,
  });

  throw new Error(
    `Webhook recebeu ${event.type}, mas não encontrou subscription no Supabase`
  );
}

if (
  userIdFromMetadata &&
  String(targetRow.user_id) !== String(userIdFromMetadata)
) {
  console.error("DIVERGÊNCIA DE USUÁRIO NO customer.subscription.*", {
    eventType: event.type,
    metadataUserId: userIdFromMetadata,
    targetRowUserId: targetRow.user_id,
    stripeCustomerId,
    stripeSubscriptionId,
  });

  throw new Error(
    "Webhook bloqueado: a assinatura encontrada não pertence ao userId do metadata"
  );
}

  console.log("[subscription webhook] linha encontrada", {
    id: targetRow.id,
    user_id: targetRow.user_id,
    stripe_customer_id: targetRow.stripe_customer_id,
    stripe_subscription_id: targetRow.stripe_subscription_id,
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

  console.log("[subscription webhook] payload para Supabase", {
    rowId: targetRow.id,
    userId: targetRow.user_id,
    ...payloadToUpdate,
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