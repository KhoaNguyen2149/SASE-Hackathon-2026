export const cosmetics = [
  {
    id: "theme:forest",
    name: "Forest",
    type: "theme",
    value: "forest",
    cost: 0,
    level: 1,
  },
  {
    id: "theme:ocean",
    name: "Ocean",
    type: "theme",
    value: "ocean",
    cost: 40,
    level: 2,
  },
  {
    id: "theme:sunset",
    name: "Sunset",
    type: "theme",
    value: "sunset",
    cost: 60,
    level: 3,
  },
  {
    id: "theme:lavender",
    name: "Lavender",
    type: "theme",
    value: "lavender",
    cost: 80,
    level: 4,
  },
  {
    id: "theme:midnight",
    name: "Midnight",
    type: "theme",
    value: "midnight",
    cost: 120,
    level: 5,
  },
  {
    id: "banner:mountains",
    name: "Mountain morning",
    type: "banner",
    value: "mountains",
    cost: 0,
    level: 1,
  },
  {
    id: "banner:notebook",
    name: "Notebook",
    type: "banner",
    value: "notebook",
    cost: 30,
    level: 2,
  },
  {
    id: "banner:botanical",
    name: "Botanical",
    type: "banner",
    value: "botanical",
    cost: 60,
    level: 3,
  },
  {
    id: "banner:checkerboard",
    name: "Checkerboard",
    type: "banner",
    value: "checkerboard",
    cost: 80,
    level: 4,
  },
  {
    id: "banner:stars",
    name: "Starry night",
    type: "banner",
    value: "stars",
    cost: 150,
    level: 6,
  },
  {
    id: "border:plain",
    name: "Simple circle",
    type: "border",
    value: "plain",
    cost: 0,
    level: 1,
  },
  {
    id: "border:leaf",
    name: "Leaf ring",
    type: "border",
    value: "leaf",
    cost: 40,
    level: 2,
  },
  {
    id: "border:orbit",
    name: "Orbit",
    type: "border",
    value: "orbit",
    cost: 80,
    level: 4,
  },
  {
    id: "border:laurel",
    name: "Laurel",
    type: "border",
    value: "laurel",
    cost: 160,
    level: 6,
  },
] as const;
export interface Progress {
  xp: number;
  coins: number;
  level: number;
  nextLevelXp: number;
  owned: string[];
  achievements: {
    id: string;
    name: string;
    description: string;
    earned: boolean;
  }[];
}
export const levelFor = (xp: number) =>
  Math.floor(Math.sqrt(Math.max(0, xp) / 100)) + 1;
