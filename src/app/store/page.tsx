"use client";

import { useChips } from "@/context/ChipContext";
import { useState, useEffect, useCallback } from "react";

const DAILY_BONUS_AMOUNT = 5_000;
const DAILY_BONUS_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const LOCALSTORAGE_KEY = "xcasino_daily_bonus_last_claimed";

const FREE_REFILL_AMOUNT = 10_000;
const FREE_REFILL_THRESHOLD = 1_000;

function getTimeRemainingText(ms: number): string {
  if (ms <= 0) return "Ready!";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

export default function StorePage() {
  const { chips, addChips } = useChips();

  const [bonusCooldownRemaining, setBonusCooldownRemaining] = useState<number>(0);
  const [bonusClaimed, setBonusClaimed] = useState(false);
  const [refillClaimed, setRefillClaimed] = useState(false);
  const [mounted, setMounted] = useState(false);

  const calculateCooldownRemaining = useCallback((): number => {
    if (typeof window === "undefined") return 0;
    const lastClaimed = localStorage.getItem(LOCALSTORAGE_KEY);
    if (!lastClaimed) return 0;
    const elapsed = Date.now() - parseInt(lastClaimed, 10);
    const remaining = DAILY_BONUS_COOLDOWN_MS - elapsed;
    return remaining > 0 ? remaining : 0;
  }, []);

  useEffect(() => {
    setMounted(true);
    setBonusCooldownRemaining(calculateCooldownRemaining());
  }, [calculateCooldownRemaining]);

  useEffect(() => {
    if (!mounted) return;
    const interval = setInterval(() => {
      const remaining = calculateCooldownRemaining();
      setBonusCooldownRemaining(remaining);
      if (remaining <= 0 && bonusClaimed) {
        setBonusClaimed(false);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [mounted, bonusClaimed, calculateCooldownRemaining]);

  const handleClaimDailyBonus = () => {
    if (bonusCooldownRemaining > 0) return;
    addChips(DAILY_BONUS_AMOUNT);
    localStorage.setItem(LOCALSTORAGE_KEY, Date.now().toString());
    setBonusClaimed(true);
    setBonusCooldownRemaining(DAILY_BONUS_COOLDOWN_MS);
  };

  const handleFreeRefill = () => {
    if (chips > FREE_REFILL_THRESHOLD) return;
    addChips(FREE_REFILL_AMOUNT);
    setRefillClaimed(true);
    setTimeout(() => setRefillClaimed(false), 3000);
  };

  const canClaimBonus = mounted && bonusCooldownRemaining <= 0;
  const canRefill = chips <= FREE_REFILL_THRESHOLD;

  return (
    <div className="min-h-screen pb-20">
      {/* Header / Balance Section */}
      <section className="relative overflow-hidden py-16 px-4">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0f0808] via-[var(--casino-darker)] to-transparent" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-80 bg-red-900/8 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-4xl mx-auto text-center animate-fade-in">
          <h1 className="text-4xl md:text-5xl font-black mb-2 tracking-tight">
            <span className="text-[var(--gold)]">Free</span>{" "}
            <span className="text-white">Chips</span>
          </h1>
          <div className="accent-line max-w-xs mx-auto mb-4 mt-2" />
          <p className="text-gray-500 mb-8">
            Grab free chips and get back in the game
          </p>

          <div className="inline-flex items-center gap-4 glass rounded-2xl px-8 py-5 glow-gold-sm">
            <span className="text-4xl animate-chip-bounce">🪙</span>
            <div className="text-left">
              <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold">
                Your Balance
              </p>
              <p className="text-3xl md:text-4xl font-black text-[var(--gold)]">
                {chips.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Free Chips Options */}
      <section className="max-w-3xl mx-auto px-4 mb-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Daily Bonus */}
          <div className="glass rounded-2xl p-8 border border-[var(--gold)]/10 hover:border-[var(--gold)]/25 transition-colors animate-fade-in flex flex-col items-center text-center">
            <div className="text-5xl mb-4 animate-chip-bounce">🎁</div>
            <h3 className="text-xl font-bold text-white mb-2">
              Daily Bonus
            </h3>
            <p className="text-gray-400 text-sm mb-2">
              Claim{" "}
              <span className="text-[var(--gold)] font-bold">
                {DAILY_BONUS_AMOUNT.toLocaleString()}
              </span>{" "}
              free chips every 24 hours
            </p>

            {!canClaimBonus && !bonusClaimed && mounted && (
              <p className="text-xs text-gray-500 font-mono mb-4">
                Next bonus in {getTimeRemainingText(bonusCooldownRemaining)}
              </p>
            )}
            {bonusClaimed && (
              <p className="text-xs text-gray-500 font-mono mb-4">
                Next bonus in {getTimeRemainingText(bonusCooldownRemaining)}
              </p>
            )}
            {canClaimBonus && !bonusClaimed && <div className="mb-4" />}

            <button
              onClick={handleClaimDailyBonus}
              disabled={!canClaimBonus}
              className={`
                w-full px-8 py-3 rounded-xl font-bold text-sm uppercase tracking-wide
                transition-all duration-200
                ${
                  canClaimBonus
                    ? "bg-gradient-to-r from-[var(--gold-dark)] to-[var(--gold)] text-black hover:brightness-110 active:scale-95 shadow-lg"
                    : bonusClaimed
                    ? "bg-green-600 text-white cursor-default"
                    : "bg-gray-700 text-gray-400 cursor-not-allowed"
                }
              `}
            >
              {bonusClaimed ? (
                <span className="flex items-center justify-center gap-2 animate-fade-in">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Claimed!
                </span>
              ) : canClaimBonus ? (
                "Claim Now"
              ) : (
                "Claimed"
              )}
            </button>
          </div>

          {/* Broke? Free Refill */}
          <div className="glass rounded-2xl p-8 border border-red-900/20 hover:border-red-900/40 transition-colors animate-fade-in flex flex-col items-center text-center" style={{ animationDelay: "100ms", animationFillMode: "backwards" }}>
            <div className="text-5xl mb-4">🆘</div>
            <h3 className="text-xl font-bold text-white mb-2">
              Free Refill
            </h3>
            <p className="text-gray-400 text-sm mb-2">
              Running low? Get{" "}
              <span className="text-[var(--gold)] font-bold">
                {FREE_REFILL_AMOUNT.toLocaleString()}
              </span>{" "}
              free chips when your balance drops below{" "}
              <span className="text-white font-semibold">
                {FREE_REFILL_THRESHOLD.toLocaleString()}
              </span>
            </p>

            <p className="text-xs text-gray-500 mb-4">
              {canRefill
                ? "You qualify for a free refill!"
                : `Available when balance is under ${FREE_REFILL_THRESHOLD.toLocaleString()}`}
            </p>

            <button
              onClick={handleFreeRefill}
              disabled={!canRefill}
              className={`
                w-full px-8 py-3 rounded-xl font-bold text-sm uppercase tracking-wide
                transition-all duration-200
                ${
                  refillClaimed
                    ? "bg-green-600 text-white cursor-default"
                    : canRefill
                    ? "bg-gradient-to-r from-[var(--gold-dark)] to-[var(--gold)] text-black hover:brightness-110 active:scale-95 shadow-lg"
                    : "bg-gray-700 text-gray-400 cursor-not-allowed"
                }
              `}
            >
              {refillClaimed ? (
                <span className="flex items-center justify-center gap-2 animate-fade-in">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Refilled!
                </span>
              ) : canRefill ? (
                "Get Free Chips"
              ) : (
                "Not Available Yet"
              )}
            </button>
          </div>
        </div>
      </section>

      {/* Coming Soon */}
      <section className="max-w-3xl mx-auto px-4 mb-16">
        <div className="glass rounded-2xl p-6 border border-[var(--casino-border)] text-center animate-fade-in" style={{ animationDelay: "200ms", animationFillMode: "backwards" }}>
          <p className="text-gray-400 text-sm">
            💰 <span className="text-white font-semibold">Chip packs for purchase</span> coming soon! Stay tuned.
          </p>
        </div>
      </section>

      {/* Disclaimer */}
      <section className="max-w-3xl mx-auto px-4">
        <div className="accent-line-gold mb-8" />
        <div className="pt-4">
          <div className="text-center max-w-2xl mx-auto">
            <p className="text-gray-600 text-sm leading-relaxed">
              All chips in Casino X are virtual and hold no real-world monetary
              value. Chips cannot be redeemed, exchanged, or cashed out for real
              money, goods, or services. Casino X is a free-to-play social casino
              intended for entertainment purposes only. You must be 18 or older
              to play. Please play responsibly.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
