import Stripe from "stripe";
import { one, run, transaction } from "./db";
import { assert } from "./errors";
import { requireVerified, rateLimit } from "./shared";
import type { User } from "@/lib/types";
export const billingEnabled = () =>
  !!process.env.STRIPE_SECRET_KEY &&
  !!process.env.STRIPE_PRICE_ID &&
  !!process.env.STRIPE_WEBHOOK_SECRET;
export const stripe = () => new Stripe(process.env.STRIPE_SECRET_KEY!);
const origin = () =>
  new URL(
    process.env.APP_URL ||
      process.env.RENDER_EXTERNAL_URL ||
      "http://127.0.0.1:3000",
  ).origin;
export function premiumFor(userId: string) {
  return !!one(
    "SELECT 1 FROM subscriptions WHERE user_id=? AND status='active' AND period_end>?",
    userId,
    Date.now(),
  );
}
export async function checkout(user: User) {
  requireVerified(user);
  assert(
    billingEnabled(),
    "BILLING_UNAVAILABLE",
    "Premium checkout is not open yet.",
    503,
  );
  assert(
    !premiumFor(user.id),
    "ALREADY_PREMIUM",
    "You already have Premium. Manage it from your membership page.",
    409,
  );
  rateLimit("checkout:" + user.id, 8, 3600000);
  const api = stripe(),
    price = await api.prices.retrieve(process.env.STRIPE_PRICE_ID!);
  assert(
    price.active &&
      price.unit_amount === 799 &&
      price.currency === "usd" &&
      price.recurring?.interval === "month" &&
      price.recurring.interval_count === 1,
    "PRICE_CONFIGURATION",
    "Premium billing configuration needs attention.",
    503,
  );
  let customer = one<{ customer_id: string }>(
    "SELECT customer_id FROM subscriptions WHERE user_id=?",
    user.id,
  )?.customer_id;
  if (!customer) {
    const created = await api.customers.create(
      { email: user.email, metadata: { deskhop_user_id: user.id } },
      { idempotencyKey: "deskhop-customer-" + user.id },
    );
    customer = created.id;
    run(
      "INSERT INTO subscriptions(user_id,customer_id,status,updated_at) VALUES(?,?,'inactive',?) ON CONFLICT(user_id) DO UPDATE SET customer_id=excluded.customer_id",
      user.id,
      customer,
      Date.now(),
    );
  }
  const session = await api.checkout.sessions.create(
    {
      customer,
      mode: "subscription",
      line_items: [{ price: price.id, quantity: 1 }],
      subscription_data: { metadata: { deskhop_user_id: user.id } },
      client_reference_id: user.id,
      success_url: origin() + "/premium?checkout=success",
      cancel_url: origin() + "/premium?checkout=cancelled",
      allow_promotion_codes: false,
    },
    {
      idempotencyKey: `deskhop-checkout-${user.id}-${Math.floor(Date.now() / 300000)}`,
    },
  );
  return { url: session.url };
}
export async function billingPortal(user: User) {
  assert(
    billingEnabled(),
    "BILLING_UNAVAILABLE",
    "Billing is not connected yet.",
    503,
  );
  const row = one<{ customer_id: string }>(
    "SELECT customer_id FROM subscriptions WHERE user_id=?",
    user.id,
  );
  assert(
    row?.customer_id,
    "NO_SUBSCRIPTION",
    "No billing account is associated with this profile.",
    404,
  );
  return {
    url: (
      await stripe().billingPortal.sessions.create({
        customer: row.customer_id,
        return_url: origin() + "/premium",
      })
    ).url,
  };
}
export function applySubscription(input: {
  eventId: string;
  userId: string;
  customerId: string;
  subscriptionId: string;
  status: string;
  periodEnd: number;
  priceId: string;
}) {
  return transaction(() => {
    if (one("SELECT 1 FROM billing_events WHERE id=?", input.eventId)) return;
    const owner = one<{
      customer_id: string;
      subscription_id: string | null;
      status: string;
    }>(
      "SELECT customer_id,subscription_id,status FROM subscriptions WHERE user_id=?",
      input.userId,
    );
    assert(
      owner?.customer_id === input.customerId,
      "BILLING_OWNER",
      "Subscription owner mismatch.",
      400,
    );
    if (
      owner.subscription_id &&
      owner.subscription_id !== input.subscriptionId &&
      owner.status === "active" &&
      input.status !== "active"
    ) {
      run("INSERT INTO billing_events VALUES(?,?)", input.eventId, Date.now());
      return;
    }
    const validPrice = input.priceId === process.env.STRIPE_PRICE_ID;
    run(
      "UPDATE subscriptions SET subscription_id=?,status=?,period_end=?,updated_at=? WHERE user_id=?",
      input.subscriptionId,
      validPrice ? input.status : "invalid_price",
      validPrice ? input.periodEnd : 0,
      Date.now(),
      input.userId,
    );
    run("INSERT INTO billing_events VALUES(?,?)", input.eventId, Date.now());
  });
}
export async function handleBillingEvent(event: Stripe.Event) {
  if (one("SELECT 1 FROM billing_events WHERE id=?", event.id)) return;
  if (
    ![
      "customer.subscription.created",
      "customer.subscription.updated",
      "customer.subscription.deleted",
    ].includes(event.type)
  )
    return;
  const incoming = event.data.object as Stripe.Subscription;
  // Retrieve current state to prevent an older webhook from restoring expired access.
  const current =
    event.type === "customer.subscription.deleted"
      ? incoming
      : await stripe().subscriptions.retrieve(incoming.id);
  const customerId =
    typeof current.customer === "string"
      ? current.customer
      : current.customer.id;
  const userId = current.metadata.deskhop_user_id;
  if (!userId) return;
  const item = current.items.data.find(
    (i) => i.price.id === process.env.STRIPE_PRICE_ID,
  );
  applySubscription({
    eventId: event.id,
    userId,
    customerId,
    subscriptionId: current.id,
    status: current.status,
    periodEnd: (item?.current_period_end || 0) * 1000,
    priceId: item?.price.id || "",
  });
}
