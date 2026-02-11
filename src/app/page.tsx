"use client";

import Link from "next/link";
import { useChips } from "@/context/ChipContext";

const games = [
  {
    name: "Texas Hold'em",
    href: "/poker",
    emoji: "🃏",
    description: "The king of card games. Play against AI or real players.",
    gradient: "from-green-900 to-green-800",
    border: "border-green-700",
    players: "2-8 Players",
    hot: true,
  },
  {
    name: "Blackjack",
    href: "/blackjack",
    emoji: "🂡",
    description: "Beat the dealer. Get 21 or as close as you can.",
    gradient: "from-red-900 to-red-800",
    border: "border-red-700",
    players: "vs Dealer",
    hot: false,
  },
  {
    name: "Roulette",
    href: "/roulette",
    emoji: "🎰",
    description: "Spin the wheel. Bet on numbers, colors, or ranges.",
    gradient: "from-amber-900 to-amber-800",
    border: "border-amber-700",
    players: "Multiplayer",
    hot: false,
  },
  {
    name: "Slots",
    href: "/slots",
    emoji: "🍒",
    description: "Pull the lever and try your luck on the reels.",
    gradient: "from-purple-900 to-purple-800",
    border: "border-purple-700",
    players: "Solo",
    hot: true,
  },
];

export default function Home() {
  const { chips } = useChips();

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden py-20 px-4">
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--casino-card)] to-transparent" />
        <div className="relative max-w-5xl mx-auto text-center">
          <h1 className="text-5xl md:text-7xl font-black mb-4 tracking-tight">
            <span className="text-[var(--gold)]">X</span>
            <span className="text-white">Casino</span>
          </h1>
          <p className="text-xl text-gray-400 mb-2">
            Free social casino — no real money gambling
          </p>
          <p className="text-sm text-gray-500 mb-8">
            Play poker, blackjack, roulette & slots with friends
          </p>

          <div className="flex items-center justify-center gap-3 mb-12">
            <div className="glass rounded-full px-6 py-3 flex items-center gap-3">
              <span className="text-2xl">🪙</span>
              <span className="text-2xl font-bold text-[var(--gold)]">{chips.toLocaleString()}</span>
              <span className="text-sm text-gray-400">chips</span>
            </div>
            <Link href="/store" className="btn-casino text-lg px-6 py-3">
              Get More Chips
            </Link>
          </div>
        </div>
      </section>

      {/* Games Grid */}
      <section className="max-w-5xl mx-auto px-4 pb-20">
        <h2 className="text-2xl font-bold mb-6">Choose Your Game</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {games.map((game) => (
            <Link key={game.name} href={game.href}>
              <div
                className={`relative bg-gradient-to-br ${game.gradient} border ${game.border} rounded-2xl p-6 hover:scale-[1.02] transition-all duration-200 cursor-pointer group overflow-hidden`}
              >
                {game.hot && (
                  <span className="absolute top-3 right-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                    HOT
                  </span>
                )}
                <div className="text-5xl mb-4">{game.emoji}</div>
                <h3 className="text-xl font-bold text-white mb-1 group-hover:text-[var(--gold)] transition-colors">
                  {game.name}
                </h3>
                <p className="text-sm text-gray-300 mb-3">{game.description}</p>
                <span className="text-xs text-gray-400 bg-black/20 rounded-full px-3 py-1">
                  {game.players}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Bottom Banner */}
      <section className="border-t border-[var(--casino-border)] py-12 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-gray-500 text-sm">
            XCasino is a free-to-play social casino. Virtual chips have no real-world monetary value and cannot be redeemed for cash.
            You must be 18 or older to play. Play responsibly.
          </p>
        </div>
      </section>
    </div>
  );
}
