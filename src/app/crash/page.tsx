"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useChips } from "@/context/ChipContext";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CHIP_VALUES = [100, 500, 1000, 5000] as const;
type ChipValue = (typeof CHIP_VALUES)[number];

// Generate crash point — house edge ~3%
function generateCrashPoint(): number {
  const r = Math.random();
  // e = 1% house edge approximation
  const crashPoint = Math.max(1.0, 1 / (1 - r) * 0.97);
  return Math.floor(crashPoint * 100) / 100;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CrashResult {
  crashPoint: number;
  cashedOut: boolean;
  cashOutAt: number;
  bet: number;
  payout: number;
  timestamp: number;
}

type GamePhase = "betting" | "running" | "crashed";

// ---------------------------------------------------------------------------
// Crash Graph Component
// ---------------------------------------------------------------------------

function CrashGraph({
  multiplier,
  phase,
  crashPoint,
  cashOutAt,
}: {
  multiplier: number;
  phase: GamePhase;
  crashPoint: number | null;
  cashOutAt: number | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointsRef = useRef<number[]>([]);

  useEffect(() => {
    if (phase === "running") {
      pointsRef.current.push(multiplier);
    } else if (phase === "betting") {
      pointsRef.current = [];
    }
  }, [multiplier, phase]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const w = rect.width;
    const h = rect.height;

    // Clear
    ctx.fillStyle = "#0a0a10";
    ctx.fillRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1;
    for (let i = 1; i < 5; i++) {
      const y = h - (h * i) / 5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    const points = pointsRef.current;
    if (points.length < 2) return;

    const maxMult = Math.max(2, ...points) * 1.1;
    const xStep = w / Math.max(points.length - 1, 1);

    // Draw curve
    ctx.beginPath();
    ctx.moveTo(0, h);
    points.forEach((p, i) => {
      const x = i * xStep;
      const y = h - ((p - 1) / (maxMult - 1)) * (h * 0.85);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    // Gradient fill
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    if (phase === "crashed") {
      grad.addColorStop(0, "rgba(220, 38, 38, 0.3)");
      grad.addColorStop(1, "rgba(220, 38, 38, 0)");
      ctx.strokeStyle = "#dc2626";
    } else {
      grad.addColorStop(0, "rgba(34, 197, 94, 0.3)");
      grad.addColorStop(1, "rgba(34, 197, 94, 0)");
      ctx.strokeStyle = "#22c55e";
    }
    ctx.lineWidth = 3;
    ctx.stroke();

    // Fill under curve
    const lastX = (points.length - 1) * xStep;
    const lastY = h - ((points[points.length - 1] - 1) / (maxMult - 1)) * (h * 0.85);
    ctx.lineTo(lastX, h);
    ctx.lineTo(0, h);
    ctx.fillStyle = grad;
    ctx.fill();

    // Cash out marker
    if (cashOutAt !== null && cashOutAt > 1) {
      const coIdx = points.findIndex((p) => p >= cashOutAt);
      if (coIdx >= 0) {
        const cx = coIdx * xStep;
        const cy = h - ((cashOutAt - 1) / (maxMult - 1)) * (h * 0.85);
        ctx.beginPath();
        ctx.arc(cx, cy, 6, 0, Math.PI * 2);
        ctx.fillStyle = "#d4af37";
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }, [multiplier, phase, crashPoint, cashOutAt]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full rounded-xl"
      style={{ height: 200 }}
    />
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function CrashPage() {
  const { chips, addChips, removeChips } = useChips();

  const [selectedChip, setSelectedChip] = useState<ChipValue>(100);
  const [phase, setPhase] = useState<GamePhase>("betting");
  const [multiplier, setMultiplier] = useState(1.0);
  const [crashPoint, setCrashPoint] = useState<number | null>(null);
  const [betPlaced, setBetPlaced] = useState(false);
  const [currentBet, setCurrentBet] = useState(0);
  const [cashedOut, setCashedOut] = useState(false);
  const [cashOutAt, setCashOutAt] = useState<number | null>(null);
  const [autoCashOut, setAutoCashOut] = useState<number>(2.0);
  const [autoCashOutEnabled, setAutoCashOutEnabled] = useState(false);
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState<CrashResult[]>([]);

  const animFrameRef = useRef<number>(0);
  const startTimeRef = useRef(0);
  const crashPointRef = useRef(0);
  const cashedOutRef = useRef(false);
  const autoCashOutRef = useRef({ enabled: false, value: 2.0 });

  // Keep refs in sync
  useEffect(() => {
    autoCashOutRef.current = { enabled: autoCashOutEnabled, value: autoCashOut };
  }, [autoCashOutEnabled, autoCashOut]);

  // ---------------------------------------------------------------------------
  // Game loop
  // ---------------------------------------------------------------------------

  const gameLoop = useCallback(() => {
    const elapsed = performance.now() - startTimeRef.current;
    // Exponential growth: starts slow, accelerates
    const t = elapsed / 1000;
    const newMult = Math.pow(Math.E, 0.08 * t);
    const rounded = Math.floor(newMult * 100) / 100;

    setMultiplier(rounded);

    // Auto cash-out check
    if (
      !cashedOutRef.current &&
      autoCashOutRef.current.enabled &&
      rounded >= autoCashOutRef.current.value
    ) {
      cashedOutRef.current = true;
      setCashedOut(true);
      setCashOutAt(autoCashOutRef.current.value);
      const payout = Math.floor(currentBet * autoCashOutRef.current.value);
      addChips(payout);
      setMessage(`Auto cashed out at ${autoCashOutRef.current.value.toFixed(2)}x! +${payout.toLocaleString()}`);
    }

    // Check crash
    if (rounded >= crashPointRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      setMultiplier(crashPointRef.current);
      setPhase("crashed");

      if (!cashedOutRef.current) {
        setMessage(`Crashed at ${crashPointRef.current.toFixed(2)}x! You lost ${currentBet.toLocaleString()} chips.`);
      }

      // Record history
      setHistory((prev) =>
        [
          {
            crashPoint: crashPointRef.current,
            cashedOut: cashedOutRef.current,
            cashOutAt: cashedOutRef.current ? (cashOutAt ?? autoCashOutRef.current.value) : 0,
            bet: currentBet,
            payout: cashedOutRef.current ? Math.floor(currentBet * (cashOutAt ?? autoCashOutRef.current.value)) : 0,
            timestamp: Date.now(),
          },
          ...prev,
        ].slice(0, 15)
      );

      // Auto-restart after 3 seconds
      setTimeout(() => {
        setPhase("betting");
        setMultiplier(1.0);
        setBetPlaced(false);
        setCashedOut(false);
        setCashOutAt(null);
        setMessage("");
        setCrashPoint(null);
      }, 3000);

      return;
    }

    animFrameRef.current = requestAnimationFrame(gameLoop);
  }, [currentBet, addChips, cashOutAt]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const placeBet = useCallback(() => {
    if (phase !== "betting" || betPlaced) return;
    const ok = removeChips(selectedChip);
    if (!ok) {
      setMessage("Not enough chips!");
      return;
    }
    setCurrentBet(selectedChip);
    setBetPlaced(true);
    setMessage("");
  }, [phase, betPlaced, selectedChip, removeChips]);

  const startRound = useCallback(() => {
    if (phase !== "betting" || !betPlaced) return;

    const cp = generateCrashPoint();
    crashPointRef.current = cp;
    cashedOutRef.current = false;
    setCrashPoint(cp);
    setCashedOut(false);
    setCashOutAt(null);
    setPhase("running");
    setMultiplier(1.0);
    startTimeRef.current = performance.now();
    setMessage("");

    animFrameRef.current = requestAnimationFrame(gameLoop);
  }, [phase, betPlaced, gameLoop]);

  const cashOut = useCallback(() => {
    if (phase !== "running" || cashedOut) return;
    cashedOutRef.current = true;
    setCashedOut(true);
    setCashOutAt(multiplier);
    const payout = Math.floor(currentBet * multiplier);
    addChips(payout);
    setMessage(
      `Cashed out at ${multiplier.toFixed(2)}x! +${payout.toLocaleString()} chips`
    );
  }, [phase, cashedOut, multiplier, currentBet, addChips]);

  // Cleanup on unmount
  useEffect(() => {
    return () => cancelAnimationFrame(animFrameRef.current);
  }, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const isWaiting = phase === "betting" && !betPlaced;
  const isBetLocked = phase === "betting" && betPlaced;

  return (
    <div className="min-h-screen pb-20 animate-fade-in">
      {/* Header */}
      <div className="max-w-4xl mx-auto px-4 pt-6 pb-4">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">
            <span className="text-[var(--gold)]">Crash</span>
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
          {/* Multiplier display */}
          <div className="text-center mb-4">
            <div
              className={`text-7xl md:text-8xl font-black tabular-nums transition-colors duration-200 ${
                phase === "crashed"
                  ? "text-red-500"
                  : cashedOut
                  ? "text-[var(--gold)]"
                  : phase === "running"
                  ? "text-green-400"
                  : "text-gray-500"
              }`}
            >
              {multiplier.toFixed(2)}x
            </div>
            {phase === "crashed" && (
              <p className="text-red-400 font-bold text-lg mt-2 animate-fade-in">
                CRASHED!
              </p>
            )}
            {phase === "betting" && (
              <p className="text-gray-500 text-sm mt-2">
                {betPlaced
                  ? "Bet placed! Click Start to begin."
                  : "Place your bet to start"}
              </p>
            )}
          </div>

          {/* Graph */}
          <div className="mb-6">
            <CrashGraph
              multiplier={multiplier}
              phase={phase}
              crashPoint={crashPoint}
              cashOutAt={cashOutAt}
            />
          </div>

          {/* Message */}
          {message && (
            <p
              className={`text-center text-lg font-bold mb-4 animate-fade-in ${
                cashedOut || (message.includes("+")) ? "text-[var(--gold)]" : "text-red-400"
              }`}
            >
              {message}
            </p>
          )}

          {/* Controls */}
          <div className="max-w-lg mx-auto">
            {/* Chip selector */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm text-gray-400 mr-1">Bet:</span>
              {CHIP_VALUES.map((val) => (
                <button
                  key={val}
                  onClick={() => setSelectedChip(val)}
                  disabled={phase !== "betting" || betPlaced}
                  className={`relative w-12 h-12 rounded-full font-bold text-xs flex items-center justify-center border-2 transition-all duration-150 ${
                    selectedChip === val
                      ? "border-[var(--gold)] bg-[var(--gold)] text-black scale-110 shadow-lg shadow-[var(--gold)]/30"
                      : "border-[var(--casino-border)] bg-[var(--casino-card)] text-gray-300 hover:border-gray-500"
                  } ${
                    phase !== "betting" || betPlaced
                      ? "opacity-50 cursor-not-allowed"
                      : "cursor-pointer"
                  }`}
                >
                  {val >= 1000 ? `${val / 1000}k` : val}
                </button>
              ))}
            </div>

            {/* Auto cash-out */}
            <div className="flex items-center gap-3 mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoCashOutEnabled}
                  onChange={(e) => setAutoCashOutEnabled(e.target.checked)}
                  disabled={phase === "running"}
                  className="w-4 h-4 accent-[var(--gold)]"
                />
                <span className="text-sm text-gray-400">Auto Cash Out</span>
              </label>
              <input
                type="number"
                value={autoCashOut}
                onChange={(e) =>
                  setAutoCashOut(Math.max(1.01, Number(e.target.value)))
                }
                disabled={!autoCashOutEnabled || phase === "running"}
                min="1.01"
                step="0.1"
                className="w-24 bg-[var(--casino-card)] border border-[var(--casino-border)] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[var(--gold)]/50 disabled:opacity-40"
              />
              <span className="text-sm text-gray-500">x</span>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              {phase === "betting" && !betPlaced && (
                <button
                  onClick={placeBet}
                  className="flex-1 btn-casino py-4 rounded-xl text-xl tracking-wider"
                >
                  Place Bet ({selectedChip.toLocaleString()})
                </button>
              )}
              {phase === "betting" && betPlaced && (
                <button
                  onClick={startRound}
                  className="flex-1 bg-gradient-to-r from-green-700 to-green-600 text-white font-bold py-4 rounded-xl text-xl tracking-wider hover:from-green-600 hover:to-green-500 transition-all shadow-lg shadow-green-900/30"
                >
                  🚀 START
                </button>
              )}
              {phase === "running" && !cashedOut && (
                <button
                  onClick={cashOut}
                  className="flex-1 bg-gradient-to-r from-[var(--gold)] to-[var(--gold-dark)] text-black font-black py-4 rounded-xl text-xl tracking-wider hover:from-[var(--gold-light)] hover:to-[var(--gold)] transition-all shadow-lg shadow-[var(--gold)]/30 animate-pulse"
                >
                  💰 CASH OUT ({(currentBet * multiplier).toFixed(0)})
                </button>
              )}
              {phase === "running" && cashedOut && (
                <div className="flex-1 bg-green-900/30 border border-green-700 text-green-400 font-bold py-4 rounded-xl text-xl text-center">
                  ✅ Cashed Out at {cashOutAt?.toFixed(2)}x
                </div>
              )}
              {phase === "crashed" && (
                <div className="flex-1 bg-red-900/20 border border-red-800 text-red-400 font-bold py-4 rounded-xl text-xl text-center">
                  💥 Crashed at {crashPoint?.toFixed(2)}x — Next round in 3s...
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="max-w-4xl mx-auto px-4 mt-6">
          <div className="glass rounded-xl p-4">
            <h3 className="text-sm font-bold text-gray-400 mb-3">
              Crash History
            </h3>
            <div className="flex flex-wrap gap-2">
              {history.map((r, i) => (
                <div
                  key={r.timestamp}
                  className={`px-3 py-1.5 rounded-lg text-sm font-bold border ${
                    r.crashPoint >= 2
                      ? "bg-green-900/20 border-green-800/50 text-green-400"
                      : "bg-red-900/20 border-red-800/50 text-red-400"
                  } ${i === 0 ? "ring-1 ring-[var(--gold)]" : "opacity-70"}`}
                >
                  {r.crashPoint.toFixed(2)}x
                  {r.cashedOut && (
                    <span className="text-[var(--gold)] ml-1">
                      ✓ {r.cashOutAt.toFixed(2)}x
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
            <div className="bg-[var(--casino-card)] rounded-lg px-3 py-2 border border-[var(--casino-border)]">
              <span className="text-[var(--gold)] font-bold">1.</span>{" "}
              <span className="text-gray-400">Place your bet</span>
            </div>
            <div className="bg-[var(--casino-card)] rounded-lg px-3 py-2 border border-[var(--casino-border)]">
              <span className="text-[var(--gold)] font-bold">2.</span>{" "}
              <span className="text-gray-400">Watch the multiplier rise</span>
            </div>
            <div className="bg-[var(--casino-card)] rounded-lg px-3 py-2 border border-[var(--casino-border)]">
              <span className="text-[var(--gold)] font-bold">3.</span>{" "}
              <span className="text-gray-400">Cash out before it crashes!</span>
            </div>
            <div className="bg-[var(--casino-card)] rounded-lg px-3 py-2 border border-[var(--casino-border)]">
              <span className="text-[var(--gold)] font-bold">💡</span>{" "}
              <span className="text-gray-400">Set auto cash-out for safety</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
