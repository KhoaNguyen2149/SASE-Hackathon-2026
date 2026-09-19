"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
} from "lucide-react";
import { post } from "@/lib/client";
import { useApp } from "./provider";
import { HeroArt } from "./hero-art";
type Mode =
  "login" | "register" | "forgot-password" | "reset-password" | "verify";
export function Auth({ mode }: { mode: Mode }) {
  const { refresh } = useApp();
  const router = useRouter(),
    params = useSearchParams();
  const [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [developmentLink, setDevelopmentLink] = useState(""),
    [showPassword, setShowPassword] = useState(false);
  const titles = {
    login: "Your little study world awaits.",
    register: "Make yourself at home.",
    "forgot-password": "Let’s get you back in.",
    "reset-password": "A fresh start for your password.",
    verify: "One little step. Then you’re in.",
  };
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const values = Object.fromEntries(form);
    try {
      if (mode === "verify") {
        await post("auth/verify", { token: params.get("token") });
        await refresh();
        setSuccess(
          "Your email is verified. You’re ready to reserve a room and join the community.",
        );
      } else if (mode === "reset-password") {
        await post("auth/reset", {
          token: params.get("token"),
          password: values.password,
        });
        setSuccess("Your password is updated. Sign in with your new password.");
      } else if (mode === "forgot-password") {
        const result = await post<{ developmentLink?: string }>("auth/forgot", {
          email: values.email,
        });
        setSuccess(
          "If that email belongs to an account, a reset link is on its way.",
        );
        setDevelopmentLink(result.developmentLink || "");
      } else {
        const result = await post<{
          developmentLink?: string;
          emailError?: string;
        }>(`auth/${mode}`, values);
        await refresh();
        if (mode === "register") {
          setSuccess(
            result.emailError ||
              "Your account is ready. Check your email to verify ownership before reserving or contributing.",
          );
          setDevelopmentLink(result.developmentLink || "");
        } else {
          const next = params.get("next");
          router.push(
            next?.startsWith("/") && !next.startsWith("//")
              ? next
              : "/discover",
          );
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="auth-layout">
      <div className="auth-story">
        <p className="eyebrow">A GOOD PLACE TO BEGIN</p>
        <h1>
          A place for focus.
          <br />A little room for you.
        </h1>
        <p>
          Find your people. Find your corner.
          <br />
          Make progress, one little session at a time.
        </p>
        <HeroArt />
        <p className="auth-quote">“A small start is still a start.”</p>
      </div>
      <section className="auth-card card">
        <img src="/brand/deskhop-mark.svg" width="48" height="48" alt="" />
        <h2>{titles[mode]}</h2>
        <p className="muted">
          {mode === "login"
            ? "Good to have you here. Sign in to pick up where you left off."
            : mode === "register"
              ? "Your next favorite spot is waiting."
              : mode === "verify"
                ? "Confirm your email to complete your account."
                : "We all need a little reset sometimes."}
        </p>
        {success ? (
          <div className="auth-success">
            <CheckCircle2 size={36} />
            <p>{success}</p>
            {developmentLink && (
              <div className="development-mail">
                <strong>Local development email</strong>
                <p>
                  Email delivery isn’t connected in this local build. This link
                  is only shown in development.
                </p>
                <Link className="button secondary full" href={developmentLink}>
                  {mode === "forgot-password"
                    ? "Open password reset"
                    : "Verify my email"}
                </Link>
              </div>
            )}
            <Link
              className="button full"
              href={mode === "reset-password" ? "/login" : "/discover"}
            >
              {mode === "reset-password" ? "Sign in" : "Explore DeskHop"}
              <ArrowRight size={16} />
            </Link>
          </div>
        ) : (
          <form onSubmit={submit}>
            {mode === "register" && (
              <>
                <label className="field">
                  Your name
                  <input
                    name="name"
                    autoComplete="name"
                    placeholder="Alex Chen"
                    required
                    minLength={2}
                    maxLength={60}
                  />
                </label>
                <label className="field">
                  Your handle
                  <input
                    aria-label="Your handle"
                    name="handle"
                    autoComplete="username"
                    placeholder="alex_studies"
                    required
                    pattern="[a-zA-Z0-9_]{3,24}"
                    minLength={3}
                    maxLength={24}
                  />
                  <small>
                    3–24 letters, numbers, or underscores. Friends use this to
                    find you.
                  </small>
                </label>
              </>
            )}
            {["login", "register", "forgot-password"].includes(mode) && (
              <label className="field">
                Email address
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  required
                  maxLength={254}
                />
              </label>
            )}
            {["login", "register", "reset-password"].includes(mode) && (
              <label className="field">
                Password
                <div className="password-field">
                  <input
                    aria-label="Password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                    minLength={mode === "login" ? 1 : 10}
                    maxLength={128}
                    required
                    placeholder={
                      mode === "login"
                        ? "Your password"
                        : "At least 10 characters"
                    }
                  />
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>
            )}
            {mode === "login" && (
              <Link className="forgot-link" href="/forgot-password">
                Forgot your password?
              </Link>
            )}
            {mode === "register" && (
              <p className="fine-print">
                By creating an account, you agree to our{" "}
                <Link href="/terms">Terms</Link> and acknowledge our{" "}
                <Link href="/privacy">Privacy notice</Link>.
              </p>
            )}
            {error && (
              <div className="error-box" role="alert">
                {error}
              </div>
            )}
            <button className="button full" disabled={pending}>
              {pending
                ? "Just a moment…"
                : mode === "login"
                  ? "Welcome back"
                  : mode === "register"
                    ? "Create my account"
                    : mode === "verify"
                      ? "Verify my email"
                      : mode === "forgot-password"
                        ? "Send reset link"
                        : "Update password"}
              <ArrowRight size={17} />
            </button>
          </form>
        )}
        {mode === "login" ? (
          <p className="auth-switch">
            New around here?{" "}
            <Link
              href={
                "/register" +
                (params.get("next")
                  ? "?next=" + encodeURIComponent(params.get("next")!)
                  : "")
              }
            >
              Make yourself at home
            </Link>
          </p>
        ) : mode === "register" ? (
          <p className="auth-switch">
            Already have a little corner here?{" "}
            <Link href="/login">Sign in</Link>
          </p>
        ) : (
          <p className="auth-switch">
            <Link href="/login">Back to sign in</Link>
          </p>
        )}
        <div className="auth-security">
          <LockKeyhole size={13} />
          <span>Your study sessions are private by default.</span>
        </div>
      </section>
    </div>
  );
}
