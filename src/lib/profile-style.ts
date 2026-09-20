export const themes = [
  "forest",
  "sunset",
  "lavender",
  "ocean",
  "midnight",
] as const;
export const banners = [
  "mountains",
  "checkerboard",
  "notebook",
  "stars",
  "botanical",
] as const;
export const avatars = [
  "seedling",
  "coffee",
  "book",
  "fox",
  "cat",
  "moon",
  "sun",
  "mountain",
] as const;
export const stickerOptions = [
  "coffee",
  "book",
  "sparkle",
  "leaf",
  "headphones",
  "heart",
  "mountain",
  "sun",
] as const;
export const interestOptions = [
  "Reading",
  "Coding",
  "Writing",
  "Design",
  "Science",
  "Languages",
  "Art",
  "Research",
  "Group study",
  "Quiet focus",
] as const;
export const glyphs: Record<string, string> = {
  seedling: "🌱",
  coffee: "☕",
  book: "📖",
  fox: "🦊",
  cat: "🐈",
  moon: "🌙",
  sun: "☀️",
  mountain: "🏔️",
  sparkle: "✨",
  leaf: "🌿",
  headphones: "🎧",
  heart: "💚",
};
export interface ProfileDecoration {
  border: string;
  bio: string;
  theme: string;
  banner: string;
  avatar: string;
  stickers: string[];
  pinned_spots: string[];
  interests: string[];
  leaderboard: boolean;
}
export const defaultDecoration: ProfileDecoration = {
  border: "plain",
  bio: "",
  theme: "forest",
  banner: "mountains",
  avatar: "seedling",
  stickers: [],
  pinned_spots: [],
  interests: [],
  leaderboard: true,
};
