import { NextRequest, NextResponse } from "next/server";
import { billingEnabled, stripe, handleBillingEvent } from "@/server/billing";
export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  if (!billingEnabled())
    return NextResponse.json({ error: "Billing unavailable" }, { status: 503 });
  const signature = req.headers.get("stripe-signature");
  if (!signature)
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  const raw = await req.text();
  if (raw.length > 1000000) return new NextResponse(null, { status: 413 });
  let event;
  try {
    event = stripe().webhooks.constructEvent(
      raw,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
  try {
    await handleBillingEvent(event);
    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json(
      { error: "Could not process event" },
      { status: 500 },
    );
  }
}
