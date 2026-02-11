"use client";

import Link from "next/link";
import { useChips } from "@/context/ChipContext";

const games = [
  {
    name: "Texas Hold'em",
    href: "/poker",
    icon: "♠",
    description: "The king of card games. Play against AI or real players.",
    accent: "from-[#1a0a0a] to-[#0f0f18]",
    border: "border-red-900/40",
    hoverBorder: "hover:border-[var(--gold)]/50",
    iconColor: "text-red-500",
    players: "2-8 Players",
    hot: true,
  },
  {
    name: "Blackjack",
    href: "/blackjack",
    icon: "♥",
    description: "Beat the dealer. Get 21 or as close as you can.",
    accent: "from-[#1a0808] to-[#0f0f18]",
    border: "border-red-900/30",
    hoverBorder: "hover:border-[var(--gold)]/50",
    iconColor: "text-red-600",
    players: "vs Dealer",
    hot: false,
  },
  {
    name: "Roulette",
    href: "/roulette",
    icon: "♦",
    description: "Spin the wheel. Bet on numbers, colors, or ranges.",
    accent: "from-[#180e05] to-[#0f0f18]",
    border: "border-amber-900/30",
    hoverBorder: "hover:border-[var(--gold)]/50",
    iconColor: "text-[var(--gold)]",
    players: "Multiplayer",
    hot: false,
  },
  {
    name: "Slots",
    href: "/slots",
    icon: "♣",
    description: "Pull the lever and try your luck on the reels.",
    accent: "from-[#150a0a] to-[#0f0f18]",
    border: "border-red-900/30",
    hoverBorder: "hover:border-[var(--gold)]/50",
    iconColor: "text-red-400",
    players: "Solo",
    hot: true,
  },
  {
    name: "Dice",
    href: "/dice",
    icon: "🎲",
    description: "Roll over or under. Set your odds and win big.",
    accent: "from-[#0a1a0a] to-[#0f0f18]",
    border: "border-green-900/30",
    hoverBorder: "hover:border-[var(--gold)]/50",
    iconColor: "text-green-400",
    players: "Solo",
    hot: false,
  },
  {
    name: "Crash",
    href: "/crash",
    icon: "📈",
    description: "Cash out before the multiplier crashes!",
    accent: "from-[#1a1005] to-[#0f0f18]",
    border: "border-amber-900/30",
    hoverBorder: "hover:border-[var(--gold)]/50",
    iconColor: "text-[var(--gold)]",
    players: "Solo",
    hot: true,
  },
];

export default function Home() {
  const { chips } = useChips();

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden py-24 px-4">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0f0808] via-[var(--casino-darker)] to-transparent" />
        {/* Decorative glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-red-900/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-64 h-64 bg-amber-900/8 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-5xl mx-auto text-center">
          <div className="divider-suits mb-6 text-xs tracking-[0.3em] text-[var(--gold)]/20">
            ♠ ♥ ♦ ♣
          </div>
          <h1 className="text-6xl md:text-8xl font-black mb-3 tracking-tight">
            <span className="text-white">Casino</span>{" "}
            <span className="text-[var(--gold)] drop-shadow-[0_0_30px_rgba(212,175,55,0.3)]">X</span>
          </h1>
          <div className="accent-line max-w-xs mx-auto mb-6" />
          <p className="text-lg text-gray-400 mb-1 tracking-wide">
            Free social casino — no real money gambling
          </p>
          <p className="text-sm text-gray-600 mb-10">
            Play poker, blackjack, roulette & slots with friends
          </p>

          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="glass rounded-full px-6 py-3 flex items-center gap-3 glow-gold-sm">
              <span className="text-2xl">🪙</span>
              <span className="text-2xl font-bold text-[var(--gold)]">{chips.toLocaleString()}</span>
              <span className="text-sm text-gray-500">chips</span>
            </div>
            <Link href="/store" className="btn-casino text-lg px-6 py-3">
              Free Chips
            </Link>
          </div>
        </div>
      </section>

      {/* Games Grid */}
      <section className="max-w-5xl mx-auto px-4 pb-20">
        <div className="flex items-center gap-4 mb-8">
          <h2 className="text-2xl font-bold text-white">Choose Your Game</h2>
          <div className="flex-1 accent-line-gold" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {games.map((game, i) => (
            <Link key={game.name} href={game.href}>
              <div
                className={`relative bg-gradient-to-br ${game.accent} border ${game.border} ${game.hoverBorder} rounded-2xl p-7 hover:scale-[1.02] transition-all duration-300 cursor-pointer group overflow-hidden`}
                style={{ animationDelay: `${i * 80}ms` }}
              >
                {/* Subtle corner glow */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-red-900/10 to-transparent rounded-bl-full pointer-events-none" />

                {game.hot && (
                  <span className="absolute top-4 right-4 bg-gradient-to-r from-red-600 to-red-500 text-white text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full shadow-lg shadow-red-900/30">
                    Hot
                  </span>
                )}
                <div className={`text-4xl mb-4 ${game.iconColor} opacity-80 group-hover:opacity-100 transition-opacity`}>
                  {game.icon}
                </div>
                <h3 className="text-xl font-bold text-white mb-1.5 group-hover:text-[var(--gold)] transition-colors">
                  {game.name}
                </h3>
                <p className="text-sm text-gray-400 mb-4">{game.description}</p>
                <span className="text-[11px] text-gray-500 bg-white/[0.03] border border-white/[0.05] rounded-full px-3 py-1">
                  {game.players}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Bottom */}
      <div className="divider-suits text-xs">♠ ♥ ♦ ♣</div>
      <section className="border-t border-[var(--casino-border)] py-12 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-gray-600 text-sm">
            Casino X is a free-to-play social casino. Virtual chips have no real-world monetary value and cannot be redeemed for cash.
            You must be 18 or older to play. Play responsibly.
          </p>
        </div>
      </section>
    </div>
  );
}
