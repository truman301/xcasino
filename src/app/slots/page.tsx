"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useChips } from "@/context/ChipContext";

const SYMBOLS = ["🍒", "🍋", "🍊", "🍇", "🔔", "💎", "7️⃣", "⭐"] as const;
type Symbol = (typeof SYMBOLS)[number];

const BET_AMOUNTS = [100, 500, 1000, 5000] as const;

const PAYOUTS: Record<Symbol, number> = {
  "7️⃣": 50,
  "⭐": 25,
  "💎": 15,
  "🔔": 10,
  "🍇": 8,
  "🍊": 5,
  "🍋": 3,
  "🍒": 2,
};

interface SpinResult {
  reels: [Symbol, Symbol, Symbol];
  bet: number;
  payout: number;
  multiplier: number;
  timestamp: number;
}

function getRandomSymbol(): Symbol {
  return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
}

function calculatePayout(
  reels: [Symbol, Symbol, Symbol],
  bet: number
): { payout: number; multiplier: number } {
  const [a, b, c] = reels;

  if (a === b && b === c) {
    const multiplier = PAYOUTS[a];
    return { payout: bet * multiplier, multiplier };
  }

  if (a === b || b === c || a === c) {
    return { payout: bet, multiplier: 1 };
  }

  return { payout: 0, multiplier: 0 };
}

function getResultLabel(
  reels: [Symbol, Symbol, Symbol],
  multiplier: number
): string {
  if (multiplier >= 50) return "JACKPOT!!!";
  if (multiplier >= 25) return "MEGA WIN!";
  if (multiplier >= 15) return "BIG WIN!";
  if (multiplier >= 8) return "GREAT WIN!";
  if (multiplier >= 3) return "NICE WIN!";
  if (multiplier >= 2) return "WIN!";
  if (multiplier === 1) return "PUSH";
  return "";
}

const SPIN_STRIPS: Symbol[][] = Array.from({ length: 3 }, () => {
  const strip: Symbol[] = [];
  for (let i = 0; i < 40; i++) {
    strip.push(SYMBOLS[i % SYMBOLS.length]);
  }
  for (let i = strip.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [strip[i], strip[j]] = [strip[j], strip[i]];
  }
  return strip;
});

export default function SlotsPage() {
  const { chips, addChips, removeChips } = useChips();

  const [bet, setBet] = useState<number>(100);
  const [reels, setReels] = useState<[Symbol, Symbol, Symbol]>(["🍒", "💎", "7️⃣"]);
  const [spinning, setSpinning] = useState(false);
  const [reelsStopped, setReelsStopped] = useState([true, true, true]);
  const [lastResult, setLastResult] = useState<{
    payout: number;
    multiplier: number;
  } | null>(null);
  const [history, setHistory] = useState<SpinResult[]>([]);
  const [autoSpin, setAutoSpin] = useState(false);
  const [jackpotCelebration, setJackpotCelebration] = useState(false);
  const [winAnimation, setWinAnimation] = useState(false);
  const [message, setMessage] = useState("");
  const [holdSpinning, setHoldSpinning] = useState(false);

  const autoSpinRef = useRef(autoSpin);
  const spinningRef = useRef(spinning);
  const holdIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const holdSpinActiveRef = useRef(false);
  const animFrameRefs = useRef<number[]>([]);
  const reelContainerRefs = useRef<(HTMLDivElement | null)[]>([null, null, null]);

  useEffect(() => {
    autoSpinRef.current = autoSpin;
  }, [autoSpin]);

  useEffect(() => {
    spinningRef.current = spinning;
  }, [spinning]);

  const doSpin = useCallback(() => {
    if (spinningRef.current) return;

    if (chips < bet) {
      setMessage("Not enough chips!");
      setAutoSpin(false);
      return;
    }

    const betPlaced = removeChips(bet);
    if (!betPlaced) {
      setMessage("Not enough chips!");
      setAutoSpin(false);
      return;
    }

    setSpinning(true);
    setLastResult(null);
    setMessage("");
    setWinAnimation(false);
    setJackpotCelebration(false);
    setReelsStopped([false, false, false]);

    const finalReels: [Symbol, Symbol, Symbol] = [
      getRandomSymbol(),
      getRandomSymbol(),
      getRandomSymbol(),
    ];

    animFrameRefs.current.forEach(cancelAnimationFrame);
    animFrameRefs.current = [];

    const spinDurations = [1200, 1700, 2200];

    for (let reelIndex = 0; reelIndex < 3; reelIndex++) {
      const container = reelContainerRefs.current[reelIndex];
      if (!container) continue;

      const duration = spinDurations[reelIndex];
      const startTime = performance.now();
      const symbolHeight = 80;
      const strip = SPIN_STRIPS[reelIndex];
      const totalSymbols = strip.length;

      const animate = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);

        const eased =
          progress < 0.8
            ? progress / 0.8
            : 1 - Math.pow(1 - (progress - 0.8) / 0.2, 3) * 0.0 + 1;

        const speed = progress < 0.8 ? 1 : 1 - Math.pow((progress - 0.8) / 0.2, 2);

        const offset =
          ((elapsed * 0.5 * (0.3 + speed * 0.7)) % (totalSymbols * symbolHeight));

        container.style.transform = `translateY(-${offset}px)`;

        if (progress < 1) {
          animFrameRefs.current[reelIndex] = requestAnimationFrame(animate);
        } else {
          container.style.transform = `translateY(0px)`;
          container.style.transition = "transform 0.15s ease-out";
          setTimeout(() => {
            if (container) container.style.transition = "";
          }, 200);

          setReels((prev) => {
            const next = [...prev] as [Symbol, Symbol, Symbol];
            next[reelIndex] = finalReels[reelIndex];
            return next;
          });
          setReelsStopped((prev) => {
            const next = [...prev];
            next[reelIndex] = true;
            return next;
          });

          if (reelIndex === 2) {
            const { payout, multiplier } = calculatePayout(finalReels, bet);

            setTimeout(() => {
              setLastResult({ payout, multiplier });

              if (payout > 0) {
                addChips(payout);
                const label = getResultLabel(finalReels, multiplier);
                setMessage(`${label} +${payout.toLocaleString()} chips!`);
                setWinAnimation(true);

                if (multiplier >= 15) {
                  setJackpotCelebration(true);
                  setTimeout(() => setJackpotCelebration(false), 4000);
                }
                setTimeout(() => setWinAnimation(false), 2500);
              } else {
                setMessage("No match. Try again!");
              }

              const result: SpinResult = {
                reels: finalReels,
                bet,
                payout,
                multiplier,
                timestamp: Date.now(),
              };
              setHistory((prev) => [result, ...prev].slice(0, 5));

              setSpinning(false);

              if (autoSpinRef.current) {
                setTimeout(() => {
                  if (autoSpinRef.current) {
                    doSpin();
                  }
                }, 1500);
              }
            }, 200);
          }
        }
      };

      animFrameRefs.current[reelIndex] = requestAnimationFrame(animate);
    }
  }, [bet, chips, removeChips, addChips]);

  useEffect(() => {
    if (autoSpin && !spinning) {
      const timer = setTimeout(() => {
        doSpin();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [autoSpin]);

  const handleHoldStart = useCallback(() => {
    if (holdSpinActiveRef.current) return;
    holdSpinActiveRef.current = true;
    setHoldSpinning(true);
    doSpin();
    holdIntervalRef.current = setInterval(() => {
      if (!spinningRef.current && holdSpinActiveRef.current) {
        doSpin();
      }
    }, 2800);
  }, [doSpin]);

  const handleHoldEnd = useCallback(() => {
    holdSpinActiveRef.current = false;
    setHoldSpinning(false);
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
      animFrameRefs.current.forEach(cancelAnimationFrame);
    };
  }, []);

  const renderReelStrip = (reelIndex: number) => {
    const strip = SPIN_STRIPS[reelIndex];
    const currentSymbol = reels[reelIndex];
    const isStopped = reelsStopped[reelIndex];

    if (isStopped) {
      return (
        <div className="flex flex-col items-center justify-center h-full">
          <div
            className="text-5xl md:text-6xl leading-none select-none transition-transform duration-150"
            style={{ filter: "drop-shadow(0 0 8px rgba(212,175,55,0.3))" }}
          >
            {currentSymbol}
          </div>
        </div>
      );
    }

    return (
      <div
        ref={(el) => {
          reelContainerRefs.current[reelIndex] = el;
        }}
        className="flex flex-col items-center"
        style={{ willChange: "transform" }}
      >
        {strip.map((sym, i) => (
          <div
            key={`${reelIndex}-${i}`}
            className="h-[80px] flex items-center justify-center text-5xl md:text-6xl select-none"
            style={{ filter: "drop-shadow(0 0 4px rgba(212,175,55,0.15))" }}
          >
            {sym}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen pb-20 relative overflow-hidden">
      {/* Jackpot celebration overlay */}
      {jackpotCelebration && (
        <div className="fixed inset-0 z-50 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-b from-yellow-500/10 via-transparent to-yellow-500/10 animate-pulse" />
          {Array.from({ length: 30 }).map((_, i) => (
            <div
              key={i}
              className="absolute text-2xl md:text-4xl animate-bounce"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${1 + Math.random() * 2}s`,
              }}
            >
              {["🪙", "💰", "✨", "🎉", "⭐"][Math.floor(Math.random() * 5)]}
            </div>
          ))}
        </div>
      )}

      {/* Background glow effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-purple-900/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-[var(--casino-accent)]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-4xl mx-auto px-4 pt-8">
        {/* Header */}
        <div className="text-center mb-8 animate-fade-in">
          <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-2">
            <span className="text-[var(--gold)]">🎰</span>{" "}
            <span
              className="bg-gradient-to-r from-[var(--gold)] via-[var(--gold-light)] to-[var(--gold)] bg-clip-text text-transparent"
            >
              MEGA SLOTS
            </span>{" "}
            <span className="text-[var(--gold)]">🎰</span>
          </h1>
          <p className="text-gray-400 text-sm">
            Match three to win big. Jackpot pays 50x!
          </p>
        </div>

        {/* Chip balance */}
        <div className="flex justify-center mb-6">
          <div className="glass rounded-full px-6 py-2 flex items-center gap-3 glow-gold">
            <span className="text-xl">🪙</span>
            <span className="text-xl font-bold text-[var(--gold)]">
              {chips.toLocaleString()}
            </span>
            <span className="text-xs text-gray-400">chips</span>
          </div>
        </div>

        {/* Slot Machine Frame */}
        <div className="animate-fade-in">
          <div
            className="relative mx-auto max-w-lg rounded-2xl overflow-hidden"
            style={{
              background:
                "linear-gradient(145deg, #2a1f4e 0%, #1a1040 40%, #0f0a25 100%)",
              border: "2px solid transparent",
              borderImage:
                "linear-gradient(180deg, var(--gold) 0%, var(--gold-dark, #8a6f1a) 50%, var(--gold) 100%) 1",
            }}
          >
            {/* Top metallic bar */}
            <div
              className="h-3"
              style={{
                background:
                  "linear-gradient(180deg, #d4af37 0%, #f0d060 30%, #d4af37 50%, #8a6f1a 80%, #d4af37 100%)",
              }}
            />

            {/* Machine inner body */}
            <div className="p-4 md:p-6">
              {/* Pay label */}
              <div className="text-center mb-4">
                <div
                  className="inline-block px-4 py-1 rounded-full text-xs font-bold tracking-widest"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(212,175,55,0.2), rgba(212,175,55,0.05))",
                    border: "1px solid rgba(212,175,55,0.3)",
                    color: "var(--gold)",
                  }}
                >
                  TRIPLE 7 PAYS 50x
                </div>
              </div>

              {/* Reels display area */}
              <div
                className="relative rounded-xl overflow-hidden mb-4"
                style={{
                  background:
                    "linear-gradient(180deg, #0a0818 0%, #12101f 50%, #0a0818 100%)",
                  border: "3px solid #2a2550",
                  boxShadow:
                    "inset 0 0 30px rgba(0,0,0,0.8), 0 0 15px rgba(139,92,246,0.1)",
                }}
              >
                {/* Top shadow gradient */}
                <div
                  className="absolute top-0 left-0 right-0 h-8 z-10 pointer-events-none"
                  style={{
                    background:
                      "linear-gradient(to bottom, rgba(10,8,24,0.9), transparent)",
                  }}
                />
                {/* Bottom shadow gradient */}
                <div
                  className="absolute bottom-0 left-0 right-0 h-8 z-10 pointer-events-none"
                  style={{
                    background:
                      "linear-gradient(to top, rgba(10,8,24,0.9), transparent)",
                  }}
                />

                {/* Reel windows */}
                <div className="flex items-stretch divide-x divide-[#2a2550]">
                  {[0, 1, 2].map((reelIndex) => (
                    <div
                      key={reelIndex}
                      className="flex-1 h-[100px] md:h-[120px] overflow-hidden relative flex items-center justify-center"
                      style={{
                        background: reelsStopped[reelIndex]
                          ? "radial-gradient(ellipse at center, rgba(139,92,246,0.06) 0%, transparent 70%)"
                          : "radial-gradient(ellipse at center, rgba(139,92,246,0.12) 0%, transparent 70%)",
                      }}
                    >
                      {renderReelStrip(reelIndex)}

                      {/* Reel stopped glow */}
                      {reelsStopped[reelIndex] &&
                        lastResult &&
                        lastResult.multiplier > 0 && (
                          <div
                            className="absolute inset-0 pointer-events-none animate-pulse"
                            style={{
                              boxShadow:
                                lastResult.multiplier >= 15
                                  ? "inset 0 0 30px rgba(212,175,55,0.3)"
                                  : "inset 0 0 20px rgba(139,92,246,0.2)",
                            }}
                          />
                        )}
                    </div>
                  ))}
                </div>

                {/* Center payline indicator */}
                <div
                  className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[2px] pointer-events-none z-20"
                  style={{
                    background:
                      "linear-gradient(90deg, transparent, var(--gold), var(--gold), transparent)",
                    opacity: 0.5,
                  }}
                />
                {/* Left arrow */}
                <div
                  className="absolute left-1 top-1/2 -translate-y-1/2 z-20 pointer-events-none"
                  style={{
                    width: 0,
                    height: 0,
                    borderTop: "6px solid transparent",
                    borderBottom: "6px solid transparent",
                    borderLeft: "8px solid var(--gold)",
                    opacity: 0.7,
                  }}
                />
                {/* Right arrow */}
                <div
                  className="absolute right-1 top-1/2 -translate-y-1/2 z-20 pointer-events-none"
                  style={{
                    width: 0,
                    height: 0,
                    borderTop: "6px solid transparent",
                    borderBottom: "6px solid transparent",
                    borderRight: "8px solid var(--gold)",
                    opacity: 0.7,
                  }}
                />
              </div>

              {/* Win message */}
              <div className="h-10 flex items-center justify-center mb-3">
                {message && (
                  <div
                    className={`text-center font-bold text-lg tracking-wide transition-all duration-300 ${
                      winAnimation
                        ? lastResult && lastResult.multiplier >= 15
                          ? "text-[var(--gold)] animate-pulse-gold scale-110"
                          : "text-green-400"
                        : lastResult && lastResult.payout === 0
                          ? "text-gray-500"
                          : "text-[var(--gold)]"
                    }`}
                    style={
                      winAnimation && lastResult && lastResult.multiplier >= 15
                        ? {
                            textShadow:
                              "0 0 20px rgba(212,175,55,0.6), 0 0 40px rgba(212,175,55,0.3)",
                          }
                        : winAnimation
                          ? {
                              textShadow: "0 0 10px rgba(74,222,128,0.4)",
                            }
                          : {}
                    }
                  >
                    {message}
                  </div>
                )}
              </div>

              {/* Bet selector */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">
                    Bet Amount
                  </span>
                  <span className="text-xs text-gray-500">
                    Current: {bet.toLocaleString()} chips
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {BET_AMOUNTS.map((amount) => (
                    <button
                      key={amount}
                      onClick={() => !spinning && setBet(amount)}
                      disabled={spinning}
                      className={`relative py-2.5 rounded-lg text-sm font-bold transition-all duration-200 ${
                        bet === amount
                          ? "text-[var(--casino-darker)] shadow-lg"
                          : "text-gray-300 hover:text-white border border-[var(--casino-border)] hover:border-[var(--gold)]/50"
                      } ${spinning ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                      style={
                        bet === amount
                          ? {
                              background:
                                "linear-gradient(135deg, var(--gold) 0%, var(--gold-light) 50%, var(--gold) 100%)",
                              boxShadow: "0 0 15px rgba(212,175,55,0.3)",
                            }
                          : {
                              background: "rgba(18,18,31,0.6)",
                            }
                      }
                    >
                      {amount >= 1000
                        ? `${(amount / 1000).toFixed(0)}K`
                        : amount.toLocaleString()}
                      {bet === amount && (
                        <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Spin controls */}
              <div className="flex gap-3">
                {/* Main spin button */}
                <button
                  onClick={doSpin}
                  disabled={spinning || autoSpin}
                  className={`btn-casino flex-1 py-4 text-lg font-black tracking-wider rounded-xl transition-all duration-200 ${
                    spinning || autoSpin
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:scale-[1.02] active:scale-[0.98]"
                  }`}
                  style={{
                    background: spinning
                      ? "linear-gradient(135deg, #4a3a6a, #3a2a5a)"
                      : "linear-gradient(135deg, var(--gold) 0%, var(--gold-light) 50%, var(--gold) 100%)",
                    color: spinning ? "#888" : "var(--casino-darker)",
                    boxShadow: spinning
                      ? "none"
                      : "0 4px 20px rgba(212,175,55,0.4), 0 0 40px rgba(212,175,55,0.1)",
                    border: "none",
                  }}
                >
                  {spinning ? "SPINNING..." : "🎰 SPIN"}
                </button>

                {/* Auto-spin toggle */}
                <button
                  onClick={() => {
                    if (autoSpin) {
                      setAutoSpin(false);
                    } else {
                      setAutoSpin(true);
                    }
                  }}
                  disabled={spinning && !autoSpin}
                  className={`px-4 py-4 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-200 border ${
                    autoSpin
                      ? "border-green-500 text-green-400"
                      : "border-[var(--casino-border)] text-gray-400 hover:text-white hover:border-[var(--gold)]/50"
                  } ${spinning && !autoSpin ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                  style={{
                    background: autoSpin
                      ? "rgba(34,197,94,0.1)"
                      : "rgba(18,18,31,0.6)",
                  }}
                >
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-base">🔄</span>
                    <span>{autoSpin ? "STOP" : "AUTO"}</span>
                  </div>
                </button>
              </div>

              {/* Hold-to-spin */}
              <div className="mt-3">
                <button
                  onMouseDown={handleHoldStart}
                  onMouseUp={handleHoldEnd}
                  onMouseLeave={handleHoldEnd}
                  onTouchStart={handleHoldStart}
                  onTouchEnd={handleHoldEnd}
                  disabled={autoSpin}
                  className={`w-full py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all duration-200 border ${
                    holdSpinning
                      ? "border-[var(--gold)] text-[var(--gold)]"
                      : "border-[var(--casino-border)] text-gray-500 hover:text-gray-300 hover:border-gray-600"
                  } ${autoSpin ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}`}
                  style={{
                    background: holdSpinning
                      ? "rgba(212,175,55,0.08)"
                      : "rgba(18,18,31,0.4)",
                  }}
                >
                  {holdSpinning
                    ? "⚡ RAPID SPINNING... RELEASE TO STOP"
                    : "HOLD TO RAPID SPIN"}
                </button>
              </div>
            </div>

            {/* Bottom metallic bar */}
            <div
              className="h-3"
              style={{
                background:
                  "linear-gradient(180deg, #d4af37 0%, #8a6f1a 30%, #d4af37 50%, #f0d060 80%, #d4af37 100%)",
              }}
            />
          </div>
        </div>

        {/* Info panels row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 animate-fade-in">
          {/* Pay table */}
          <div
            className="glass rounded-xl p-4"
            style={{
              border: "1px solid var(--casino-border)",
            }}
          >
            <h3
              className="text-sm font-bold uppercase tracking-wider mb-3"
              style={{ color: "var(--gold)" }}
            >
              Pay Table
            </h3>
            <div className="space-y-1.5">
              {(Object.entries(PAYOUTS) as [Symbol, number][]).map(
                ([symbol, multiplier]) => (
                  <div
                    key={symbol}
                    className="flex items-center justify-between py-1 px-2 rounded-lg transition-colors hover:bg-white/[0.03]"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">
                        {symbol} {symbol} {symbol}
                      </span>
                    </div>
                    <span
                      className={`text-xs font-bold ${
                        multiplier >= 50
                          ? "text-[var(--gold)]"
                          : multiplier >= 15
                            ? "text-purple-400"
                            : multiplier >= 8
                              ? "text-blue-400"
                              : "text-gray-400"
                      }`}
                    >
                      {multiplier}x
                    </span>
                  </div>
                )
              )}
              <div className="flex items-center justify-between py-1 px-2 rounded-lg">
                <span className="text-xs text-gray-500">Any two matching</span>
                <span className="text-xs font-bold text-gray-500">1x</span>
              </div>
            </div>
          </div>

          {/* Spin history */}
          <div
            className="glass rounded-xl p-4"
            style={{
              border: "1px solid var(--casino-border)",
            }}
          >
            <h3
              className="text-sm font-bold uppercase tracking-wider mb-3"
              style={{ color: "var(--gold)" }}
            >
              Recent Spins
            </h3>
            {history.length === 0 ? (
              <div className="text-center py-8 text-gray-600 text-sm">
                No spins yet. Give it a go!
              </div>
            ) : (
              <div className="space-y-2">
                {history.map((result, i) => (
                  <div
                    key={result.timestamp}
                    className={`flex items-center justify-between py-2 px-3 rounded-lg animate-fade-in ${
                      i === 0 ? "bg-white/[0.04]" : "bg-white/[0.01]"
                    }`}
                    style={{
                      animationDelay: `${i * 50}ms`,
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex gap-0.5 text-xl">
                        {result.reels.map((s, j) => (
                          <span key={j}>{s}</span>
                        ))}
                      </div>
                      <span className="text-xs text-gray-500">
                        ({result.bet.toLocaleString()})
                      </span>
                    </div>
                    <span
                      className={`text-xs font-bold ${
                        result.multiplier >= 15
                          ? "text-[var(--gold)]"
                          : result.multiplier >= 2
                            ? "text-green-400"
                            : result.multiplier === 1
                              ? "text-gray-400"
                              : "text-red-400"
                      }`}
                    >
                      {result.payout > 0
                        ? `+${result.payout.toLocaleString()}`
                        : `-${result.bet.toLocaleString()}`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Bottom info */}
        <div className="mt-8 text-center animate-fade-in">
          <p className="text-xs text-gray-600">
            XCasino Slots uses a random number generator. Virtual chips have no
            real-world value. Play responsibly.
          </p>
        </div>
      </div>
    </div>
  );
}
