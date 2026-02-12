"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useChips } from "@/context/ChipContext";
import { COSMETICS } from "@/lib/cosmetics";
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

// ---------------------------------------------------------------------------
// Helpers
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
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-[var(--casino-darker)] rounded-lg p-3 border border-[var(--casino-border)]">
      <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-sm font-bold ${color ?? "text-white"}`}>{value}</p>
    </div>
  );
}

function SkeletonLine({ width }: { width: string }) {
  return (
    <div
      className="h-4 rounded bg-[var(--casino-border)] animate-pulse"
      style={{ width }}
    />
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4 py-2">
      {/* Header skeleton */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-[var(--casino-border)] animate-pulse" />
        <div className="space-y-2 flex-1">
          <SkeletonLine width="50%" />
          <SkeletonLine width="35%" />
        </div>
      </div>

      {/* Stats grid skeleton */}
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-[var(--casino-darker)] rounded-lg p-3 border border-[var(--casino-border)]">
            <SkeletonLine width="60%" />
            <div className="mt-2">
              <SkeletonLine width="40%" />
            </div>
          </div>
        ))}
      </div>

      {/* Game breakdown skeleton */}
      <div className="space-y-2">
        <SkeletonLine width="30%" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-8 w-20 rounded bg-[var(--casino-border)] animate-pulse" />
          ))}
        </div>
      </div>

      {/* Recent activity skeleton */}
      <div className="space-y-2">
        <SkeletonLine width="35%" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-10 rounded bg-[var(--casino-border)] animate-pulse" />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface ProfilePopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ProfilePopup({ isOpen, onClose }: ProfilePopupProps) {
  const { chips, username, profile, user, equippedCosmetics, ownedCosmetics } = useChips();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [recentGames, setRecentGames] = useState<RecentGame[]>([]);

  // ── Fetch game history ──────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    if (!isSupabaseConfigured || !user) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      // Fetch all game history for stats
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

      // Take the 5 most recent for the activity feed
      const recent: RecentGame[] = rows.slice(0, 5).map((r) => ({
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
    if (isOpen) {
      fetchStats();
    }
  }, [isOpen, fetchStats]);

  // ── Close on Escape key ─────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // ── Derived values ──────────────────────────────────────────────────
  const memberSince = profile?.created_at
    ? formatMemberSince(profile.created_at)
    : null;

  const totalCosmetics = COSMETICS.length;
  const ownedCount = ownedCosmetics.length;

  const maxBreakdown =
    stats && stats.gamesPlayed > 0
      ? Math.max(...Object.values(stats.gameBreakdown))
      : 0;

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[90] bg-black/60"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed top-16 right-4 z-[100] w-[380px] max-h-[calc(100vh-5rem)] overflow-y-auto rounded-2xl glass animate-fade-in shadow-2xl shadow-black/60">
        {/* ── Close button (top-right) ──────────────────────────────── */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-500 hover:text-white transition-colors z-10"
          aria-label="Close profile popup"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="p-5">
          {/* ── Header ────────────────────────────────────────────── */}
          <div className="flex items-center gap-4 mb-1">
            <PlayerBadge
              username={username}
              equippedCosmetics={equippedCosmetics ?? {}}
              size="lg"
              showTitle={true}
              showFrame={true}
            />
          </div>

          <div className="mt-3 space-y-1">
            {memberSince && (
              <p className="text-xs text-gray-500">{memberSince}</p>
            )}
            <p className="text-sm font-bold text-[var(--gold)] flex items-center gap-1.5">
              <span className="text-base">🪙</span>
              {formatNumber(chips)} chips
            </p>
          </div>

          <div className="accent-line-gold my-4" />

          {/* ── Body ──────────────────────────────────────────────── */}
          {loading ? (
            <LoadingSkeleton />
          ) : !stats || stats.gamesPlayed === 0 ? (
            /* ── Empty state ──────────────────────────────────────── */
            <div className="text-center py-8">
              <p className="text-4xl mb-3">🎰</p>
              <p className="text-white font-semibold mb-1">No games played yet!</p>
              <p className="text-sm text-gray-500 mb-4">
                Hit the tables and start building your stats.
              </p>
              <Link href="/slots" className="btn-casino text-sm inline-block">
                Play Now
              </Link>
            </div>
          ) : (
            <>
              {/* ── Stats grid ──────────────────────────────────── */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                <StatCard
                  label="Net Profit / Loss"
                  value={`${stats.netProfit >= 0 ? "+" : ""}${formatNumber(stats.netProfit)}`}
                  color={stats.netProfit >= 0 ? "text-green-400" : "text-red-400"}
                />
                <StatCard
                  label="Total Wagered"
                  value={formatNumber(stats.totalWagered)}
                  color="text-white"
                />
                <StatCard
                  label="Total Won"
                  value={formatNumber(stats.totalWon)}
                  color="text-[var(--gold)]"
                />
                <StatCard
                  label="Games Played"
                  value={formatNumber(stats.gamesPlayed)}
                />
                <StatCard
                  label="Biggest Win"
                  value={formatNumber(stats.biggestWin)}
                  color="text-[var(--gold)]"
                />
                <StatCard
                  label="Best Multiplier"
                  value={`${stats.bestMultiplier.toFixed(2)}x`}
                  color="text-[var(--gold)]"
                />
                <StatCard
                  label="Favorite Game"
                  value={
                    stats.favoriteGame
                      ? `${GAME_EMOJIS[stats.favoriteGame]} ${GAME_LABELS[stats.favoriteGame]}`
                      : "—"
                  }
                />
                <StatCard
                  label="Win Rate"
                  value={`${stats.winRate.toFixed(1)}%`}
                  color={stats.winRate >= 50 ? "text-green-400" : "text-red-400"}
                />
                <StatCard
                  label="Current Balance"
                  value={formatNumber(chips)}
                  color="text-[var(--gold)]"
                />
                <StatCard
                  label="Cosmetics Owned"
                  value={`${ownedCount} / ${totalCosmetics}`}
                />
              </div>

              {/* ── Game breakdown ───────────────────────────────── */}
              <div className="mb-4">
                <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2">
                  Game Breakdown
                </p>
                <div className="space-y-1.5">
                  {ALL_GAMES.map((game) => {
                    const count = stats.gameBreakdown[game];
                    const pct = maxBreakdown > 0 ? (count / maxBreakdown) * 100 : 0;
                    return (
                      <div key={game} className="flex items-center gap-2 text-xs">
                        <span className="w-5 text-center shrink-0">{GAME_EMOJIS[game]}</span>
                        <span className="w-16 text-gray-400 shrink-0">{GAME_LABELS[game]}</span>
                        <div className="flex-1 h-2 bg-[var(--casino-darker)] rounded-full overflow-hidden border border-[var(--casino-border)]">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[var(--gold-dark)] to-[var(--gold)]"
                            style={{ width: `${pct}%`, transition: "width 0.5s ease" }}
                          />
                        </div>
                        <span className="w-8 text-right text-gray-500 shrink-0">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── Recent activity ──────────────────────────────── */}
              {recentGames.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2">
                    Recent Activity
                  </p>
                  <div className="space-y-1.5">
                    {recentGames.map((game) => {
                      const profit = game.payout - game.bet_amount;
                      const isWin = game.payout > 0;
                      return (
                        <div
                          key={game.id}
                          className="flex items-center gap-2 bg-[var(--casino-darker)] rounded-lg px-3 py-2 border border-[var(--casino-border)] text-xs"
                        >
                          <span className="text-sm shrink-0">{GAME_EMOJIS[game.game_type]}</span>
                          <span className="text-gray-400 flex-1">{GAME_LABELS[game.game_type]}</span>
                          <span className="text-gray-500">
                            bet {formatNumber(game.bet_amount)}
                          </span>
                          <span className={isWin ? "text-green-400 font-semibold" : "text-red-400 font-semibold"}>
                            {profit >= 0 ? "+" : ""}{formatNumber(profit)}
                          </span>
                          <span className="text-gray-600 text-[10px] w-12 text-right shrink-0">
                            {timeAgo(game.created_at)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Footer ──────────────────────────────────────────── */}
          <div className="accent-line-gold my-4" />
          <div className="flex items-center gap-3">
            <Link href="/store" className="btn-casino-outline text-sm flex-1 text-center" onClick={onClose}>
              Visit Store
            </Link>
            <button onClick={onClose} className="btn-casino text-sm flex-1">
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
