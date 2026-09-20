/** A handle is the address of a public profile, so it stays URL-safe. */
export const handlePattern = /^[a-z0-9_]{3,24}$/;
export const handleHint = "Use 3–24 letters, numbers, or underscores.";
export const normalizeHandle = (value: string) =>
  value.trim().toLowerCase().slice(0, 24);
