"use client";
import Link from "next/link";
import { Crown, Check, ShieldCheck, Sparkles } from "lucide-react";
import { useApp } from "./provider";
export function Premium() {
  const { data, mutate, requireAuth, busy } = useApp();
  const premium = !!data?.premium;
  async function open(path: string) {
    if (!requireAuth()) return;
    const result = await mutate<{ url: string }>(path);
    if (result?.url) window.location.assign(result.url);
  }
  return (
    <div className="premium-page">
      <p className="eyebrow">DESKHOP PREMIUM</p>
      <h1>
        Everything you use now,
        <br />
        plus a few extras.
      </h1>
      <p className="muted">
        Discovery, maps, reviews, study sessions, friends, and earned
        decorations stay free.
      </p>
      <div className="premium-plan card">
        <span className="premium-badge">
          <Crown size={16} />
          DeskHop Premium
        </span>
        <div className="premium-price">
          $7.99<span>USD / month</span>
        </div>
        <p>
          Monthly subscription. Renews until cancelled. Any applicable tax is
          shown at checkout.
        </p>
        <ul className="premium-features">
          <li>
            <Check />
            Premium badge on your public profile and rankings
          </li>
          <li>
            <Check />
            Premium member styling
          </li>
          <li>
            <Sparkles />
            AI study concierge, once connected, with daily usage limits
          </li>
          <li>
            <ShieldCheck />
            Booking suggestions require your confirmation
          </li>
        </ul>
        {premium ? (
          <>
            <div className="notice-banner">
              Your Premium membership is active.
            </div>
            <button
              className="button full"
              disabled={busy}
              onClick={() => void open("billing/portal")}
            >
              Manage or cancel subscription
            </button>
            <Link className="button secondary full" href="/assistant">
              Open study concierge
            </Link>
          </>
        ) : (
          <>
            <button
              className="button full"
              disabled={busy || !data?.billingEnabled}
              onClick={() => void open("billing/checkout")}
            >
              {data?.billingEnabled
                ? "Get Premium · $7.99/month"
                : "Premium checkout is not open yet"}
            </button>
            {!data?.billingEnabled && (
              <p className="fine-print">
                Payments are awaiting the operator’s verified billing account.
                No purchase or Premium access is simulated.
              </p>
            )}
          </>
        )}
        <p className="fine-print">
          The AI concierge is{" "}
          {data?.aiEnabled ? "connected" : "not connected yet"}. Premium does
          not improve rankings or buy study rewards. Leaves have no monetary
          value.
        </p>
      </div>
      <Link className="text-link" href="/discover">
        Keep exploring for free →
      </Link>
    </div>
  );
}
