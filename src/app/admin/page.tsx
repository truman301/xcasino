"use client";

import { useChips } from "@/context/ChipContext";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import Link from "next/link";
import { useState, useEffect, useCallback } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProfileRow {
  id: string;
  username: string;
  chips: number;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

interface UserRow extends ProfileRow {
  email: string;
  games_played: number;
}

interface GameAnalytics {
  game_type: string;
  total_plays: number;
  total_wagered: number;
}

interface HouseEdges {
  slots: number;
  dice: number;
  crash: number;
  roulette: number;
  poker: number;
  blackjack: number;
}

interface Settings {
  house_edge: HouseEdges;
  min_bet: number;
  max_bet: number;
  daily_bonus: number;
}

// ---------------------------------------------------------------------------
// Skeleton helpers
// ---------------------------------------------------------------------------

function SkeletonBar({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-white/5 ${className}`}
    />
  );
}

function StatCardSkeleton() {
  return (
    <div className="glass rounded-2xl p-6 border border-[var(--casino-border)]">
      <SkeletonBar className="h-3 w-20 mb-3" />
      <SkeletonBar className="h-8 w-28 mb-2" />
      <SkeletonBar className="h-3 w-16" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdminPage() {
  const { isAdmin, loading: authLoading } = useChips();

  // Data state
  const [users, setUsers] = useState<UserRow[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [analytics, setAnalytics] = useState<GameAnalytics[]>([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalGames: 0,
    totalWagered: 0,
    activeToday: 0,
  });

  // UI state
  const [dataLoading, setDataLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [settingsSaving, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"users" | "settings" | "analytics">("users");

  // Editable settings (local state for form)
  const [editSettings, setEditSettings] = useState<Settings | null>(null);

  // ------------------------------------------------------------------
  // Fetch all admin data
  // ------------------------------------------------------------------

  const fetchData = useCallback(async () => {
    if (!isSupabaseConfigured || !isAdmin) return;
    setDataLoading(true);

    try {
      // Fetch profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      // Fetch game history aggregate
      const { data: gameHistory } = await supabase
        .from("game_history")
        .select("user_id, game_type, bet_amount, created_at");

      // Fetch settings
      const { data: settingsRows } = await supabase
        .from("settings")
        .select("*");

      // Build users list with game counts
      const profileList = (profiles ?? []) as ProfileRow[];
      const historyList = gameHistory ?? [];

      const gamesPerUser: Record<string, number> = {};
      historyList.forEach((g: { user_id: string }) => {
        gamesPerUser[g.user_id] = (gamesPerUser[g.user_id] || 0) + 1;
      });

      const userRows: UserRow[] = profileList.map((p) => ({
        ...p,
        email: "", // will be populated if admin has auth access
        games_played: gamesPerUser[p.id] || 0,
      }));

      // Try to fetch emails from auth (requires service role; may fail)
      try {
        const { data: authData } = await supabase.auth.admin.listUsers();
        if (authData?.users) {
          const emailMap: Record<string, string> = {};
          authData.users.forEach((u: { id: string; email?: string }) => {
            emailMap[u.id] = u.email ?? "";
          });
          userRows.forEach((u) => {
            u.email = emailMap[u.id] ?? "";
          });
        }
      } catch {
        // Service role not available through anon key - emails will be blank
      }

      setUsers(userRows);

      // Build stats
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();
      const activeToday = new Set(
        historyList
          .filter((g: { created_at: string }) => g.created_at >= todayISO)
          .map((g: { user_id: string }) => g.user_id)
      ).size;

      const totalWagered = historyList.reduce(
        (sum: number, g: { bet_amount: number }) => sum + (g.bet_amount || 0),
        0
      );

      setStats({
        totalUsers: profileList.length,
        totalGames: historyList.length,
        totalWagered,
        activeToday,
      });

      // Build analytics per game type
      const gameMap: Record<string, { plays: number; wagered: number }> = {};
      historyList.forEach((g: { game_type: string; bet_amount: number }) => {
        if (!gameMap[g.game_type]) {
          gameMap[g.game_type] = { plays: 0, wagered: 0 };
        }
        gameMap[g.game_type].plays += 1;
        gameMap[g.game_type].wagered += g.bet_amount || 0;
      });
      setAnalytics(
        Object.entries(gameMap)
          .map(([game_type, data]) => ({
            game_type,
            total_plays: data.plays,
            total_wagered: data.wagered,
          }))
          .sort((a, b) => b.total_plays - a.total_plays)
      );

      // Parse settings
      if (settingsRows && settingsRows.length > 0) {
        const settingsMap: Record<string, unknown> = {};
        settingsRows.forEach((row: { key: string; value: unknown }) => {
          settingsMap[row.key] = row.value;
        });
        const parsed: Settings = {
          house_edge: (settingsMap.house_edge ?? {
            slots: 5,
            dice: 1,
            crash: 3,
            roulette: 2.7,
            poker: 0,
            blackjack: 1,
          }) as HouseEdges,
          min_bet: Number(settingsMap.min_bet ?? 100),
          max_bet: Number(settingsMap.max_bet ?? 50000),
          daily_bonus: Number(settingsMap.daily_bonus ?? 5000),
        };
        setSettings(parsed);
        setEditSettings(parsed);
      }
    } catch (err) {
      console.error("Admin: failed to fetch data", err);
    } finally {
      setDataLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!authLoading && isAdmin && isSupabaseConfigured) {
      fetchData();
    } else if (!authLoading) {
      setDataLoading(false);
    }
  }, [authLoading, isAdmin, fetchData]);

  // ------------------------------------------------------------------
  // User actions
  // ------------------------------------------------------------------

  const adjustChips = async (userId: string, delta: number) => {
    const actionKey = `chips-${userId}-${delta}`;
    setActionInProgress(actionKey);
    try {
      const user = users.find((u) => u.id === userId);
      if (!user) return;
      const newChips = Math.max(0, user.chips + delta);
      await supabase
        .from("profiles")
        .update({ chips: newChips, updated_at: new Date().toISOString() })
        .eq("id", userId);
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, chips: newChips } : u))
      );
    } catch (err) {
      console.error("Failed to adjust chips:", err);
    } finally {
      setActionInProgress(null);
    }
  };

  const toggleAdmin = async (userId: string, currentValue: boolean) => {
    const actionKey = `admin-${userId}`;
    setActionInProgress(actionKey);
    try {
      await supabase
        .from("profiles")
        .update({ is_admin: !currentValue, updated_at: new Date().toISOString() })
        .eq("id", userId);
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, is_admin: !currentValue } : u
        )
      );
    } catch (err) {
      console.error("Failed to toggle admin:", err);
    } finally {
      setActionInProgress(null);
    }
  };

  // ------------------------------------------------------------------
  // Settings save
  // ------------------------------------------------------------------

  const saveSettings = async () => {
    if (!editSettings) return;
    setSavingSettings(true);
    setSettingsSaved(false);
    try {
      const updates = [
        {
          key: "house_edge",
          value: editSettings.house_edge,
          updated_at: new Date().toISOString(),
        },
        {
          key: "min_bet",
          value: editSettings.min_bet,
          updated_at: new Date().toISOString(),
        },
        {
          key: "max_bet",
          value: editSettings.max_bet,
          updated_at: new Date().toISOString(),
        },
        {
          key: "daily_bonus",
          value: editSettings.daily_bonus,
          updated_at: new Date().toISOString(),
        },
      ];

      for (const row of updates) {
        await supabase
          .from("settings")
          .upsert(row, { onConflict: "key" });
      }

      setSettings(editSettings);
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 3000);
    } catch (err) {
      console.error("Failed to save settings:", err);
    } finally {
      setSavingSettings(false);
    }
  };

  // ------------------------------------------------------------------
  // Filtered users
  // ------------------------------------------------------------------

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    return (
      u.username.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.id.toLowerCase().includes(q)
    );
  });

  // ------------------------------------------------------------------
  // Guard: auth loading
  // ------------------------------------------------------------------

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass rounded-2xl p-12 text-center">
          <div className="w-8 h-8 border-2 border-[var(--gold)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Guard: not admin
  // ------------------------------------------------------------------

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 animate-fade-in">
        <div className="glass rounded-2xl p-12 max-w-md text-center border border-red-900/30">
          <div className="text-5xl mb-4">&#128683;</div>
          <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
          <p className="text-gray-400 mb-6">
            You do not have permission to view this page. Admin privileges are
            required.
          </p>
          <Link href="/" className="btn-casino inline-block">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Guard: Supabase not configured
  // ------------------------------------------------------------------

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 animate-fade-in">
        <div className="glass rounded-2xl p-12 max-w-md text-center border border-[var(--casino-border)]">
          <div className="text-5xl mb-4">&#9888;&#65039;</div>
          <h1 className="text-2xl font-bold text-white mb-2">
            Supabase Required
          </h1>
          <p className="text-gray-400 mb-6">
            Admin features require a configured Supabase backend. Please set
            your <code className="text-[var(--gold)]">NEXT_PUBLIC_SUPABASE_URL</code>{" "}
            and{" "}
            <code className="text-[var(--gold)]">
              NEXT_PUBLIC_SUPABASE_ANON_KEY
            </code>{" "}
            environment variables.
          </p>
          <Link href="/" className="btn-casino-outline inline-block">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  const gameTypeLabels: Record<string, string> = {
    slots: "Slots",
    dice: "Dice",
    crash: "Crash",
    roulette: "Roulette",
    poker: "Poker",
    blackjack: "Blackjack",
  };

  return (
    <div className="min-h-screen pb-20 animate-fade-in">
      {/* Header */}
      <section className="relative overflow-hidden py-12 px-4">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0f0808] via-[var(--casino-darker)] to-transparent" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-80 bg-red-900/8 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-1">
            <Link
              href="/"
              className="text-gray-500 hover:text-[var(--gold)] transition-colors text-sm"
            >
              Home
            </Link>
            <span className="text-gray-600">/</span>
            <span className="text-gray-400 text-sm">Admin</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">
            <span className="text-[var(--gold)]">Admin</span>{" "}
            <span className="text-white">Dashboard</span>
          </h1>
          <div className="accent-line max-w-xs mt-2 mb-1" />
          <p className="text-gray-500 text-sm">
            Manage users, settings, and view analytics
          </p>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4">
        {/* ───── Stats Cards ───── */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {dataLoading ? (
            <>
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
            </>
          ) : (
            <>
              <div className="glass rounded-2xl p-6 border border-[var(--casino-border)] hover:border-[var(--gold)]/20 transition-colors">
                <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-1">
                  Total Users
                </p>
                <p className="text-3xl font-black text-white">
                  {stats.totalUsers.toLocaleString()}
                </p>
                <p className="text-xs text-gray-600 mt-1">registered accounts</p>
              </div>
              <div className="glass rounded-2xl p-6 border border-[var(--casino-border)] hover:border-[var(--gold)]/20 transition-colors">
                <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-1">
                  Games Played
                </p>
                <p className="text-3xl font-black text-[var(--gold)]">
                  {stats.totalGames.toLocaleString()}
                </p>
                <p className="text-xs text-gray-600 mt-1">all time</p>
              </div>
              <div className="glass rounded-2xl p-6 border border-[var(--casino-border)] hover:border-[var(--gold)]/20 transition-colors">
                <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-1">
                  Chips Wagered
                </p>
                <p className="text-3xl font-black text-white">
                  {stats.totalWagered.toLocaleString()}
                </p>
                <p className="text-xs text-gray-600 mt-1">total volume</p>
              </div>
              <div className="glass rounded-2xl p-6 border border-[var(--casino-border)] hover:border-[var(--gold)]/20 transition-colors">
                <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-1">
                  Active Today
                </p>
                <p className="text-3xl font-black text-[var(--gold)]">
                  {stats.activeToday.toLocaleString()}
                </p>
                <p className="text-xs text-gray-600 mt-1">unique players</p>
              </div>
            </>
          )}
        </section>

        {/* ───── Tab Navigation ───── */}
        <div className="flex gap-1 mb-6 glass rounded-xl p-1 max-w-md">
          {(
            [
              { key: "users", label: "Users" },
              { key: "settings", label: "Settings" },
              { key: "analytics", label: "Analytics" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all ${
                activeTab === tab.key
                  ? "bg-[var(--gold)]/10 text-[var(--gold)] border border-[var(--gold)]/20"
                  : "text-gray-400 hover:text-white border border-transparent"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ───── Users Tab ───── */}
        {activeTab === "users" && (
          <section className="animate-fade-in">
            <div className="glass rounded-2xl border border-[var(--casino-border)] overflow-hidden">
              {/* Search */}
              <div className="p-4 border-b border-[var(--casino-border)]">
                <div className="relative max-w-sm">
                  <svg
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search users by name, email, or ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[var(--casino-dark)] border border-[var(--casino-border)] text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-[var(--gold)]/40 transition-colors"
                  />
                </div>
              </div>

              {/* Table */}
              {dataLoading ? (
                <div className="p-6 space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <SkeletonBar key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--casino-border)] text-left">
                        <th className="px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-semibold">
                          Username
                        </th>
                        <th className="px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-semibold">
                          Email
                        </th>
                        <th className="px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-semibold text-right">
                          Chips
                        </th>
                        <th className="px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-semibold text-right">
                          Games
                        </th>
                        <th className="px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-semibold text-center">
                          Admin
                        </th>
                        <th className="px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-semibold">
                          Joined
                        </th>
                        <th className="px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-semibold text-right">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.length === 0 ? (
                        <tr>
                          <td
                            colSpan={7}
                            className="px-4 py-12 text-center text-gray-500"
                          >
                            {searchQuery
                              ? "No users match your search"
                              : "No users found"}
                          </td>
                        </tr>
                      ) : (
                        filteredUsers.map((user) => (
                          <tr
                            key={user.id}
                            className="border-b border-[var(--casino-border)]/50 hover:bg-white/[0.02] transition-colors"
                          >
                            <td className="px-4 py-3">
                              <span className="font-semibold text-white">
                                {user.username}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-400">
                              {user.email || (
                                <span className="text-gray-600 italic">
                                  hidden
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-[var(--gold)]">
                              {user.chips.toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-right text-gray-300">
                              {user.games_played.toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {user.is_admin ? (
                                <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[var(--gold)]/10 text-[var(--gold)] border border-[var(--gold)]/20">
                                  Admin
                                </span>
                              ) : (
                                <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/5 text-gray-500 border border-white/5">
                                  User
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-gray-500 text-xs">
                              {new Date(user.created_at).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => adjustChips(user.id, 10000)}
                                  disabled={actionInProgress !== null}
                                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-green-900/20 text-green-400 border border-green-900/30 hover:bg-green-900/30 transition-colors disabled:opacity-40"
                                  title="Add 10,000 chips"
                                >
                                  {actionInProgress === `chips-${user.id}-10000` ? (
                                    <span className="inline-block w-3 h-3 border border-green-400 border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    "+10k"
                                  )}
                                </button>
                                <button
                                  onClick={() => adjustChips(user.id, -10000)}
                                  disabled={actionInProgress !== null}
                                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-red-900/20 text-red-400 border border-red-900/30 hover:bg-red-900/30 transition-colors disabled:opacity-40"
                                  title="Remove 10,000 chips"
                                >
                                  {actionInProgress === `chips-${user.id}--10000` ? (
                                    <span className="inline-block w-3 h-3 border border-red-400 border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    "-10k"
                                  )}
                                </button>
                                <button
                                  onClick={() =>
                                    toggleAdmin(user.id, user.is_admin)
                                  }
                                  disabled={actionInProgress !== null}
                                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[var(--casino-dark)] text-gray-300 border border-[var(--casino-border)] hover:border-[var(--gold)]/30 hover:text-[var(--gold)] transition-colors disabled:opacity-40"
                                  title={
                                    user.is_admin
                                      ? "Remove admin"
                                      : "Make admin"
                                  }
                                >
                                  {actionInProgress === `admin-${user.id}` ? (
                                    <span className="inline-block w-3 h-3 border border-gray-300 border-t-transparent rounded-full animate-spin" />
                                  ) : user.is_admin ? (
                                    "Demote"
                                  ) : (
                                    "Promote"
                                  )}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* User count footer */}
              {!dataLoading && (
                <div className="px-4 py-3 border-t border-[var(--casino-border)] text-xs text-gray-500">
                  Showing {filteredUsers.length} of {users.length} users
                </div>
              )}
            </div>
          </section>
        )}

        {/* ───── Settings Tab ───── */}
        {activeTab === "settings" && (
          <section className="animate-fade-in">
            <div className="glass rounded-2xl border border-[var(--casino-border)] p-6">
              <h2 className="text-lg font-bold text-white mb-6">
                Game Settings
              </h2>

              {dataLoading || !editSettings ? (
                <div className="space-y-4">
                  {[...Array(4)].map((_, i) => (
                    <SkeletonBar key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : (
                <div className="space-y-8">
                  {/* House Edge */}
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--gold)] uppercase tracking-wider mb-4">
                      House Edge (%)
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {(
                        Object.keys(editSettings.house_edge) as Array<
                          keyof HouseEdges
                        >
                      ).map((game) => (
                        <div key={game}>
                          <label className="block text-xs text-gray-400 mb-1.5 capitalize">
                            {gameTypeLabels[game] || game}
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            value={editSettings.house_edge[game]}
                            onChange={(e) =>
                              setEditSettings({
                                ...editSettings,
                                house_edge: {
                                  ...editSettings.house_edge,
                                  [game]: parseFloat(e.target.value) || 0,
                                },
                              })
                            }
                            className="w-full px-3 py-2.5 rounded-xl bg-[var(--casino-dark)] border border-[var(--casino-border)] text-white text-sm focus:outline-none focus:border-[var(--gold)]/40 transition-colors"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Betting Limits */}
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--gold)] uppercase tracking-wider mb-4">
                      Betting Limits
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1.5">
                          Minimum Bet
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={editSettings.min_bet}
                          onChange={(e) =>
                            setEditSettings({
                              ...editSettings,
                              min_bet: parseInt(e.target.value) || 0,
                            })
                          }
                          className="w-full px-3 py-2.5 rounded-xl bg-[var(--casino-dark)] border border-[var(--casino-border)] text-white text-sm focus:outline-none focus:border-[var(--gold)]/40 transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1.5">
                          Maximum Bet
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={editSettings.max_bet}
                          onChange={(e) =>
                            setEditSettings({
                              ...editSettings,
                              max_bet: parseInt(e.target.value) || 0,
                            })
                          }
                          className="w-full px-3 py-2.5 rounded-xl bg-[var(--casino-dark)] border border-[var(--casino-border)] text-white text-sm focus:outline-none focus:border-[var(--gold)]/40 transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1.5">
                          Daily Bonus
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={editSettings.daily_bonus}
                          onChange={(e) =>
                            setEditSettings({
                              ...editSettings,
                              daily_bonus: parseInt(e.target.value) || 0,
                            })
                          }
                          className="w-full px-3 py-2.5 rounded-xl bg-[var(--casino-dark)] border border-[var(--casino-border)] text-white text-sm focus:outline-none focus:border-[var(--gold)]/40 transition-colors"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Save Button */}
                  <div className="flex items-center gap-4 pt-2">
                    <button
                      onClick={saveSettings}
                      disabled={settingsSaving}
                      className="btn-casino flex items-center gap-2"
                    >
                      {settingsSaving ? (
                        <>
                          <span className="inline-block w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "Save Settings"
                      )}
                    </button>
                    {settingsSaved && (
                      <span className="text-green-400 text-sm font-semibold animate-fade-in flex items-center gap-1.5">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        Settings saved
                      </span>
                    )}
                    {settings && editSettings && (
                      <button
                        onClick={() => setEditSettings(settings)}
                        className="btn-casino-outline text-sm"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ───── Analytics Tab ───── */}
        {activeTab === "analytics" && (
          <section className="animate-fade-in">
            <div className="glass rounded-2xl border border-[var(--casino-border)] overflow-hidden">
              <div className="p-6 border-b border-[var(--casino-border)]">
                <h2 className="text-lg font-bold text-white">
                  Game Analytics
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  Total plays and wagered volume per game type
                </p>
              </div>

              {dataLoading ? (
                <div className="p-6 space-y-3">
                  {[...Array(6)].map((_, i) => (
                    <SkeletonBar key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : analytics.length === 0 ? (
                <div className="p-12 text-center text-gray-500">
                  No game data yet. Analytics will appear once players start
                  playing.
                </div>
              ) : (
                <div className="divide-y divide-[var(--casino-border)]/50">
                  {analytics.map((game) => {
                    const maxPlays = Math.max(
                      ...analytics.map((a) => a.total_plays)
                    );
                    const barWidth =
                      maxPlays > 0
                        ? (game.total_plays / maxPlays) * 100
                        : 0;

                    return (
                      <div
                        key={game.game_type}
                        className="px-6 py-5 hover:bg-white/[0.02] transition-colors"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <span className="text-lg">
                              {game.game_type === "slots"
                                ? "&#9827;"
                                : game.game_type === "dice"
                                ? "&#127922;"
                                : game.game_type === "crash"
                                ? "&#128200;"
                                : game.game_type === "roulette"
                                ? "&#9830;"
                                : game.game_type === "poker"
                                ? "&#9824;"
                                : game.game_type === "blackjack"
                                ? "&#9829;"
                                : "&#127918;"}
                            </span>
                            <span className="font-semibold text-white capitalize">
                              {gameTypeLabels[game.game_type] ||
                                game.game_type}
                            </span>
                          </div>
                          <div className="flex items-center gap-6 text-sm">
                            <div className="text-right">
                              <p className="text-gray-500 text-xs">Plays</p>
                              <p className="font-bold text-white">
                                {game.total_plays.toLocaleString()}
                              </p>
                            </div>
                            <div className="text-right min-w-[100px]">
                              <p className="text-gray-500 text-xs">Wagered</p>
                              <p className="font-bold text-[var(--gold)]">
                                {game.total_wagered.toLocaleString()}
                              </p>
                            </div>
                          </div>
                        </div>
                        {/* Progress bar */}
                        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[var(--gold-dark)] to-[var(--gold)] transition-all duration-500"
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Summary footer */}
              {!dataLoading && analytics.length > 0 && (
                <div className="px-6 py-4 border-t border-[var(--casino-border)] bg-white/[0.01]">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">
                      {analytics.length} game type{analytics.length !== 1 ? "s" : ""} tracked
                    </span>
                    <div className="flex items-center gap-6">
                      <span className="text-gray-400">
                        Total:{" "}
                        <span className="text-white font-semibold">
                          {analytics
                            .reduce((s, a) => s + a.total_plays, 0)
                            .toLocaleString()}{" "}
                          plays
                        </span>
                      </span>
                      <span className="text-gray-400">
                        Volume:{" "}
                        <span className="text-[var(--gold)] font-semibold">
                          {analytics
                            .reduce((s, a) => s + a.total_wagered, 0)
                            .toLocaleString()}{" "}
                          chips
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
