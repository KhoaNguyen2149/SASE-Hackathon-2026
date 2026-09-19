"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { ArrowRight, LoaderCircle, MapPin, X } from "lucide-react";
import { useApp } from "./provider";
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-top">
        <h2>{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Empty({
  icon,
  title,
  children,
  action,
}: {
  icon?: ReactNode;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon || <MapPin size={28} />}</div>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={22} /> Finding your place…
    </div>
  );
}
export function ErrorState({ message }: { message: string }) {
  return (
    <div className="error-box" role="alert">
      <strong>We couldn’t load this.</strong>
      <p>{message}</p>
      <button
        className="button secondary"
        onClick={() => window.location.reload()}
      >
        Try again
      </button>
    </div>
  );
}
export function AuthGate({ children }: { children: ReactNode }) {
  const { data, requireAuth } = useApp();
  return !data ? (
    <Loading />
  ) : data.user ? (
    <>{children}</>
  ) : (
    <Empty
      title="A little more personal"
      action={
        <button className="button" onClick={requireAuth}>
          Sign in to DeskHop <ArrowRight size={17} />
        </button>
      }
    >
      Sign in to keep your study sessions, bookings, and friends in one place.
    </Empty>
  );
}
export function PageTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function Badge({
  children,
  tone = "sage",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function Avatar({ name, size = "" }: { name: string; size?: string }) {
  return (
    <span className={`avatar ${size}`} aria-hidden="true">
      {name
        .split(" ")
        .map((x) => x[0])
        .slice(0, 2)
        .join("")}
    </span>
  );
}
export const noiseLabels = [
  "Silent",
  "Quiet",
  "Conversational",
  "Lively",
  "Loud",
];
export const crowdLabels = [
  "Mostly empty",
  "Plenty of seats",
  "About half occupied",
  "A few seats left",
  "Effectively full",
];
export function ScoreSelect({
  label,
  value,
  onChange,
  kind = "noise",
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  kind?: "noise" | "crowd" | "rating";
}) {
  const labels =
    kind === "noise"
      ? noiseLabels
      : kind === "crowd"
        ? crowdLabels
        : ["Not a good fit", "Could be better", "Good", "Great", "Just right"];
  return (
    <label className="field">
      {label}
      <select value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {labels.map((text, i) => (
          <option key={text} value={i + 1}>
            {i + 1} · {text}
          </option>
        ))}
      </select>
    </label>
  );
}
