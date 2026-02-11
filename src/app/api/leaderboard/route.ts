import { NextRequest, NextResponse } from "next/server";
import { createServerClient, createAnonClient } from "@/lib/supabase-server";

// GET /api/leaderboard — Get leaderboard data
export async function GET(req: NextRequest) {
  try {
    const supabase = createAnonClient();

    const { searchParams } = new URL(req.url);
    const gameType = searchParams.get("gameType") ?? "all";
    const period = searchParams.get("period") ?? "alltime";
    const metric = searchParams.get("metric") ?? "biggest_win";
    const limit = parseInt(searchParams.get("limit") ?? "10");

    const { data, error } = await supabase
      .from("leaderboard_cache")
      .select("*")
      .eq("game_type", gameType)
      .eq("period", period)
      .eq("metric", metric)
      .order("value", { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data ?? [] });
  } catch (err) {
    console.error("Leaderboard API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/leaderboard — Refresh leaderboard (admin only)
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const supabase = createServerClient(token);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Compute leaderboards from game_history
    const gameTypes = ["all", "slots", "dice", "crash", "roulette", "poker", "blackjack"];
    const periods = ["alltime", "weekly", "monthly"] as const;
    const now = new Date();

    for (const period of periods) {
      let dateFilter: string | null = null;
      if (period === "weekly") {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        dateFilter = weekAgo.toISOString();
      } else if (period === "monthly") {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        dateFilter = monthAgo.toISOString();
      }

      for (const gt of gameTypes) {
        // Biggest win
        let query = supabase
          .from("game_history")
          .select("user_id, payout")
          .order("payout", { ascending: false })
          .limit(10);

        if (gt !== "all") {
          query = query.eq("game_type", gt);
        }
        if (dateFilter) {
          query = query.gte("created_at", dateFilter);
        }

        const { data: topWins } = await query;

        if (topWins) {
          for (const row of topWins) {
            const { data: prof } = await supabase
              .from("profiles")
              .select("username")
              .eq("id", row.user_id)
              .single();

            await supabase.from("leaderboard_cache").upsert(
              {
                user_id: row.user_id,
                username: prof?.username ?? "Unknown",
                game_type: gt,
                period,
                metric: "biggest_win",
                value: row.payout,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "user_id,game_type,period,metric" }
            );
          }
        }
      }
    }

    return NextResponse.json({ success: true, message: "Leaderboard refreshed" });
  } catch (err) {
    console.error("Leaderboard refresh error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
