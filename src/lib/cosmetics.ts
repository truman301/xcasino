// ---------------------------------------------------------------------------
// Casino X — Cosmetics Catalog
// All cosmetic items defined statically. No database table needed.
// ---------------------------------------------------------------------------

export type CosmeticCategory =
  | "name_color"
  | "badge"
  | "avatar_frame"
  | "chat_flair"
  | "table_effect"
  | "title";

export type CosmeticRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export interface CosmeticItem {
  id: string;
  category: CosmeticCategory;
  name: string;
  description: string;
  price: number;
  rarity: CosmeticRarity;
  /** CSS value — color, gradient, class, or emoji depending on category */
  cssValue: string;
  /** Preview emoji/icon for the store card */
  preview: string;
}

// ---------------------------------------------------------------------------
// Full catalog
// ---------------------------------------------------------------------------

export const COSMETICS: CosmeticItem[] = [
  // ── Name Colors ──────────────────────────────────────────────────────
  { id: "nc_crimson", category: "name_color", name: "Crimson", description: "A classic red name", price: 1000, rarity: "common", cssValue: "#ef4444", preview: "🔴" },
  { id: "nc_emerald", category: "name_color", name: "Emerald", description: "Cool green glow", price: 1500, rarity: "common", cssValue: "#10b981", preview: "🟢" },
  { id: "nc_ocean", category: "name_color", name: "Ocean Blue", description: "Deep sea vibes", price: 2000, rarity: "common", cssValue: "#3b82f6", preview: "🔵" },
  { id: "nc_violet", category: "name_color", name: "Violet", description: "Royal purple tone", price: 3000, rarity: "uncommon", cssValue: "#8b5cf6", preview: "🟣" },
  { id: "nc_sunset", category: "name_color", name: "Sunset", description: "Orange-to-pink gradient text", price: 10000, rarity: "rare", cssValue: "linear-gradient(90deg, #f97316, #ec4899)", preview: "🌅" },
  { id: "nc_golden", category: "name_color", name: "24 Karat", description: "Shimmering gold name", price: 25000, rarity: "rare", cssValue: "linear-gradient(90deg, #d4af37, #f0d060, #d4af37)", preview: "✨" },
  { id: "nc_diamond", category: "name_color", name: "Diamond Frost", description: "Icy diamond sparkle", price: 50000, rarity: "epic", cssValue: "linear-gradient(90deg, #67e8f9, #a5f3fc, #67e8f9)", preview: "💠" },
  { id: "nc_inferno", category: "name_color", name: "Inferno", description: "Flames across your name", price: 100000, rarity: "epic", cssValue: "linear-gradient(90deg, #dc2626, #f97316, #eab308)", preview: "🔥" },
  { id: "nc_void", category: "name_color", name: "The Void", description: "Dark energy aura", price: 250000, rarity: "legendary", cssValue: "linear-gradient(90deg, #6d28d9, #000, #6d28d9)", preview: "🕳️" },
  { id: "nc_prismatic", category: "name_color", name: "Prismatic", description: "Animated rainbow shift", price: 500000, rarity: "legendary", cssValue: "prismatic", preview: "🌈" },

  // ── Badges ───────────────────────────────────────────────────────────
  { id: "b_cherry", category: "badge", name: "Cherry", description: "Sweet and simple", price: 1000, rarity: "common", cssValue: "🍒", preview: "🍒" },
  { id: "b_clover", category: "badge", name: "Lucky Clover", description: "Feeling lucky", price: 2000, rarity: "common", cssValue: "🍀", preview: "🍀" },
  { id: "b_flame", category: "badge", name: "On Fire", description: "Hot streak", price: 5000, rarity: "uncommon", cssValue: "🔥", preview: "🔥" },
  { id: "b_star", category: "badge", name: "Star Player", description: "You shine bright", price: 10000, rarity: "uncommon", cssValue: "⭐", preview: "⭐" },
  { id: "b_crown", category: "badge", name: "Royal Crown", description: "Bow to royalty", price: 25000, rarity: "rare", cssValue: "👑", preview: "👑" },
  { id: "b_gem", category: "badge", name: "Gem Collector", description: "Precious collector", price: 50000, rarity: "epic", cssValue: "💎", preview: "💎" },
  { id: "b_trident", category: "badge", name: "Poseidon", description: "Rule the seas", price: 100000, rarity: "epic", cssValue: "🔱", preview: "🔱" },
  { id: "b_dragon", category: "badge", name: "Dragon", description: "Feared at every table", price: 250000, rarity: "legendary", cssValue: "🐉", preview: "🐉" },
  { id: "b_skull", category: "badge", name: "Death Dealer", description: "The final hand", price: 500000, rarity: "legendary", cssValue: "💀", preview: "💀" },

  // ── Avatar Frames ────────────────────────────────────────────────────
  { id: "af_silver", category: "avatar_frame", name: "Silver Ring", description: "Simple silver border", price: 2000, rarity: "common", cssValue: "ring-2 ring-gray-400", preview: "⚪" },
  { id: "af_gold", category: "avatar_frame", name: "Gold Ring", description: "Golden border", price: 5000, rarity: "uncommon", cssValue: "ring-2 ring-yellow-500", preview: "🟡" },
  { id: "af_ruby", category: "avatar_frame", name: "Ruby Glow", description: "Glowing red ring", price: 15000, rarity: "rare", cssValue: "ring-2 ring-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]", preview: "❤️" },
  { id: "af_sapphire", category: "avatar_frame", name: "Sapphire Glow", description: "Glowing blue ring", price: 15000, rarity: "rare", cssValue: "ring-2 ring-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]", preview: "💙" },
  { id: "af_emerald_pulse", category: "avatar_frame", name: "Emerald Pulse", description: "Pulsing emerald glow", price: 50000, rarity: "epic", cssValue: "ring-2 ring-emerald-400 animate-emerald-pulse", preview: "💚" },
  { id: "af_inferno", category: "avatar_frame", name: "Inferno Frame", description: "Flickering fire border", price: 100000, rarity: "epic", cssValue: "ring-2 ring-orange-500 animate-inferno-ring", preview: "🧡" },
  { id: "af_legendary", category: "avatar_frame", name: "Legendary Aura", description: "Radiating golden aura", price: 250000, rarity: "legendary", cssValue: "ring-2 ring-yellow-400 animate-legendary-glow", preview: "💛" },

  // ── Chat Flair ───────────────────────────────────────────────────────
  { id: "cf_basic_gold", category: "chat_flair", name: "Gold Toast", description: "Gold-colored win text", price: 1500, rarity: "common", cssValue: "text-[var(--gold)]", preview: "🥇" },
  { id: "cf_neon_green", category: "chat_flair", name: "Neon Win", description: "Neon green glow text", price: 3000, rarity: "common", cssValue: "text-green-400 drop-shadow-[0_0_6px_rgba(74,222,128,0.6)]", preview: "💚" },
  { id: "cf_electric", category: "chat_flair", name: "Electric", description: "Crackling electric text", price: 10000, rarity: "uncommon", cssValue: "text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.7)]", preview: "⚡" },
  { id: "cf_confetti", category: "chat_flair", name: "Confetti Burst", description: "Party time on every win", price: 25000, rarity: "rare", cssValue: "animate-confetti-text", preview: "🎉" },
  { id: "cf_explosion", category: "chat_flair", name: "Supernova", description: "Explosive win celebration", price: 75000, rarity: "epic", cssValue: "animate-supernova-text", preview: "💥" },
  { id: "cf_legendary_rain", category: "chat_flair", name: "Chip Rain", description: "Chips rain from the sky", price: 250000, rarity: "legendary", cssValue: "animate-chip-rain", preview: "🪙" },

  // ── Table Effects ────────────────────────────────────────────────────
  { id: "te_red_felt", category: "table_effect", name: "Classic Red", description: "Subtle red felt tint", price: 2500, rarity: "common", cssValue: "bg-red-900/10", preview: "🟥" },
  { id: "te_blue_felt", category: "table_effect", name: "Midnight Blue", description: "Cool blue ambiance", price: 2500, rarity: "common", cssValue: "bg-blue-900/10", preview: "🟦" },
  { id: "te_green_classic", category: "table_effect", name: "Casino Green", description: "Traditional casino green", price: 5000, rarity: "uncommon", cssValue: "bg-emerald-900/15", preview: "🟩" },
  { id: "te_purple_haze", category: "table_effect", name: "Purple Haze", description: "Mysterious purple atmosphere", price: 15000, rarity: "rare", cssValue: "bg-purple-900/10", preview: "🟪" },
  { id: "te_golden_glow", category: "table_effect", name: "Midas Touch", description: "Everything turns gold", price: 50000, rarity: "epic", cssValue: "bg-yellow-900/10", preview: "🌟" },
  { id: "te_starfield", category: "table_effect", name: "Starfield", description: "Stars twinkling around you", price: 100000, rarity: "epic", cssValue: "animate-starfield", preview: "🌌" },
  { id: "te_void_table", category: "table_effect", name: "Void Table", description: "Playing at the edge of the universe", price: 250000, rarity: "legendary", cssValue: "animate-void-table", preview: "🌀" },

  // ── Titles ───────────────────────────────────────────────────────────
  { id: "t_newbie", category: "title", name: "Newcomer", description: "Just getting started", price: 1000, rarity: "common", cssValue: "Newcomer", preview: "🆕" },
  { id: "t_regular", category: "title", name: "Regular", description: "A familiar face", price: 3000, rarity: "common", cssValue: "Regular", preview: "🎯" },
  { id: "t_shark", category: "title", name: "Card Shark", description: "Watch out for this one", price: 10000, rarity: "uncommon", cssValue: "Card Shark", preview: "🦈" },
  { id: "t_whale", category: "title", name: "High Roller", description: "Money is no object", price: 25000, rarity: "rare", cssValue: "High Roller", preview: "🐋" },
  { id: "t_vip", category: "title", name: "VIP", description: "Very Important Player", price: 50000, rarity: "epic", cssValue: "V.I.P.", preview: "🎖️" },
  { id: "t_legend", category: "title", name: "Living Legend", description: "Stories are told of your plays", price: 100000, rarity: "epic", cssValue: "Living Legend", preview: "🏆" },
  { id: "t_phantom", category: "title", name: "The Phantom", description: "They never see you coming", price: 250000, rarity: "legendary", cssValue: "The Phantom", preview: "👻" },
  { id: "t_godhand", category: "title", name: "God Hand", description: "Touched by fortune itself", price: 500000, rarity: "legendary", cssValue: "God Hand", preview: "🤚" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const cosmeticsById = new Map(COSMETICS.map((c) => [c.id, c]));

export function getCosmeticById(id: string): CosmeticItem | undefined {
  return cosmeticsById.get(id);
}

export function getCosmeticsByCategory(category: CosmeticCategory): CosmeticItem[] {
  return COSMETICS.filter((c) => c.category === category);
}

export const CATEGORY_META: Record<
  CosmeticCategory,
  { label: string; icon: string; description: string }
> = {
  name_color: { label: "Name Colors", icon: "🎨", description: "Change your username color" },
  badge: { label: "Badges", icon: "🏅", description: "Icon displayed before your name" },
  avatar_frame: { label: "Avatar Frames", icon: "🖼️", description: "Ring effect around your avatar" },
  chat_flair: { label: "Win Effects", icon: "✨", description: "Style your win messages" },
  table_effect: { label: "Table Effects", icon: "🎪", description: "Customize game backgrounds" },
  title: { label: "Titles", icon: "📜", description: "Title displayed below your name" },
};

export const CATEGORY_ORDER: CosmeticCategory[] = [
  "name_color",
  "badge",
  "title",
  "avatar_frame",
  "chat_flair",
  "table_effect",
];

export const RARITY_COLORS: Record<CosmeticRarity, { border: string; text: string; bg: string }> = {
  common: { border: "border-gray-500", text: "text-gray-400", bg: "bg-gray-500/10" },
  uncommon: { border: "border-green-500", text: "text-green-400", bg: "bg-green-500/10" },
  rare: { border: "border-blue-500", text: "text-blue-400", bg: "bg-blue-500/10" },
  epic: { border: "border-purple-500", text: "text-purple-400", bg: "bg-purple-500/10" },
  legendary: { border: "border-yellow-500", text: "text-yellow-400", bg: "bg-yellow-500/10" },
};

export function formatPrice(price: number): string {
  if (price >= 1_000_000) return `${(price / 1_000_000).toFixed(1)}M`;
  if (price >= 1_000) return `${(price / 1_000).toFixed(0)}K`;
  return price.toLocaleString();
}

/** Returns inline style for name color cosmetics */
export function getNameColorStyle(itemId: string | null): React.CSSProperties | undefined {
  if (!itemId) return undefined;
  const item = getCosmeticById(itemId);
  if (!item || item.category !== "name_color") return undefined;
  if (item.cssValue === "prismatic") return undefined; // handled via className
  if (item.cssValue.startsWith("linear-gradient")) {
    return {
      background: item.cssValue,
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      backgroundClip: "text",
    };
  }
  return { color: item.cssValue };
}

/** Returns className for prismatic animated name */
export function getNameColorClass(itemId: string | null): string {
  if (!itemId) return "";
  const item = getCosmeticById(itemId);
  if (item?.cssValue === "prismatic") return "animate-prismatic";
  return "";
}
