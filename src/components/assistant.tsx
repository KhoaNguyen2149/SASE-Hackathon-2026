"use client";
import { useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { useApp } from "./provider";
import { AuthGate, PageTitle } from "./ui";
export function Assistant() {
  const { data, mutate, busy } = useApp();
  const [prompt, setPrompt] = useState(""),
    [answer, setAnswer] = useState<{
      message: string;
      plan: {
        city: string;
        query: string;
        category: string;
        needs_room: boolean;
        needs_power: boolean;
        quiet: boolean;
        nearby: boolean;
      };
      spots: {
        id: string;
        name: string;
        address: string;
        booking_url: string;
      }[];
    } | null>(null);
  return (
    <>
      <PageTitle
        eyebrow="DESKHOP PREMIUM"
        title="A little help finding your place."
        description="Describe your plans. Review the suggested places and make the final choice."
      />
      <AuthGate>
        {!data?.premium ? (
          <div className="card padded">
            <Sparkles size={32} />
            <h2>Your study concierge</h2>
            <p>
              The AI assistant is available to Premium members when connected.
              Search, maps, and nearby discovery stay free.
            </p>
            <Link className="button" href="/premium">
              Explore Premium · $7.99/month
            </Link>
          </div>
        ) : (
          <section className="card padded">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const result = await mutate<typeof answer>("assistant", {
                  prompt,
                });
                if (result) setAnswer(result);
              }}
            >
              <label className="field">
                What are you planning?
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  maxLength={1000}
                  rows={4}
                  placeholder="Find a library in Denver where I can reserve a room…"
                />
              </label>
              <p className="fine-print">
                Your prompt is sent to Google’s Gemini service. Don’t include
                private information. Ten requests per member per day, subject to
                the site’s total daily allowance. This assistant suggests
                options; it cannot place a reservation or guarantee a seat.
              </p>
              <button
                className="button"
                disabled={busy || !data.aiEnabled || !prompt.trim()}
              >
                {busy
                  ? "Thinking…"
                  : data.aiEnabled
                    ? "Find my options"
                    : "AI connection pending"}
              </button>
            </form>
            {answer && (
              <div className="assistant-answer">
                <p>{answer.message}</p>
                <p className="fine-print">
                  Interpreted:{" "}
                  {[
                    answer.plan.city,
                    answer.plan.query,
                    answer.plan.category !== "all" ? answer.plan.category : "",
                    answer.plan.needs_room ? "room options" : "",
                    answer.plan.needs_power ? "known outlets" : "",
                    answer.plan.quiet ? "quiet setting" : "",
                  ]
                    .filter(Boolean)
                    .join(" ? ") || "All available places"}
                </p>
                {answer.spots.length ? (
                  answer.spots.map((s) => (
                    <Link
                      className="leaderboard-row card"
                      key={s.id}
                      href={
                        "/spots/" +
                        s.id +
                        (answer.plan.needs_room ? "/rooms" : "")
                      }
                    >
                      <span>
                        <strong>{s.name}</strong>
                        <small>{s.address}</small>
                      </span>
                      <span>Review options →</span>
                    </Link>
                  ))
                ) : (
                  <p>
                    No verified matches for all those preferences. Try fewer
                    requirements or use the free filters.
                  </p>
                )}
                <Link className="button secondary" href="/discover">
                  Open free discovery and nearby search
                </Link>
              </div>
            )}
          </section>
        )}
      </AuthGate>
    </>
  );
}
