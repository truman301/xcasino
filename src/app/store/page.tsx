"use client";

import { useChips } from "@/context/ChipContext";
import { useState, useEffect, useCallback } from "react";

interface ChipPackage {
  id: string;
  name: string;
  chips: number;
  price: number;
  badge: string | null;
  gradient: string;
  border: string;
  featured: boolean;
}

const PACKAGES: ChipPackage[] = [
  {
    id: "starter",
    name: "Starter Pack",
    chips: 10_000,
    price: 0.99,
    badge: null,
    gradient: "from-slate-800 to-slate-900",
    border: "border-[var(--casino-border)]",
    featured: false,
  },
  {
    id: "popular",
    name: "Popular Pack",
    chips: 55_000,
    price: 4.99,
    badge: "BEST VALUE",
    gradient: "from-yellow-900/40 to-amber-950/60",
    border: "border-[var(--gold)]",
    featured: true,
  },
  {
    id: "highroller",
    name: "High Roller",
    chips: 120_000,
    price: 9.99,
    badge: null,
    gradient: "from-purple-900/40 to-indigo-950/60",
    border: "border-[var(--casino-accent)]",
    featured: false,
  },
  {
    id: "vip",
    name: "VIP Bundle",
    chips: 300_000,
    price: 19.99,
    badge: "VIP",
    gradient: "from-red-900/30 to-rose-950/50",
    border: "border-red-700/60",
    featured: false,
  },
];

const DAILY_BONUS_AMOUNT = 1_000;
const DAILY_BONUS_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const LOCALSTORAGE_KEY = "xcasino_daily_bonus_last_claimed";

function formatChipsPerDollar(chips: number, price: number): string {
  return Math.round(chips / price).toLocaleString();
}

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

  const [purchaseSuccess, setPurchaseSuccess] = useState<string | null>(null);
  const [purchaseAnimating, setPurchaseAnimating] = useState<string | null>(null);

  const [bonusCooldownRemaining, setBonusCooldownRemaining] = useState<number>(0);
  const [bonusClaimed, setBonusClaimed] = useState(false);
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

  const handlePurchase = (pkg: ChipPackage) => {
    setPurchaseAnimating(pkg.id);
    setTimeout(() => {
      addChips(pkg.chips);
      setPurchaseAnimating(null);
      setPurchaseSuccess(pkg.id);
      setTimeout(() => {
        setPurchaseSuccess(null);
      }, 2500);
    }, 600);
  };

  const handleClaimDailyBonus = () => {
    if (bonusCooldownRemaining > 0) return;
    addChips(DAILY_BONUS_AMOUNT);
    localStorage.setItem(LOCALSTORAGE_KEY, Date.now().toString());
    setBonusClaimed(true);
    setBonusCooldownRemaining(DAILY_BONUS_COOLDOWN_MS);
  };

  const canClaimBonus = mounted && bonusCooldownRemaining <= 0;

  return (
    <div className="min-h-screen pb-20">
      {/* Header / Balance Section */}
      <section className="relative overflow-hidden py-16 px-4">
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--casino-card)] to-transparent" />
        <div className="relative max-w-4xl mx-auto text-center animate-fade-in">
          <h1 className="text-4xl md:text-5xl font-black mb-2 tracking-tight">
            <span className="text-[var(--gold)]">Chip</span>{" "}
            <span className="text-white">Store</span>
          </h1>
          <p className="text-gray-400 mb-8">
            Stock up on chips and get back in the game
          </p>

          <div className="inline-flex items-center gap-4 glass rounded-2xl px-8 py-5 glow-gold">
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

      {/* Chip Packages */}
      <section className="max-w-5xl mx-auto px-4 mb-16">
        <h2 className="text-2xl font-bold mb-6 text-white">
          Choose a Package
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {PACKAGES.map((pkg, index) => {
            const isSuccess = purchaseSuccess === pkg.id;
            const isAnimating = purchaseAnimating === pkg.id;

            return (
              <div
                key={pkg.id}
                className={`
                  relative flex flex-col rounded-2xl border-2 p-6
                  bg-gradient-to-br ${pkg.gradient}
                  ${pkg.border}
                  transition-all duration-300
                  hover:scale-[1.03] hover:-translate-y-1
                  ${pkg.featured ? "glow-gold animate-pulse-gold" : ""}
                  animate-fade-in
                `}
                style={{ animationDelay: `${index * 100}ms`, animationFillMode: "backwards" }}
              >
                {/* Badge */}
                {pkg.badge && (
                  <div
                    className={`
                      absolute -top-3 left-1/2 -translate-x-1/2
                      px-4 py-1 rounded-full text-xs font-black uppercase tracking-wider
                      ${
                        pkg.badge === "BEST VALUE"
                          ? "bg-[var(--gold)] text-black"
                          : "bg-gradient-to-r from-red-600 to-red-500 text-white"
                      }
                    `}
                  >
                    {pkg.badge}
                  </div>
                )}

                {/* Package Name */}
                <h3
                  className={`text-lg font-bold mb-4 mt-1 ${
                    pkg.featured ? "text-[var(--gold-light)]" : "text-white"
                  }`}
                >
                  {pkg.name}
                </h3>

                {/* Chip Amount */}
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-3xl">🪙</span>
                  <span
                    className={`text-3xl font-black ${
                      pkg.featured ? "text-[var(--gold)]" : "text-white"
                    }`}
                  >
                    {pkg.chips.toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mb-4">chips</p>

                {/* Price */}
                <div className="mb-2">
                  <span className="text-2xl font-black text-white">
                    ${pkg.price.toFixed(2)}
                  </span>
                </div>

                {/* Chips per dollar */}
                <p className="text-xs text-gray-400 mb-6">
                  {formatChipsPerDollar(pkg.chips, pkg.price)} chips per dollar
                </p>

                {/* Spacer to push button to bottom */}
                <div className="mt-auto">
                  {/* Buy Button */}
                  <button
                    onClick={() => handlePurchase(pkg)}
                    disabled={isAnimating || isSuccess}
                    className={`
                      w-full py-3 rounded-xl font-bold text-sm uppercase tracking-wide
                      transition-all duration-200
                      ${
                        isSuccess
                          ? "bg-green-600 text-white cursor-default"
                          : isAnimating
                          ? "bg-gray-700 text-gray-400 cursor-wait"
                          : pkg.featured
                          ? "bg-[var(--gold)] text-black hover:bg-[var(--gold-light)] active:scale-95 btn-casino"
                          : "bg-white/10 text-white hover:bg-white/20 active:scale-95 btn-casino"
                      }
                    `}
                  >
                    {isSuccess ? (
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
                        Added!
                      </span>
                    ) : isAnimating ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg
                          className="animate-spin w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                          />
                        </svg>
                        Processing...
                      </span>
                    ) : (
                      "Buy Now"
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Daily Free Bonus Section */}
      <section className="max-w-5xl mx-auto px-4 mb-16">
        <div className="glass rounded-2xl p-8 border border-[var(--casino-border)] animate-fade-in">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="text-5xl animate-chip-bounce">🎁</div>
              <div>
                <h3 className="text-xl font-bold text-white mb-1">
                  Daily Free Chips
                </h3>
                <p className="text-gray-400 text-sm">
                  Claim{" "}
                  <span className="text-[var(--gold)] font-bold">
                    {DAILY_BONUS_AMOUNT.toLocaleString()}
                  </span>{" "}
                  free chips every 24 hours
                </p>
              </div>
            </div>

            <div className="flex flex-col items-center gap-2">
              <button
                onClick={handleClaimDailyBonus}
                disabled={!canClaimBonus}
                className={`
                  px-8 py-3 rounded-xl font-bold text-sm uppercase tracking-wide
                  transition-all duration-200
                  ${
                    canClaimBonus
                      ? "bg-[var(--gold)] text-black hover:bg-[var(--gold-light)] active:scale-95 animate-pulse-gold btn-casino"
                      : bonusClaimed
                      ? "bg-green-600 text-white cursor-default"
                      : "bg-gray-700 text-gray-400 cursor-not-allowed"
                  }
                `}
              >
                {bonusClaimed ? (
                  <span className="flex items-center gap-2 animate-fade-in">
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
              {!canClaimBonus && !bonusClaimed && mounted && (
                <p className="text-xs text-gray-500 font-mono">
                  Next bonus in {getTimeRemainingText(bonusCooldownRemaining)}
                </p>
              )}
              {bonusClaimed && (
                <p className="text-xs text-gray-500 font-mono">
                  Next bonus in {getTimeRemainingText(bonusCooldownRemaining)}
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Disclaimer */}
      <section className="max-w-5xl mx-auto px-4">
        <div className="border-t border-[var(--casino-border)] pt-8">
          <div className="text-center max-w-2xl mx-auto">
            <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Important Information
            </h4>
            <p className="text-gray-500 text-sm leading-relaxed">
              All chips in XCasino are virtual and hold no real-world monetary
              value. Chips cannot be redeemed, exchanged, or cashed out for real
              money, goods, or services. Purchases are final and non-refundable.
              XCasino is a free-to-play social casino intended for entertainment
              purposes only. You must be 18 or older to play. Please play
              responsibly.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
