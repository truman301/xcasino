"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useChips } from "@/context/ChipContext";
import {
  COSMETICS,
  getCosmeticById,
  CATEGORY_META,
  CATEGORY_ORDER,
  RARITY_COLORS,
  type CosmeticCategory,
  type CosmeticItem,
} from "@/lib/cosmetics";
import PlayerBadge from "@/components/PlayerBadge";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GameType = "slots" | "dice" | "crash" | "roulette" | "poker" | "blackjack";

interface GameHistoryRow {
  id: string;
  user_id: string;
  game_type: GameType;
  bet_amount: number;
  payout: number;
  multiplier: number;
  result_data: unknown;
  created_at: string;
}

interface PlayerStats {
  netProfit: number;
  totalWagered: number;
  totalWon: number;
  gamesPlayed: number;
  biggestWin: number;
  bestMultiplier: number;
  favoriteGame: GameType | null;
  winRate: number;
  gameBreakdown: Record<GameType, number>;
}

interface RecentGame {
  id: string;
  game_type: GameType;
  bet_amount: number;
  payout: number;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GAME_EMOJIS: Record<GameType, string> = {
  poker: "\u{1F0CF}",
  blackjack: "\u{1F0A1}",
  roulette: "\uD83C\uDFB0",
  slots: "\uD83C\uDF52",
  dice: "\uD83C\uDFB2",
  crash: "\uD83D\uDCC8",
};

const GAME_LABELS: Record<GameType, string> = {
  poker: "Poker",
  blackjack: "Blackjack",
  roulette: "Roulette",
  slots: "Slots",
  dice: "Dice",
  crash: "Crash",
};

const ALL_GAMES: GameType[] = ["poker", "blackjack", "roulette", "slots", "dice", "crash"];

const RARITY_HEX: Record<string, string> = {
  common: "#9ca3af",
  uncommon: "#4ade80",
  rare: "#60a5fa",
  epic: "#a78bfa",
  legendary: "#d4af37",
};

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

function formatNumber(n: number): string {
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString();
}

function formatMemberSince(dateString: string): string {
  const d = new Date(dateString);
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `Member since ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function timeAgo(dateString: string): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diffSec = Math.floor((now - then) / 1000);

  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  const diffMonth = Math.floor(diffDay / 30);
  return `${diffMonth}mo ago`;
}

function computeStats(rows: GameHistoryRow[]): PlayerStats {
  const breakdown: Record<GameType, number> = {
    poker: 0, blackjack: 0, roulette: 0, slots: 0, dice: 0, crash: 0,
  };

  let totalWagered = 0;
  let totalWon = 0;
  let biggestWin = 0;
  let bestMultiplier = 0;
  let wins = 0;

  for (const row of rows) {
    totalWagered += row.bet_amount;
    totalWon += row.payout;
    if (row.payout > biggestWin) biggestWin = row.payout;
    if (row.multiplier > bestMultiplier) bestMultiplier = row.multiplier;
    if (row.payout > 0) wins++;
    if (breakdown[row.game_type] !== undefined) {
      breakdown[row.game_type]++;
    }
  }

  let favoriteGame: GameType | null = null;
  let maxPlays = 0;
  for (const game of ALL_GAMES) {
    if (breakdown[game] > maxPlays) {
      maxPlays = breakdown[game];
      favoriteGame = game;
    }
  }

  return {
    netProfit: totalWon - totalWagered,
    totalWagered,
    totalWon,
    gamesPlayed: rows.length,
    biggestWin,
    bestMultiplier,
    favoriteGame,
    winRate: rows.length > 0 ? (wins / rows.length) * 100 : 0,
    gameBreakdown: breakdown,
  };
}

// ---------------------------------------------------------------------------
// Loading Skeleton
// ---------------------------------------------------------------------------

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div className={`rounded bg-[var(--casino-border)] animate-pulse ${className ?? ""}`} />
  );
}

function LoadingSkeleton() {
  return (
    <div className="max-w-5xl mx-auto px-4 pt-24 pb-20 space-y-10">
      {/* Hero skeleton */}
      <div className="text-center space-y-4">
        <div className="mx-auto w-16 h-16 rounded-full bg-[var(--casino-border)] animate-pulse" />
        <SkeletonBlock className="h-8 w-48 mx-auto" />
        <SkeletonBlock className="h-4 w-32 mx-auto" />
        <SkeletonBlock className="h-10 w-40 mx-auto" />
      </div>

      {/* Stats skeleton */}
      <div className="glass rounded-2xl p-6 border border-[var(--casino-border)]">
        <SkeletonBlock className="h-5 w-36 mb-6" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="bg-[var(--casino-darker)] rounded-xl p-4 border border-[var(--casino-border)]">
              <SkeletonBlock className="h-3 w-20 mb-3" />
              <SkeletonBlock className="h-6 w-16" />
            </div>
          ))}
        </div>
      </div>

      {/* Game breakdown skeleton */}
      <div className="glass rounded-2xl p-6 border border-[var(--casino-border)]">
        <SkeletonBlock className="h-5 w-44 mb-6" />
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <SkeletonBlock className="h-5 w-5 rounded" />
              <SkeletonBlock className="h-5 w-20" />
              <SkeletonBlock className="h-3 flex-1 rounded-full" />
              <SkeletonBlock className="h-5 w-8" />
            </div>
          ))}
        </div>
      </div>

      {/* Recent activity skeleton */}
      <div className="glass rounded-2xl p-6 border border-[var(--casino-border)]">
        <SkeletonBlock className="h-5 w-36 mb-6" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Profile Page
// ---------------------------------------------------------------------------

export default function ProfilePage() {
  const { chips, username, profile, user, equippedCosmetics, ownedCosmetics } = useChips();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [recentGames, setRecentGames] = useState<RecentGame[]>([]);

  // ── Fetch game history on mount ──────────────────────────────────────
  const fetchStats = useCallback(async () => {
    if (!isSupabaseConfigured || !user) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const { data: allGames, error: allError } = await supabase
        .from("game_history")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (allError) {
        console.error("Error fetching game history:", allError);
        setLoading(false);
        return;
      }

      const rows = (allGames ?? []) as unknown as GameHistoryRow[];
      setStats(computeStats(rows));

      // Take the 10 most recent for the activity feed
      const recent: RecentGame[] = rows.slice(0, 10).map((r) => ({
        id: r.id,
        game_type: r.game_type,
        bet_amount: r.bet_amount,
        payout: r.payout,
        created_at: r.created_at,
      }));
      setRecentGames(recent);
    } catch (err) {
      console.error("Failed to load profile stats:", err);
    }

    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // ── Auth guard ────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="text-6xl mb-6 opacity-40">🔒</div>
          <h1 className="text-2xl font-bold text-white mb-2">Sign in to view your profile</h1>
          <p className="text-gray-500 mb-8">
            Create an account or sign in to track your stats, cosmetics, and game history.
          </p>
          <Link href="/" className="btn-casino text-lg px-8 py-3 inline-block">
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  // ── Loading state ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen">
        <LoadingSkeleton />
      </div>
    );
  }

  // ── Derived values ────────────────────────────────────────────────────
  const memberSince = profile?.created_at
    ? formatMemberSince(profile.created_at)
    : null;

  const totalCosmetics = COSMETICS.length;
  const ownedCount = ownedCosmetics.length;

  const maxBreakdown =
    stats && stats.gamesPlayed > 0
      ? Math.max(...Object.values(stats.gameBreakdown))
      : 0;

  const hasNoData =
    (!stats || stats.gamesPlayed === 0) && ownedCount === 0;

  // Group owned cosmetics by category
  const ownedByCategory: Record<CosmeticCategory, CosmeticItem[]> = {
    name_color: [],
    badge: [],
    title: [],
    avatar_frame: [],
    chat_flair: [],
    table_effect: [],
  };
  for (const itemId of ownedCosmetics) {
    const item = getCosmeticById(itemId);
    if (item) {
      ownedByCategory[item.category].push(item);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen pt-24 pb-20">
      {/* ═══════════════════════════════════════════════════════════════════
          Section 1: Hero / Header
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden pb-12 px-4">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0f0808] via-[var(--casino-darker)] to-transparent" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-80 bg-red-900/8 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-8 left-1/2 -translate-x-1/2 w-56 h-56 bg-amber-900/6 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-5xl mx-auto text-center animate-fade-in">
          {/* PlayerBadge */}
          <div className="flex justify-center mb-4">
            <PlayerBadge
              username={username}
              equippedCosmetics={equippedCosmetics ?? {}}
              size="lg"
              showTitle={true}
              showFrame={true}
            />
          </div>

          {/* Username */}
          <h1 className="text-3xl md:text-4xl font-black text-white mb-1 tracking-tight">
            {username}
          </h1>

          {/* Member since */}
          {memberSince && (
            <p className="text-sm text-gray-500 mb-4">{memberSince}</p>
          )}

          {/* Chip balance */}
          <div
            className="inline-flex items-center gap-3 glass rounded-2xl px-7 py-4 glow-gold-sm mb-6"
            style={{ animationDelay: "100ms", animationFillMode: "backwards" }}
          >
            <span className="text-3xl">🪙</span>
            <span className="text-3xl md:text-4xl font-black text-[var(--gold)]">
              {chips.toLocaleString()}
            </span>
            <span className="text-sm text-gray-500">chips</span>
          </div>

          <br />

          {/* Visit Store button */}
          <Link
            href="/store"
            className="btn-casino text-sm px-8 py-3 inline-block animate-fade-in"
            style={{ animationDelay: "200ms", animationFillMode: "backwards" }}
          >
            Visit Store
          </Link>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          Empty State — no games AND no cosmetics
          ═══════════════════════════════════════════════════════════════════ */}
      {hasNoData ? (
        <section className="max-w-5xl mx-auto px-4">
          <div
            className="glass rounded-2xl p-12 border border-[var(--casino-border)] text-center animate-fade-in"
            style={{ animationDelay: "300ms", animationFillMode: "backwards" }}
          >
            <div className="text-6xl mb-4">🎰</div>
            <h2 className="text-2xl font-bold text-white mb-2">Welcome to Casino X!</h2>
            <p className="text-gray-400 max-w-md mx-auto mb-8">
              Your profile is looking a little empty. Hit the tables to start
              building your stats, or visit the store to pick up some cosmetics.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link href="/slots" className="btn-casino text-sm px-6 py-3">
                Play Slots
              </Link>
              <Link href="/poker" className="btn-casino text-sm px-6 py-3">
                Play Poker
              </Link>
              <Link href="/crash" className="btn-casino-outline text-sm px-6 py-3">
                Try Crash
              </Link>
              <Link href="/store" className="btn-casino-outline text-sm px-6 py-3">
                Visit Store
              </Link>
            </div>
          </div>
        </section>
      ) : (
        <>
          {/* ═══════════════════════════════════════════════════════════════
              Section 2: Stats Overview
              ═══════════════════════════════════════════════════════════════ */}
          {stats && stats.gamesPlayed > 0 && (
            <section className="max-w-5xl mx-auto px-4 mb-10">
              <div
                className="glass rounded-2xl p-6 md:p-8 border border-[var(--casino-border)] animate-fade-in"
                style={{ animationDelay: "300ms", animationFillMode: "backwards" }}
              >
                <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                  <span className="text-[var(--gold)]">Stats</span> Overview
                </h2>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                  {/* Net Profit/Loss */}
                  <div className="bg-[var(--casino-darker)] rounded-xl p-4 border border-[var(--casino-border)]">
                    <p className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold mb-1">
                      Net Profit / Loss
                    </p>
                    <p className={`text-lg font-bold ${stats.netProfit >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {stats.netProfit >= 0 ? "+" : ""}{formatNumber(stats.netProfit)}
                    </p>
                  </div>

                  {/* Total Wagered */}
                  <div className="bg-[var(--casino-darker)] rounded-xl p-4 border border-[var(--casino-border)]">
                    <p className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold mb-1">
                      Total Wagered
                    </p>
                    <p className="text-lg font-bold text-white">
                      {formatNumber(stats.totalWagered)}
                    </p>
                  </div>

                  {/* Total Won */}
                  <div className="bg-[var(--casino-darker)] rounded-xl p-4 border border-[var(--casino-border)]">
                    <p className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold mb-1">
                      Total Won
                    </p>
                    <p className="text-lg font-bold text-[var(--gold)]">
                      {formatNumber(stats.totalWon)}
                    </p>
                  </div>

                  {/* Games Played */}
                  <div className="bg-[var(--casino-darker)] rounded-xl p-4 border border-[var(--casino-border)]">
                    <p className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold mb-1">
                      Games Played
                    </p>
                    <p className="text-lg font-bold text-white">
                      {formatNumber(stats.gamesPlayed)}
                    </p>
                  </div>

                  {/* Biggest Win */}
                  <div className="bg-[var(--casino-darker)] rounded-xl p-4 border border-[var(--casino-border)]">
                    <p className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold mb-1">
                      Biggest Win
                    </p>
                    <p className="text-lg font-bold text-[var(--gold)]">
                      {formatNumber(stats.biggestWin)}
                    </p>
                  </div>

                  {/* Best Multiplier */}
                  <div className="bg-[var(--casino-darker)] rounded-xl p-4 border border-[var(--casino-border)]">
                    <p className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold mb-1">
                      Best Multiplier
                    </p>
                    <p className="text-lg font-bold text-[var(--gold)]">
                      {stats.bestMultiplier.toFixed(2)}x
                    </p>
                  </div>

                  {/* Favorite Game */}
                  <div className="bg-[var(--casino-darker)] rounded-xl p-4 border border-[var(--casino-border)]">
                    <p className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold mb-1">
                      Favorite Game
                    </p>
                    <p className="text-lg font-bold text-white">
                      {stats.favoriteGame
                        ? `${GAME_EMOJIS[stats.favoriteGame]} ${GAME_LABELS[stats.favoriteGame]}`
                        : "\u2014"}
                    </p>
                  </div>

                  {/* Win Rate */}
                  <div className="bg-[var(--casino-darker)] rounded-xl p-4 border border-[var(--casino-border)]">
                    <p className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold mb-1">
                      Win Rate
                    </p>
                    <p className={`text-lg font-bold ${stats.winRate >= 50 ? "text-green-400" : "text-red-400"}`}>
                      {stats.winRate.toFixed(1)}%
                    </p>
                  </div>

                  {/* Cosmetics Owned */}
                  <div className="bg-[var(--casino-darker)] rounded-xl p-4 border border-[var(--casino-border)]">
                    <p className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold mb-1">
                      Cosmetics Owned
                    </p>
                    <p className="text-lg font-bold text-white">
                      {ownedCount} / {totalCosmetics}
                    </p>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              Section 3: Game Breakdown
              ═══════════════════════════════════════════════════════════════ */}
          {stats && stats.gamesPlayed > 0 && (
            <section className="max-w-5xl mx-auto px-4 mb-10">
              <div
                className="glass rounded-2xl p-6 md:p-8 border border-[var(--casino-border)] animate-fade-in"
                style={{ animationDelay: "400ms", animationFillMode: "backwards" }}
              >
                <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                  <span className="text-[var(--gold)]">Game</span> Breakdown
                </h2>

                <div className="space-y-3">
                  {ALL_GAMES.map((game) => {
                    const count = stats.gameBreakdown[game];
                    const pct = maxBreakdown > 0 ? (count / maxBreakdown) * 100 : 0;
                    return (
                      <div key={game} className="flex items-center gap-3 text-sm">
                        <span className="w-7 text-center text-lg shrink-0">
                          {GAME_EMOJIS[game]}
                        </span>
                        <span className="w-20 text-gray-400 font-medium shrink-0">
                          {GAME_LABELS[game]}
                        </span>
                        <div className="flex-1 h-3 bg-[var(--casino-darker)] rounded-full overflow-hidden border border-[var(--casino-border)]">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[var(--gold-dark)] to-[var(--gold)]"
                            style={{ width: `${pct}%`, transition: "width 0.6s ease" }}
                          />
                        </div>
                        <span className="w-10 text-right text-gray-500 font-semibold tabular-nums shrink-0">
                          {count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              Section 4: Cosmetics Collection
              ═══════════════════════════════════════════════════════════════ */}
          <section className="max-w-5xl mx-auto px-4 mb-10">
            <div
              className="glass rounded-2xl p-6 md:p-8 border border-[var(--casino-border)] animate-fade-in"
              style={{ animationDelay: "500ms", animationFillMode: "backwards" }}
            >
              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <span className="text-[var(--gold)]">Cosmetics</span> Collection
              </h2>

              <div className="space-y-8">
                {CATEGORY_ORDER.map((cat) => {
                  const meta = CATEGORY_META[cat];
                  const items = ownedByCategory[cat];
                  const equippedId = equippedCosmetics?.[cat] ?? null;

                  return (
                    <div key={cat}>
                      {/* Category header */}
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-lg">{meta.icon}</span>
                        <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider">
                          {meta.label}
                        </h3>
                      </div>

                      {items.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                          {items.map((item) => {
                            const isEquipped = equippedId === item.id;
                            const rarityColor = RARITY_COLORS[item.rarity];

                            return (
                              <div
                                key={item.id}
                                className="relative bg-[var(--casino-darker)] rounded-xl p-3 border-2 transition-all duration-200 hover:scale-[1.03]"
                                style={{
                                  borderColor: RARITY_HEX[item.rarity] + "60",
                                }}
                              >
                                {/* Equipped badge */}
                                {isEquipped && (
                                  <div className="absolute -top-2 -right-2 bg-[var(--gold)] text-black text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shadow-lg z-10">
                                    Equipped
                                  </div>
                                )}

                                {/* Preview */}
                                <div className="text-center mb-2">
                                  <span className="text-3xl">{item.preview}</span>
                                </div>

                                {/* Name */}
                                <p className="text-xs font-bold text-white text-center truncate mb-1">
                                  {item.name}
                                </p>

                                {/* Rarity badge */}
                                <div className="text-center">
                                  <span
                                    className={`inline-block text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${rarityColor.bg} ${rarityColor.text}`}
                                  >
                                    {item.rarity}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="bg-[var(--casino-darker)] rounded-xl p-4 border border-[var(--casino-border)] text-center">
                          <p className="text-sm text-gray-600">
                            No items yet.{" "}
                            <Link href="/store" className="text-[var(--gold)] hover:underline">
                              Visit the store
                            </Link>
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Total collected */}
              <div className="mt-8 pt-4 border-t border-[var(--casino-border)] text-center">
                <p className="text-sm text-gray-500">
                  <span className="text-white font-bold">{ownedCount}</span> of{" "}
                  <span className="text-white font-bold">{totalCosmetics}</span>{" "}
                  cosmetics collected
                </p>
              </div>
            </div>
          </section>

          {/* ═══════════════════════════════════════════════════════════════
              Section 5: Recent Activity
              ═══════════════════════════════════════════════════════════════ */}
          {recentGames.length > 0 && (
            <section className="max-w-5xl mx-auto px-4 mb-10">
              <div
                className="glass rounded-2xl p-6 md:p-8 border border-[var(--casino-border)] animate-fade-in"
                style={{ animationDelay: "600ms", animationFillMode: "backwards" }}
              >
                <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                  <span className="text-[var(--gold)]">Recent</span> Activity
                </h2>

                {/* Table header */}
                <div className="hidden sm:grid grid-cols-[1fr_100px_100px_100px_80px] gap-4 px-4 pb-3 border-b border-[var(--casino-border)]">
                  <span className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold">
                    Game
                  </span>
                  <span className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold text-right">
                    Bet
                  </span>
                  <span className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold text-right">
                    Payout
                  </span>
                  <span className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold text-right">
                    Profit
                  </span>
                  <span className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold text-right">
                    Time
                  </span>
                </div>

                {/* Rows */}
                <div className="space-y-1">
                  {recentGames.map((game, i) => {
                    const profit = game.payout - game.bet_amount;
                    const isWin = game.payout > 0;

                    return (
                      <div
                        key={game.id}
                        className="grid grid-cols-2 sm:grid-cols-[1fr_100px_100px_100px_80px] gap-2 sm:gap-4 px-4 py-3 rounded-lg hover:bg-white/[0.02] transition-colors border-b border-[var(--casino-border)]/30 last:border-b-0"
                        style={{
                          animationDelay: `${650 + i * 40}ms`,
                          animationFillMode: "backwards",
                        }}
                      >
                        {/* Game */}
                        <div className="flex items-center gap-2">
                          <span className="text-base">{GAME_EMOJIS[game.game_type]}</span>
                          <span className="text-sm text-white font-medium">
                            {GAME_LABELS[game.game_type]}
                          </span>
                        </div>

                        {/* Bet */}
                        <div className="text-right">
                          <span className="text-xs text-gray-500 sm:hidden mr-1">Bet:</span>
                          <span className="text-sm text-gray-400 tabular-nums">
                            {formatNumber(game.bet_amount)}
                          </span>
                        </div>

                        {/* Payout */}
                        <div className="text-right">
                          <span className="text-xs text-gray-500 sm:hidden mr-1">Won:</span>
                          <span className="text-sm text-[var(--gold)] tabular-nums">
                            {formatNumber(game.payout)}
                          </span>
                        </div>

                        {/* Profit */}
                        <div className="text-right">
                          <span className="text-xs text-gray-500 sm:hidden mr-1">P/L:</span>
                          <span
                            className={`text-sm font-semibold tabular-nums ${
                              isWin ? "text-green-400" : "text-red-400"
                            }`}
                          >
                            {profit >= 0 ? "+" : ""}{formatNumber(profit)}
                          </span>
                        </div>

                        {/* Time */}
                        <div className="text-right col-span-2 sm:col-span-1">
                          <span className="text-xs text-gray-600">
                            {timeAgo(game.created_at)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          Footer disclaimer
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="max-w-5xl mx-auto px-4 mt-8">
        <div className="accent-line-gold mb-6" />
        <p className="text-center text-gray-600 text-xs leading-relaxed max-w-2xl mx-auto">
          All chips in Casino X are virtual and hold no real-world monetary value.
          Chips cannot be redeemed, exchanged, or cashed out for real money,
          goods, or services. Casino X is a free-to-play social casino intended
          for entertainment purposes only.
        </p>
      </section>
    </div>
  );
}
