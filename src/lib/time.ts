export const CAMPUS_TIMEZONE = "America/Denver";
export function localParts(timestamp: number, timeZone = CAMPUS_TIMEZONE) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
      weekday: "short",
    })
      .formatToParts(timestamp)
      .map((p) => [p.type, p.value]),
  );
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    minutes: Number(p.hour) * 60 + Number(p.minute),
    second: Number(p.second),
    weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
      p.weekday,
    ),
  };
}
// Enumerating UTC instants handles ambiguous/skipped DST times without guessing an offset.
export function localDaySlots(date: string, timeZone = CAMPUS_TIMEZONE) {
  const center = Date.parse(`${date}T12:00:00Z`);
  if (!Number.isFinite(center)) return [];
  const slots: number[] = [];
  for (
    let t = center - 18 * 3600000;
    t <= center + 24 * 3600000;
    t += 30 * 60000
  ) {
    if (localParts(t, timeZone).date === date) slots.push(t);
  }
  return slots;
}
export function timeLabel(t: number, timeZone = CAMPUS_TIMEZONE) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(t);
}
export function dateLabel(t: number, timeZone = CAMPUS_TIMEZONE) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(t);
}
export function relativeTime(t: number, now = Date.now()) {
  const minutes = Math.max(0, Math.floor((now - t) / 60000));
  return minutes < 1
    ? "just now"
    : minutes < 60
      ? `${minutes} min ago`
      : minutes < 1440
        ? `${Math.floor(minutes / 60)} hr ago`
        : `${Math.floor(minutes / 1440)} days ago`;
}
export function elapsed(
  session: {
    focus_seconds: number;
    segment_started_at: number | null;
    target_seconds: number;
    state: string;
  },
  now: number,
) {
  return Math.min(
    session.target_seconds,
    session.focus_seconds +
      (session.state === "running" && session.segment_started_at
        ? Math.max(0, Math.floor((now - session.segment_started_at) / 1000))
        : 0),
  );
}
