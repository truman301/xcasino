"use client";

import { useState, useEffect, useCallback } from "react";
import { useChips } from "@/context/ChipContext";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LeaderboardEntry {
  rank: number;
  player: string;
  value: number;
}

interface UserStats {
  rank: number | null;
  value: number;
  totalGames: number;
  biggestWin: number;
  totalWagered: number;
}

type GameFilter =
  | "all"
  | "slots"
  | "dice"
  | "crash"
  | "roulette"
  | "poker"
  | "blackjack";
type PeriodFilter = "all_time" | "monthly" | "weekly";
type MetricFilter = "biggest_win" | "total_wagered" | "most_played";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GAME_TABS: { key: GameFilter; label: string }[] = [
  { key: "all", label: "All Games" },
  { key: "slots", label: "Slots" },
  { key: "dice", label: "Dice" },
  { key: "crash", label: "Crash" },
  { key: "roulette", label: "Roulette" },
  { key: "poker", label: "Poker" },
  { key: "blackjack", label: "Blackjack" },
];

const PERIOD_TABS: { key: PeriodFilter; label: string }[] = [
  { key: "all_time", label: "All Time" },
  { key: "monthly", label: "Monthly" },
  { key: "weekly", label: "Weekly" },
];

const METRIC_TABS: { key: MetricFilter; label: string }[] = [
  { key: "biggest_win", label: "Biggest Win" },
  { key: "total_wagered", label: "Total Wagered" },
  { key: "most_played", label: "Most Played" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatValue(value: number, metric: MetricFilter): string {
  if (metric === "most_played") {
    return value.toLocaleString() + " games";
  }
  return value.toLocaleString() + " chips";
}

function getRankStyle(rank: number): {
  bg: string;
  border: string;
  text: string;
  badge: string;
} {
  switch (rank) {
    case 1:
      return {
        bg: "bg-yellow-900/20",
        border: "border-yellow-600/40",
        text: "text-[var(--gold)]",
        badge: "bg-gradient-to-br from-yellow-400 to-yellow-600 text-black",
      };
    case 2:
      return {
        bg: "bg-gray-500/10",
        border: "border-gray-400/30",
        text: "text-gray-300",
        badge: "bg-gradient-to-br from-gray-300 to-gray-500 text-black",
      };
    case 3:
      return {
        bg: "bg-orange-900/15",
        border: "border-orange-700/30",
        text: "text-orange-400",
        badge: "bg-gradient-to-br from-orange-500 to-orange-700 text-black",
      };
    default:
      return {
        bg: "",
        border: "border-transparent",
        text: "text-gray-400",
        badge: "bg-[var(--casino-card)] text-gray-500",
      };
  }
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function LeaderboardPage() {
  const { chips, isLoggedIn, username } = useChips();

  const [gameFilter, setGameFilter] = useState<GameFilter>("all");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("all_time");
  const [metricFilter, setMetricFilter] = useState<MetricFilter>("biggest_win");

  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(false);

  // ---------------------------------------------------------------------------
  // Fetch leaderboard data
  // ---------------------------------------------------------------------------

  const fetchLeaderboard = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setEntries([]);
      setUserStats(null);
      return;
    }

    setLoading(true);

    try {
      let query = supabase
        .from("leaderboard_cache")
        .select("*")
        .eq("metric", metricFilter)
        .eq("period", periodFilter)
        .order("rank", { ascending: true })
        .limit(10);

      if (gameFilter !== "all") {
        query = query.eq("game", gameFilter);
      } else {
        query = query.eq("game", "all");
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching leaderboard:", error);
        setEntries([]);
      } else if (data && data.length > 0) {
        setEntries(
          data.map((row: Record<string, unknown>, index: number) => ({
            rank: (row.rank as number) ?? index + 1,
            player: (row.player_name as string) ?? "Anonymous",
            value: (row.value as number) ?? 0,
          }))
        );
      } else {
        setEntries([]);
      }

      // Fetch user stats if logged in
      if (isLoggedIn && username && username !== "Guest") {
        try {
          let userQuery = supabase
            .from("leaderboard_cache")
            .select("*")
            .eq("metric", metricFilter)
            .eq("period", periodFilter)
            .eq("player_name", username);

          if (gameFilter !== "all") {
            userQuery = userQuery.eq("game", gameFilter);
          } else {
            userQuery = userQuery.eq("game", "all");
          }

          const { data: userData } = await userQuery.single();

          if (userData) {
            setUserStats({
              rank: (userData.rank as number) ?? null,
              value: (userData.value as number) ?? 0,
              totalGames: (userData.total_games as number) ?? 0,
              biggestWin: (userData.biggest_win as number) ?? 0,
              totalWagered: (userData.total_wagered as number) ?? 0,
            });
          } else {
            setUserStats(null);
          }
        } catch {
          setUserStats(null);
        }
      } else {
        setUserStats(null);
      }
    } catch (err) {
      console.error("Failed to fetch leaderboard:", err);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [gameFilter, periodFilter, metricFilter, isLoggedIn, username]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  function renderPillTabs<T extends string>(
    tabs: { key: T; label: string }[],
    active: T,
    onChange: (key: T) => void
  ) {
    return (
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
              active === tab.key
                ? "bg-[var(--gold)] text-black shadow-lg shadow-[var(--gold)]/20"
                : "bg-[var(--casino-card)] border border-[var(--casino-border)] text-gray-400 hover:text-white hover:border-[var(--gold)]/40"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen pb-20 animate-fade-in">
      {/* Header */}
      <div className="max-w-4xl mx-auto px-4 pt-6 pb-4">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">
            <span className="text-[var(--gold)]">Leaderboards</span>
          </h1>
          <div className="glass rounded-full px-5 py-2 flex items-center gap-2">
            <span className="text-xl">🪙</span>
            <span className="text-xl font-bold text-[var(--gold)]">
              {chips.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4">
        {/* Supabase not configured notice */}
        {!isSupabaseConfigured && (
          <div className="mb-6 glass rounded-xl p-4 border border-[var(--casino-border)]">
            <p className="text-sm text-gray-500 text-center">
              Leaderboard data requires a database connection. Connect Supabase
              to see live rankings.
            </p>
          </div>
        )}

        {/* Filter Section */}
        <div className="glass rounded-xl p-5 mb-6 border border-[var(--casino-border)] animate-fade-in">
          {/* Game type filter */}
          <div className="mb-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2">
              Game
            </p>
            {renderPillTabs(GAME_TABS, gameFilter, setGameFilter)}
          </div>

          {/* Period filter */}
          <div className="mb-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2">
              Period
            </p>
            {renderPillTabs(PERIOD_TABS, periodFilter, setPeriodFilter)}
          </div>

          {/* Metric filter */}
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2">
              Metric
            </p>
            {renderPillTabs(METRIC_TABS, metricFilter, setMetricFilter)}
          </div>
        </div>

        {/* Leaderboard Table */}
        <div className="glass rounded-xl overflow-hidden border border-[var(--casino-border)] animate-fade-in mb-6">
          {/* Table header */}
          <div className="grid grid-cols-[60px_1fr_auto] md:grid-cols-[80px_1fr_180px] gap-4 px-5 py-3 border-b border-[var(--casino-border)]">
            <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">
              #
            </span>
            <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">
              Player
            </span>
            <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold text-right">
              {metricFilter === "biggest_win"
                ? "Biggest Win"
                : metricFilter === "total_wagered"
                ? "Total Wagered"
                : "Games Played"}
            </span>
          </div>

          {/* Loading state */}
          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-[var(--gold)]/30 border-t-[var(--gold)] rounded-full animate-spin" />
                <p className="text-sm text-gray-500">Loading rankings...</p>
              </div>
            </div>
          )}

          {/* Empty state */}
          {!loading && entries.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="text-5xl mb-4 opacity-30">🏆</div>
              <p className="text-gray-400 font-semibold text-lg mb-1">
                No leaderboard data yet
              </p>
              <p className="text-gray-600 text-sm">
                Play some games to claim your spot!
              </p>
            </div>
          )}

          {/* Entries */}
          {!loading &&
            entries.map((entry, index) => {
              const rankStyle = getRankStyle(entry.rank);
              const isEven = index % 2 === 0;

              return (
                <div
                  key={`${entry.rank}-${entry.player}`}
                  className={`grid grid-cols-[60px_1fr_auto] md:grid-cols-[80px_1fr_180px] gap-4 px-5 py-3.5 items-center transition-colors duration-150 hover:bg-white/[0.03] border-b border-[var(--casino-border)]/50 last:border-b-0 ${
                    isEven ? "bg-white/[0.01]" : "bg-transparent"
                  } ${rankStyle.bg}`}
                  style={{
                    animationDelay: `${index * 50}ms`,
                  }}
                >
                  {/* Rank */}
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black ${rankStyle.badge}`}
                    >
                      {entry.rank}
                    </span>
                    {entry.rank === 1 && (
                      <span className="text-lg" title="Champion">
                        👑
                      </span>
                    )}
                  </div>

                  {/* Player name */}
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`font-semibold truncate ${
                        entry.rank <= 3 ? rankStyle.text : "text-white"
                      }`}
                    >
                      {entry.player}
                    </span>
                    {entry.rank <= 3 && (
                      <span className="text-xs">
                        {entry.rank === 1
                          ? "🥇"
                          : entry.rank === 2
                          ? "🥈"
                          : "🥉"}
                      </span>
                    )}
                  </div>

                  {/* Value */}
                  <div className="text-right">
                    <span
                      className={`font-bold tabular-nums ${
                        entry.rank === 1
                          ? "text-[var(--gold)]"
                          : entry.rank <= 3
                          ? rankStyle.text
                          : "text-gray-300"
                      }`}
                    >
                      {formatValue(entry.value, metricFilter)}
                    </span>
                  </div>
                </div>
              );
            })}
        </div>

        {/* Your Stats Section */}
        {isLoggedIn && (
          <div className="glass rounded-xl p-5 border border-[var(--casino-border)] animate-fade-in mb-6">
            <h3 className="text-sm font-bold uppercase tracking-wider mb-4 text-[var(--gold)]">
              Your Stats
            </h3>

            {userStats ? (
              <div className="space-y-4">
                {/* Current rank + value */}
                <div className="flex items-center justify-between p-4 bg-[var(--casino-card)] rounded-xl border border-[var(--casino-border)]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[var(--gold)]/10 border border-[var(--gold)]/30 flex items-center justify-center">
                      <span className="text-[var(--gold)] font-black text-lg">
                        {userStats.rank ?? "—"}
                      </span>
                    </div>
                    <div>
                      <p className="text-white font-semibold">{username}</p>
                      <p className="text-xs text-gray-500">Current Rank</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[var(--gold)] font-bold text-lg tabular-nums">
                      {formatValue(userStats.value, metricFilter)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {metricFilter === "biggest_win"
                        ? "Biggest Win"
                        : metricFilter === "total_wagered"
                        ? "Total Wagered"
                        : "Games Played"}
                    </p>
                  </div>
                </div>

                {/* Detailed stats */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-[var(--casino-card)] border border-[var(--casino-border)] rounded-xl p-3 text-center">
                    <p className="text-xs text-gray-500 mb-1">Games Played</p>
                    <p className="text-xl font-bold text-white tabular-nums">
                      {userStats.totalGames.toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-[var(--casino-card)] border border-[var(--casino-border)] rounded-xl p-3 text-center">
                    <p className="text-xs text-gray-500 mb-1">Biggest Win</p>
                    <p className="text-xl font-bold text-green-400 tabular-nums">
                      {userStats.biggestWin.toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-[var(--casino-card)] border border-[var(--casino-border)] rounded-xl p-3 text-center">
                    <p className="text-xs text-gray-500 mb-1">Total Wagered</p>
                    <p className="text-xl font-bold text-[var(--gold)] tabular-nums">
                      {userStats.totalWagered.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-gray-500 text-sm">
                  No stats available for the current filters. Play some games to
                  appear on the leaderboard!
                </p>
              </div>
            )}
          </div>
        )}

        {/* Footer info */}
        <div className="mt-8 text-center animate-fade-in">
          <p className="text-xs text-gray-600">
            Leaderboard rankings update periodically. Virtual chips have no
            real-world value. Play responsibly.
          </p>
        </div>
      </div>
    </div>
  );
}
