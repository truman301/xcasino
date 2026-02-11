"use client";

import { Card, SUIT_SYMBOLS, isRed } from "@/lib/cards";

interface PlayingCardProps {
  card: Card;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizes = {
  sm: "w-12 h-18 text-sm",
  md: "w-16 h-24 text-base",
  lg: "w-20 h-30 text-lg",
};

export default function PlayingCard({ card, size = "md", className = "" }: PlayingCardProps) {
  if (!card.faceUp) {
    return (
      <div
        className={`${sizes[size]} rounded-lg border border-[var(--gold)]/20 bg-gradient-to-br from-[#1a0a0a] via-[#0f0f18] to-[#1a0a0a] flex items-center justify-center shadow-lg shadow-black/40 ${className}`}
      >
        <div className="text-lg font-black text-[var(--gold)]/20 select-none">✦</div>
      </div>
    );
  }

  const red = isRed(card.suit);
  const symbol = SUIT_SYMBOLS[card.suit];

  return (
    <div
      className={`${sizes[size]} rounded-lg border border-gray-200 bg-gradient-to-br from-white to-gray-50 flex flex-col justify-between p-1 shadow-lg shadow-black/30 select-none ${className}`}
    >
      <div className={`text-left leading-none font-bold ${red ? "text-red-600" : "text-gray-900"}`}>
        <div className="text-xs">{card.rank}</div>
        <div className="text-xs">{symbol}</div>
      </div>
      <div className={`text-center text-xl ${red ? "text-red-600" : "text-gray-900"}`}>
        {symbol}
      </div>
      <div className={`text-right leading-none font-bold rotate-180 ${red ? "text-red-600" : "text-gray-900"}`}>
        <div className="text-xs">{card.rank}</div>
        <div className="text-xs">{symbol}</div>
      </div>
    </div>
  );
}
