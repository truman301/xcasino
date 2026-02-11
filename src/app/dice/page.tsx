"use client";

import { useState, useCallback, useRef } from "react";
import { useChips } from "@/context/ChipContext";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CHIP_VALUES = [100, 500, 1000, 5000] as const;
type ChipValue = (typeof CHIP_VALUES)[number];

// Provably fair RNG
function secureRandom(): number {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return arr[0] / (0xffffffff + 1); // 0 to <1
}

function rollDice(): number {
  return Math.floor(secureRandom() * 100) + 1; // 1-100
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RollResult {
  roll: number;
  target: number;
  mode: "over" | "under";
  bet: number;
  won: boolean;
  payout: number;
  multiplier: number;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function DicePage() {
  const { chips, addChips, removeChips } = useChips();

  const [selectedChip, setSelectedChip] = useState<ChipValue>(100);
  const [target, setTarget] = useState(50);
  const [mode, setMode] = useState<"over" | "under">("over");
  const [rolling, setRolling] = useState(false);
  const [lastRoll, setLastRoll] = useState<number | null>(null);
  const [lastWon, setLastWon] = useState<boolean | null>(null);
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState<RollResult[]>([]);

  // Animated roll display
  const [displayNumber, setDisplayNumber] = useState<number | null>(null);
  const rollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // ---------------------------------------------------------------------------
  // Computed values
  // ---------------------------------------------------------------------------

  const winChance = mode === "over" ? 100 - target : target - 1;
  const multiplier = winChance > 0 ? Math.floor((99 / winChance) * 100) / 100 : 0;
  const potentialWin = Math.floor(selectedChip * multiplier);

  // ---------------------------------------------------------------------------
  // Roll
  // ---------------------------------------------------------------------------

  const roll = useCallback(() => {
    if (rolling) return;

    const ok = removeChips(selectedChip);
    if (!ok) {
      setMessage("Not enough chips!");
      return;
    }

    setRolling(true);
    setMessage("");
    setLastWon(null);
    setLastRoll(null);

    // Animate random numbers flashing
    let ticks = 0;
    rollIntervalRef.current = setInterval(() => {
      setDisplayNumber(Math.floor(Math.random() * 100) + 1);
      ticks++;
      if (ticks > 15) {
        clearInterval(rollIntervalRef.current!);

        // Final result
        const result = rollDice();
        setDisplayNumber(result);
        setLastRoll(result);

        const won =
          mode === "over" ? result > target : result < target;

        const payout = won ? Math.floor(selectedChip * multiplier) : 0;

        if (won) {
          addChips(payout);
          setMessage(`You won ${payout.toLocaleString()} chips!`);
        } else {
          setMessage(`Rolled ${result}. Better luck next time!`);
        }

        setLastWon(won);

        const rollResult: RollResult = {
          roll: result,
          target,
          mode,
          bet: selectedChip,
          won,
          payout,
          multiplier: won ? multiplier : 0,
          timestamp: Date.now(),
        };

        setHistory((prev) => [rollResult, ...prev].slice(0, 20));
        setRolling(false);
      }
    }, 50);
  }, [rolling, selectedChip, target, mode, multiplier, removeChips, addChips]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen pb-20 animate-fade-in">
      {/* Header */}
      <div className="max-w-4xl mx-auto px-4 pt-6 pb-4">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">
            <span className="text-[var(--gold)]">Dice</span>
          </h1>
          <div className="glass rounded-full px-5 py-2 flex items-center gap-2">
            <span className="text-xl">🪙</span>
            <span className="text-xl font-bold text-[var(--gold)]">
              {chips.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Game Area */}
      <div className="max-w-4xl mx-auto px-4">
        <div
          className="rounded-2xl p-6 md:p-8"
          style={{
            background:
              "radial-gradient(ellipse at 50% 30%, rgba(15,15,24,0.95), rgba(5,5,8,0.98))",
          }}
        >
          {/* Roll Display */}
          <div className="flex flex-col items-center mb-8">
            <div
              className={`w-32 h-32 rounded-2xl flex items-center justify-center text-5xl font-black mb-4 transition-all duration-300 border-2 ${
                lastWon === null
                  ? "bg-[var(--casino-card)] border-[var(--casino-border)] text-gray-400"
                  : lastWon
                  ? "bg-green-900/30 border-green-500 text-green-400 shadow-lg shadow-green-500/20"
                  : "bg-red-900/30 border-red-500 text-red-400 shadow-lg shadow-red-500/20"
              } ${rolling ? "animate-pulse scale-105" : ""}`}
            >
              {displayNumber !== null ? displayNumber : "?"}
            </div>

            {/* Result message */}
            {message && !rolling && (
              <p
                className={`text-lg font-bold animate-fade-in ${
                  lastWon ? "text-green-400" : "text-red-400"
                }`}
              >
                {message}
              </p>
            )}

            {rolling && (
              <p className="text-sm text-gray-400 italic animate-pulse">
                Rolling...
              </p>
            )}
          </div>

          {/* Slider + Controls */}
          <div className="max-w-xl mx-auto">
            {/* Target slider */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">Target Number</span>
                <span className="text-2xl font-black text-white">{target}</span>
              </div>

              {/* Custom range slider */}
              <div className="relative">
                <input
                  type="range"
                  min={2}
                  max={98}
                  value={target}
                  onChange={(e) => setTarget(Number(e.target.value))}
                  disabled={rolling}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer disabled:cursor-not-allowed"
                  style={{
                    background: `linear-gradient(to right,
                      ${mode === "under" ? "#22c55e" : "#ef4444"} 0%,
                      ${mode === "under" ? "#22c55e" : "#ef4444"} ${target}%,
                      ${mode === "over" ? "#22c55e" : "#ef4444"} ${target}%,
                      ${mode === "over" ? "#22c55e" : "#ef4444"} 100%)`,
                  }}
                />
                <div className="flex justify-between text-xs text-gray-600 mt-1">
                  <span>1</span>
                  <span>25</span>
                  <span>50</span>
                  <span>75</span>
                  <span>100</span>
                </div>
              </div>
            </div>

            {/* Over / Under toggle */}
            <div className="flex gap-3 mb-6">
              <button
                onClick={() => setMode("under")}
                disabled={rolling}
                className={`flex-1 py-3 rounded-xl font-bold text-lg transition-all ${
                  mode === "under"
                    ? "bg-gradient-to-r from-green-700 to-green-600 text-white shadow-lg shadow-green-900/30"
                    : "bg-[var(--casino-card)] border border-[var(--casino-border)] text-gray-400 hover:border-green-700"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                Roll Under {target}
              </button>
              <button
                onClick={() => setMode("over")}
                disabled={rolling}
                className={`flex-1 py-3 rounded-xl font-bold text-lg transition-all ${
                  mode === "over"
                    ? "bg-gradient-to-r from-green-700 to-green-600 text-white shadow-lg shadow-green-900/30"
                    : "bg-[var(--casino-card)] border border-[var(--casino-border)] text-gray-400 hover:border-green-700"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                Roll Over {target}
              </button>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-[var(--casino-card)] border border-[var(--casino-border)] rounded-xl p-3 text-center">
                <p className="text-xs text-gray-500 mb-1">Win Chance</p>
                <p className="text-xl font-bold text-[var(--gold)]">
                  {winChance}%
                </p>
              </div>
              <div className="bg-[var(--casino-card)] border border-[var(--casino-border)] rounded-xl p-3 text-center">
                <p className="text-xs text-gray-500 mb-1">Multiplier</p>
                <p className="text-xl font-bold text-white">{multiplier}x</p>
              </div>
              <div className="bg-[var(--casino-card)] border border-[var(--casino-border)] rounded-xl p-3 text-center">
                <p className="text-xs text-gray-500 mb-1">Potential Win</p>
                <p className="text-xl font-bold text-green-400">
                  {potentialWin.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Chip selector */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm text-gray-400 mr-1">Bet:</span>
              {CHIP_VALUES.map((val) => (
                <button
                  key={val}
                  onClick={() => setSelectedChip(val)}
                  disabled={rolling}
                  className={`relative w-12 h-12 rounded-full font-bold text-xs flex items-center justify-center border-2 transition-all duration-150 ${
                    selectedChip === val
                      ? "border-[var(--gold)] bg-[var(--gold)] text-black scale-110 shadow-lg shadow-[var(--gold)]/30"
                      : "border-[var(--casino-border)] bg-[var(--casino-card)] text-gray-300 hover:border-gray-500"
                  } ${
                    rolling
                      ? "opacity-50 cursor-not-allowed"
                      : "cursor-pointer"
                  }`}
                >
                  {val >= 1000 ? `${val / 1000}k` : val}
                </button>
              ))}
            </div>

            {/* Roll button */}
            <button
              onClick={roll}
              disabled={rolling || winChance <= 0}
              className="w-full btn-casino py-4 rounded-xl text-xl tracking-wider disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {rolling ? "Rolling..." : "🎲 ROLL"}
            </button>
          </div>
        </div>
      </div>

      {/* Roll History */}
      {history.length > 0 && (
        <div className="max-w-4xl mx-auto px-4 mt-6">
          <div className="glass rounded-xl p-4">
            <h3 className="text-sm font-bold text-gray-400 mb-3">
              Recent Rolls
            </h3>
            <div className="flex flex-wrap gap-2">
              {history.map((r, i) => (
                <div
                  key={r.timestamp}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm border ${
                    r.won
                      ? "bg-green-900/20 border-green-800/50"
                      : "bg-red-900/20 border-red-800/50"
                  } ${i === 0 ? "ring-1 ring-[var(--gold)]" : "opacity-70"}`}
                >
                  <span
                    className={`font-black text-lg ${
                      r.won ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {r.roll}
                  </span>
                  <span className="text-gray-500 text-xs">
                    {r.mode === "over" ? ">" : "<"} {r.target}
                  </span>
                  {r.won && (
                    <span className="text-[var(--gold)] font-bold text-xs">
                      +{r.payout.toLocaleString()}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* How to play */}
      <div className="max-w-4xl mx-auto px-4 mt-6">
        <div className="glass rounded-xl p-4">
          <h3 className="text-sm font-bold text-gray-400 mb-3">How to Play</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div className="bg-[var(--casino-card)] rounded-lg px-3 py-2 border border-[var(--casino-border)]">
              <span className="text-[var(--gold)] font-bold">1.</span>{" "}
              <span className="text-gray-400">
                Pick a target number (2-98)
              </span>
            </div>
            <div className="bg-[var(--casino-card)] rounded-lg px-3 py-2 border border-[var(--casino-border)]">
              <span className="text-[var(--gold)] font-bold">2.</span>{" "}
              <span className="text-gray-400">
                Choose Roll Over or Roll Under
              </span>
            </div>
            <div className="bg-[var(--casino-card)] rounded-lg px-3 py-2 border border-[var(--casino-border)]">
              <span className="text-[var(--gold)] font-bold">3.</span>{" "}
              <span className="text-gray-400">
                Lower chance = higher multiplier!
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
