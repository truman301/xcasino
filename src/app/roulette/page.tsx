"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import { useChips } from "@/context/ChipContext";
import { motion, useAnimate } from "framer-motion";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RED_NUMBERS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const BLACK_NUMBERS = new Set([2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35]);

const CHIP_VALUES = [100, 500, 1000, 5000] as const;
type ChipValue = (typeof CHIP_VALUES)[number];

// Standard European roulette wheel order (clockwise from 0)
const WHEEL_ORDER = [0,26,3,35,12,28,7,29,18,22,9,31,14,20,1,33,16,24,5,10,23,8,30,11,36,13,27,6,34,17,25,2,21,4,19,15,32];
const NUM_POCKETS = 37;
const SECTOR_ANGLE = 360 / NUM_POCKETS;

// The three columns on a standard roulette layout
const COLUMN_1 = [1,4,7,10,13,16,19,22,25,28,31,34];
const COLUMN_2 = [2,5,8,11,14,17,20,23,26,29,32,35];
const COLUMN_3 = [3,6,9,12,15,18,21,24,27,30,33,36];

const TABLE_ROWS: number[][] = [
  COLUMN_3,
  COLUMN_2,
  COLUMN_1,
];

type BetType =
  | { kind: "straight"; number: number }
  | { kind: "red" }
  | { kind: "black" }
  | { kind: "odd" }
  | { kind: "even" }
  | { kind: "low" }
  | { kind: "high" }
  | { kind: "dozen"; dozen: 1 | 2 | 3 }
  | { kind: "column"; column: 1 | 2 | 3 };

interface Bet {
  type: BetType;
  amount: number;
}

function betKey(bt: BetType): string {
  switch (bt.kind) {
    case "straight": return `straight-${bt.number}`;
    case "red": return "red";
    case "black": return "black";
    case "odd": return "odd";
    case "even": return "even";
    case "low": return "low";
    case "high": return "high";
    case "dozen": return `dozen-${bt.dozen}`;
    case "column": return `column-${bt.column}`;
  }
}

function betLabel(bt: BetType): string {
  switch (bt.kind) {
    case "straight": return `#${bt.number}`;
    case "red": return "Red";
    case "black": return "Black";
    case "odd": return "Odd";
    case "even": return "Even";
    case "low": return "1-18";
    case "high": return "19-36";
    case "dozen": return bt.dozen === 1 ? "1st 12" : bt.dozen === 2 ? "2nd 12" : "3rd 12";
    case "column": return `Col ${bt.column}`;
  }
}

function getNumberColor(n: number): "red" | "black" | "green" {
  if (n === 0) return "green";
  if (RED_NUMBERS.has(n)) return "red";
  return "black";
}

function doesBetWin(bt: BetType, result: number): boolean {
  switch (bt.kind) {
    case "straight": return bt.number === result;
    case "red": return RED_NUMBERS.has(result);
    case "black": return BLACK_NUMBERS.has(result);
    case "odd": return result > 0 && result % 2 === 1;
    case "even": return result > 0 && result % 2 === 0;
    case "low": return result >= 1 && result <= 18;
    case "high": return result >= 19 && result <= 36;
    case "dozen":
      if (result === 0) return false;
      if (bt.dozen === 1) return result >= 1 && result <= 12;
      if (bt.dozen === 2) return result >= 13 && result <= 24;
      return result >= 25 && result <= 36;
    case "column":
      if (result === 0) return false;
      if (bt.column === 1) return COLUMN_1.includes(result);
      if (bt.column === 2) return COLUMN_2.includes(result);
      return COLUMN_3.includes(result);
  }
}

function getPayout(bt: BetType): number {
  switch (bt.kind) {
    case "straight": return 35;
    case "red": case "black": case "odd": case "even": case "low": case "high": return 1;
    case "dozen": case "column": return 2;
  }
}

// ---------------------------------------------------------------------------
// Table styling helpers
// ---------------------------------------------------------------------------

function numberBg(n: number): string {
  const c = getNumberColor(n);
  if (c === "green") return "bg-[var(--casino-green)]";
  if (c === "red") return "bg-[var(--casino-red)]";
  return "bg-[#1a1a2e]";
}

function historyBg(n: number): string {
  const c = getNumberColor(n);
  if (c === "green") return "bg-green-600";
  if (c === "red") return "bg-red-600";
  return "bg-gray-700";
}

// ---------------------------------------------------------------------------
// Wheel rendering helpers
// ---------------------------------------------------------------------------

function getWheelColor(n: number): string {
  const c = getNumberColor(n);
  if (c === "green") return "#0d7a36";
  if (c === "red") return "#b91c1c";
  return "#18182b";
}

function buildConicGradient(): string {
  const stops: string[] = [];
  WHEEL_ORDER.forEach((num, i) => {
    const color = getWheelColor(num);
    const startDeg = i * SECTOR_ANGLE;
    const endDeg = (i + 1) * SECTOR_ANGLE;
    stops.push(`${color} ${startDeg.toFixed(4)}deg ${endDeg.toFixed(4)}deg`);
  });
  return `conic-gradient(from 0deg, ${stops.join(", ")})`;
}

function buildFretGradient(): string {
  // Thin gold lines at each sector boundary
  const stops: string[] = [];
  for (let i = 0; i < NUM_POCKETS; i++) {
    const deg = i * SECTOR_ANGLE;
    const b = deg - 0.4;
    const a = deg + 0.4;
    if (i > 0) stops.push(`transparent ${b.toFixed(4)}deg`);
    stops.push(`rgba(184,150,12,0.7) ${(deg - 0.15).toFixed(4)}deg`);
    stops.push(`rgba(240,208,96,0.9) ${deg.toFixed(4)}deg`);
    stops.push(`rgba(184,150,12,0.7) ${(deg + 0.15).toFixed(4)}deg`);
    stops.push(`transparent ${a.toFixed(4)}deg`);
  }
  return `conic-gradient(from 0deg, transparent 0deg, ${stops.join(", ")}, transparent 360deg)`;
}

function getWinningAngle(winningNumber: number): number {
  const index = WHEEL_ORDER.indexOf(winningNumber);
  return index * SECTOR_ANGLE + SECTOR_ANGLE / 2;
}

// ---------------------------------------------------------------------------
// Ball animation (requestAnimationFrame for 60fps, DOM ref for performance)
// ---------------------------------------------------------------------------

function animateBall(
  duration: number,
  totalBallRotation: number,
  outerRadius: number,
  innerRadius: number,
  ballEl: HTMLDivElement,
  onComplete: () => void
) {
  const startTime = performance.now();

  function frame(now: number) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Ease-out: fast start, slow end
    const eased = 1 - Math.pow(1 - progress, 3.5);

    const currentAngle = totalBallRotation * eased;

    // Spiral inward during last 65%
    let currentRadius = outerRadius;
    const spiralStart = 0.35;
    if (progress > spiralStart) {
      const spiralProgress = (progress - spiralStart) / (1 - spiralStart);
      const spiralEased = spiralProgress * spiralProgress;
      currentRadius = outerRadius - (outerRadius - innerRadius) * spiralEased;
    }

    // Small bounce in the last 8%
    if (progress > 0.92) {
      const bp = (progress - 0.92) / 0.08;
      const bounce = Math.sin(bp * Math.PI * 4) * 3.5 * (1 - bp);
      currentRadius += bounce;
    }

    ballEl.style.transform = `rotate(${currentAngle}deg) translateY(-${currentRadius}px)`;

    if (progress < 1) {
      requestAnimationFrame(frame);
    } else {
      ballEl.style.transform = `rotate(${totalBallRotation}deg) translateY(-${innerRadius}px)`;
      onComplete();
    }
  }

  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------------------
// Chip badge
// ---------------------------------------------------------------------------

function ChipBadge({ amount }: { amount: number }) {
  return (
    <span className="absolute -top-1 -right-1 min-w-[20px] h-5 flex items-center justify-center rounded-full bg-[var(--gold)] text-[10px] font-bold text-black px-1 shadow-md z-10 pointer-events-none">
      {amount >= 1000 ? `${amount / 1000}k` : amount}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Roulette Wheel Component — realistic physical design
// ---------------------------------------------------------------------------

const WHEEL_SIZE = 320;
const FRAME_PAD = 16;
const TRACK_PAD = 8;
const FRET_PAD = 4;
const TOTAL_SIZE = WHEEL_SIZE + (FRAME_PAD + TRACK_PAD + FRET_PAD) * 2;

// Radii for ball orbit
const BALL_TRACK_RADIUS = WHEEL_SIZE / 2 + FRET_PAD + TRACK_PAD / 2;
const BALL_POCKET_RADIUS = WHEEL_SIZE / 2 - 24;

// 8 diamond deflectors evenly spaced
const DEFLECTOR_POSITIONS = Array.from({ length: 8 }, (_, i) => i * 45);

function RouletteWheel({
  wheelScope,
  ballRef,
  result,
  spinning,
}: {
  wheelScope: React.RefObject<HTMLDivElement | null>;
  ballRef: React.RefObject<HTMLDivElement | null>;
  result: number | null;
  spinning: boolean;
}) {
  const conicGradient = useMemo(() => buildConicGradient(), []);
  const fretGradient = useMemo(() => buildFretGradient(), []);

  const numberRadius = WHEEL_SIZE / 2 - 36;
  const centerSize = WHEEL_SIZE * 0.3;

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: TOTAL_SIZE, height: TOTAL_SIZE }}
    >
      {/* Gold pointer at top */}
      <div className="roulette-marker" />

      {/* Mahogany frame */}
      <div
        className={`roulette-frame ${result !== null && !spinning ? "roulette-win-glow" : ""}`}
        style={{ width: TOTAL_SIZE, height: TOTAL_SIZE }}
      >
        {/* Ball track (metallic groove) */}
        <div
          className="roulette-ball-track"
          style={{
            width: TOTAL_SIZE - FRAME_PAD * 2,
            height: TOTAL_SIZE - FRAME_PAD * 2,
            position: "relative",
          }}
        >
          {/* Diamond deflectors on the ball track */}
          {DEFLECTOR_POSITIONS.map((angle) => {
            const r = (TOTAL_SIZE - FRAME_PAD * 2) / 2 - 3;
            const rad = (angle - 90) * (Math.PI / 180);
            const cx = (TOTAL_SIZE - FRAME_PAD * 2) / 2;
            return (
              <div
                key={angle}
                className="roulette-deflector"
                style={{
                  left: cx + r * Math.cos(rad) - 5,
                  top: cx + r * Math.sin(rad) - 5,
                }}
              />
            );
          })}

          {/* Gold fret ring */}
          <div
            className="roulette-fret-ring"
            style={{
              width: TOTAL_SIZE - (FRAME_PAD + TRACK_PAD) * 2,
              height: TOTAL_SIZE - (FRAME_PAD + TRACK_PAD) * 2,
            }}
          >
            {/* Spinning wheel */}
            <motion.div
              ref={wheelScope}
              className="roulette-wheel"
              style={{ width: WHEEL_SIZE, height: WHEEL_SIZE }}
            >
              {/* Colored pockets */}
              <div
                className="absolute inset-0 rounded-full"
                style={{ background: conicGradient }}
              />

              {/* Fret dividers */}
              <div
                className="roulette-dividers"
                style={{ background: fretGradient }}
              />

              {/* Pocket depth shadow — inner ring */}
              <div
                className="roulette-pocket-shadow"
                style={{
                  top: 20,
                  left: 20,
                  right: 20,
                  bottom: 20,
                  background: "transparent",
                }}
              />

              {/* Number labels */}
              {WHEEL_ORDER.map((num, i) => {
                const angle = i * SECTOR_ANGLE + SECTOR_ANGLE / 2;
                return (
                  <span
                    key={num}
                    className="roulette-number"
                    style={{
                      width: 22,
                      height: 22,
                      marginTop: -11,
                      marginLeft: -11,
                      transform: `rotate(${angle}deg) translateY(-${numberRadius}px) rotate(-${angle}deg)`,
                    }}
                  >
                    {num}
                  </span>
                );
              })}

              {/* Center cone — gold brass hub */}
              <div
                className="roulette-center"
                style={{ width: centerSize, height: centerSize }}
              >
                <div
                  className="roulette-center-outer"
                  style={{ width: centerSize - 4, height: centerSize - 4 }}
                >
                  <div
                    className="roulette-center-inner"
                    style={{ width: centerSize - 10, height: centerSize - 10 }}
                  >
                    <span className="text-[#1a0e00] font-black text-[9px] tracking-widest select-none drop-shadow-[0_1px_0_rgba(255,255,255,0.3)]">
                      CASINO X
                    </span>
                  </div>
                </div>
              </div>

              {/* 3D lighting overlay */}
              <div className="roulette-light-overlay" />
            </motion.div>
          </div>

          {/* Ball — lives in ball-track layer, NOT inside the spinning wheel */}
          <div
            ref={ballRef}
            className={`roulette-ball ${spinning ? "roulette-ball-spinning" : ""}`}
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: `rotate(0deg) translateY(-${BALL_TRACK_RADIUS}px)`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function RoulettePage() {
  const { chips, addChips, removeChips } = useChips();

  const [selectedChip, setSelectedChip] = useState<ChipValue>(100);
  const [bets, setBets] = useState<Map<string, Bet>>(new Map());
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const [message, setMessage] = useState<string>("");
  const [lastWin, setLastWin] = useState<number>(0);

  const [wheelScope, wheelAnimate] = useAnimate<HTMLDivElement>();
  const ballRef = useRef<HTMLDivElement>(null);
  const cumulativeRotationRef = useRef(0);

  // -------------------------------------------------------------------------
  // Bet placement
  // -------------------------------------------------------------------------

  const totalBet = useCallback(() => {
    let total = 0;
    bets.forEach((b) => { total += b.amount; });
    return total;
  }, [bets]);

  const placeBet = useCallback((bt: BetType) => {
    if (spinning) return;
    const key = betKey(bt);
    const existing = bets.get(key);
    const currentAmount = existing ? existing.amount : 0;

    const ok = removeChips(selectedChip);
    if (!ok) {
      setMessage("Not enough chips!");
      return;
    }

    setBets((prev) => {
      const next = new Map(prev);
      next.set(key, { type: bt, amount: currentAmount + selectedChip });
      return next;
    });
    setMessage("");
  }, [spinning, bets, selectedChip, removeChips]);

  const clearBets = useCallback(() => {
    if (spinning) return;
    let refund = 0;
    bets.forEach((b) => { refund += b.amount; });
    if (refund > 0) addChips(refund);
    setBets(new Map());
    setMessage("");
    setLastWin(0);
  }, [spinning, bets, addChips]);

  // -------------------------------------------------------------------------
  // Spin
  // -------------------------------------------------------------------------

  const spin = useCallback(() => {
    if (spinning) return;
    if (bets.size === 0) {
      setMessage("Place at least one bet!");
      return;
    }

    setSpinning(true);
    setMessage("");
    setResult(null);
    setLastWin(0);

    const winningNumber = Math.floor(Math.random() * 37);
    const spinDuration = 4500 + Math.random() * 1500; // 4.5-6 seconds

    const winAngle = getWinningAngle(winningNumber);

    // Wheel rotates negative (clockwise visually when CSS rotation is negative)
    const wheelExtraRotations = 360 * (3 + Math.floor(Math.random() * 3));
    const targetWheelRotation = cumulativeRotationRef.current - (wheelExtraRotations + winAngle);

    // Ball does 5-8 full orbits, ends at 0° (top = marker position)
    const ballOrbits = 5 + Math.floor(Math.random() * 4);
    const totalBallRotation = 360 * ballOrbits;

    // Reset ball to outer track
    if (ballRef.current) {
      ballRef.current.style.transform = `rotate(0deg) translateY(-${BALL_TRACK_RADIUS}px)`;
    }

    // Animate wheel
    wheelAnimate(
      wheelScope.current!,
      { rotate: targetWheelRotation },
      {
        duration: spinDuration / 1000,
        ease: [0.12, 0.8, 0.2, 1],
      }
    );

    // Animate ball
    if (ballRef.current) {
      animateBall(
        spinDuration,
        totalBallRotation,
        BALL_TRACK_RADIUS,
        BALL_POCKET_RADIUS,
        ballRef.current,
        () => {
          cumulativeRotationRef.current = targetWheelRotation;
          setResult(winningNumber);

          // Calculate winnings
          let totalWinnings = 0;
          bets.forEach((bet) => {
            if (doesBetWin(bet.type, winningNumber)) {
              const payout = getPayout(bet.type);
              totalWinnings += bet.amount + bet.amount * payout;
            }
          });

          if (totalWinnings > 0) {
            addChips(totalWinnings);
            setLastWin(totalWinnings);
            setMessage(`Winner! +${totalWinnings.toLocaleString()} chips`);
          } else {
            setMessage(`No luck. The ball landed on ${winningNumber}.`);
          }

          setHistory((prev) => [winningNumber, ...prev].slice(0, 10));
          setBets(new Map());
          setSpinning(false);
        }
      );
    }
  }, [spinning, bets, addChips, wheelAnimate, wheelScope]);

  // -------------------------------------------------------------------------
  // Bet amount helper
  // -------------------------------------------------------------------------

  const getBetAmount = (bt: BetType): number => {
    const key = betKey(bt);
    return bets.get(key)?.amount ?? 0;
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="min-h-screen pb-20 animate-fade-in">
      {/* Header */}
      <div className="max-w-6xl mx-auto px-4 pt-6 pb-4">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">
            <span className="text-[var(--gold)]">Roulette</span>
          </h1>
          <div className="glass rounded-full px-5 py-2 flex items-center gap-2">
            <span className="text-xl">🪙</span>
            <span className="text-xl font-bold text-[var(--gold)]">
              {chips.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Wheel Section */}
      <div className="max-w-6xl mx-auto px-4 mb-6">
        <div className="rounded-2xl p-4 md:p-6 flex flex-col items-center justify-center" style={{ background: "radial-gradient(ellipse at 50% 40%, rgba(15,15,24,0.95), rgba(5,5,8,0.98))" }}>
          {/* The Wheel */}
          <div className="mb-4 scale-[0.78] sm:scale-[0.85] md:scale-100 origin-center">
            <RouletteWheel
              wheelScope={wheelScope}
              ballRef={ballRef}
              result={result}
              spinning={spinning}
            />
          </div>

          {/* Result display */}
          {result !== null && !spinning && (
            <div className="animate-fade-in mb-3 flex items-center gap-3">
              <div
                className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-black text-white border-2 shadow-lg ${
                  getNumberColor(result) === "green"
                    ? "bg-green-700 border-green-400"
                    : getNumberColor(result) === "red"
                    ? "bg-red-700 border-red-400"
                    : "bg-[#1a1a2e] border-gray-500"
                }`}
              >
                {result}
              </div>
              <div>
                <p className="text-sm text-gray-400 uppercase tracking-wider">
                  Result
                </p>
                <p
                  className={`text-lg font-bold ${
                    lastWin > 0 ? "text-[var(--gold)]" : "text-gray-300"
                  }`}
                >
                  {message}
                </p>
              </div>
            </div>
          )}

          {/* Spinning message */}
          {spinning && (
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 bg-[var(--gold)] rounded-full animate-pulse" />
              <span className="text-sm text-gray-400 italic">No more bets...</span>
            </div>
          )}

          {/* Error messages */}
          {message && !spinning && result === null && (
            <p className="text-sm text-red-400 mb-3 animate-fade-in">{message}</p>
          )}

          {/* History */}
          {history.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap justify-center">
              <span className="text-xs text-gray-500 mr-1">History:</span>
              {history.map((n, i) => (
                <span
                  key={`${n}-${i}`}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${historyBg(n)} ${
                    i === 0 ? "ring-2 ring-[var(--gold)] scale-110" : "opacity-60"
                  } transition-all`}
                >
                  {n}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Chip selector + action buttons */}
      <div className="max-w-6xl mx-auto px-4 mb-4">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400 mr-1">Bet:</span>
            {CHIP_VALUES.map((val) => (
              <button
                key={val}
                onClick={() => setSelectedChip(val)}
                disabled={spinning}
                className={`relative w-12 h-12 rounded-full font-bold text-xs flex items-center justify-center border-2 transition-all duration-150 ${
                  selectedChip === val
                    ? "border-[var(--gold)] bg-[var(--gold)] text-black scale-110 shadow-lg shadow-[var(--gold)]/30"
                    : "border-[var(--casino-border)] bg-[var(--casino-card)] text-gray-300 hover:border-gray-500"
                } ${spinning ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
              >
                {val >= 1000 ? `${val / 1000}k` : val}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400">
              Total bet: <span className="text-white font-bold">{totalBet().toLocaleString()}</span>
            </span>
            <button
              onClick={clearBets}
              disabled={spinning || bets.size === 0}
              className="btn-casino-outline px-4 py-2 rounded-lg text-sm hover:bg-red-900/20 hover:border-red-500 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Clear Bets
            </button>
            <button
              onClick={spin}
              disabled={spinning || bets.size === 0}
              className="btn-casino px-8 py-3 rounded-xl text-base tracking-wider disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {spinning ? "Spinning..." : "SPIN"}
            </button>
          </div>
        </div>
      </div>

      {/* Roulette table layout */}
      <div className="max-w-6xl mx-auto px-4">
        <div className="felt-texture rounded-2xl border border-green-900/50 p-4 md:p-6 overflow-x-auto">
          <div className="min-w-[700px]">
            {/* Zero + Number grid */}
            <div className="flex gap-[2px]">
              <div className="flex-shrink-0">
                <button
                  onClick={() => placeBet({ kind: "straight", number: 0 })}
                  disabled={spinning}
                  className="relative w-14 h-full min-h-[132px] rounded-l-lg bg-[var(--casino-green)] border border-green-600 hover:brightness-125 transition-all flex items-center justify-center text-white font-black text-2xl disabled:cursor-not-allowed"
                >
                  0
                  {getBetAmount({ kind: "straight", number: 0 }) > 0 && (
                    <ChipBadge amount={getBetAmount({ kind: "straight", number: 0 })} />
                  )}
                </button>
              </div>
              <div className="flex-1 grid grid-rows-3 gap-[2px]">
                {TABLE_ROWS.map((row, rowIdx) => (
                  <div key={rowIdx} className="grid grid-cols-12 gap-[2px]">
                    {row.map((num) => {
                      const amt = getBetAmount({ kind: "straight", number: num });
                      return (
                        <button
                          key={num}
                          onClick={() => placeBet({ kind: "straight", number: num })}
                          disabled={spinning}
                          className={`relative h-11 rounded-sm ${numberBg(num)} border border-white/10 hover:brightness-150 hover:scale-105 transition-all flex items-center justify-center text-white font-bold text-sm disabled:cursor-not-allowed`}
                        >
                          {num}
                          {amt > 0 && <ChipBadge amount={amt} />}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
              <div className="flex-shrink-0 grid grid-rows-3 gap-[2px]">
                {([3, 2, 1] as const).map((col) => {
                  const amt = getBetAmount({ kind: "column", column: col });
                  return (
                    <button
                      key={col}
                      onClick={() => placeBet({ kind: "column", column: col })}
                      disabled={spinning}
                      className="relative w-14 h-11 rounded-r-sm bg-[var(--casino-green)]/60 border border-green-700/50 hover:brightness-125 transition-all flex items-center justify-center text-white font-bold text-xs disabled:cursor-not-allowed"
                    >
                      2:1
                      {amt > 0 && <ChipBadge amount={amt} />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dozens */}
            <div className="flex gap-[2px] mt-[2px]">
              <div className="w-14 flex-shrink-0" />
              {([1, 2, 3] as const).map((d) => {
                const amt = getBetAmount({ kind: "dozen", dozen: d });
                const label = d === 1 ? "1st 12" : d === 2 ? "2nd 12" : "3rd 12";
                return (
                  <button
                    key={d}
                    onClick={() => placeBet({ kind: "dozen", dozen: d })}
                    disabled={spinning}
                    className="relative flex-1 h-10 bg-[var(--casino-green)]/40 border border-green-700/50 rounded-sm hover:brightness-125 transition-all flex items-center justify-center text-white font-bold text-sm disabled:cursor-not-allowed"
                  >
                    {label}
                    {amt > 0 && <ChipBadge amount={amt} />}
                  </button>
                );
              })}
              <div className="w-14 flex-shrink-0" />
            </div>

            {/* Outside bets */}
            <div className="flex gap-[2px] mt-[2px]">
              <div className="w-14 flex-shrink-0" />
              <OutsideBetButton label="1-18" betType={{ kind: "low" }} getBetAmount={getBetAmount} placeBet={placeBet} spinning={spinning} extraClass="bg-[var(--casino-green)]/40 border-green-700/50" />
              <OutsideBetButton label="EVEN" betType={{ kind: "even" }} getBetAmount={getBetAmount} placeBet={placeBet} spinning={spinning} extraClass="bg-[var(--casino-green)]/40 border-green-700/50" />
              <OutsideBetButton label="RED" betType={{ kind: "red" }} getBetAmount={getBetAmount} placeBet={placeBet} spinning={spinning} extraClass="bg-[var(--casino-red)] border-red-700/50" />
              <OutsideBetButton label="BLACK" betType={{ kind: "black" }} getBetAmount={getBetAmount} placeBet={placeBet} spinning={spinning} extraClass="bg-[#1a1a2e] border-gray-600/50" />
              <OutsideBetButton label="ODD" betType={{ kind: "odd" }} getBetAmount={getBetAmount} placeBet={placeBet} spinning={spinning} extraClass="bg-[var(--casino-green)]/40 border-green-700/50" />
              <OutsideBetButton label="19-36" betType={{ kind: "high" }} getBetAmount={getBetAmount} placeBet={placeBet} spinning={spinning} extraClass="bg-[var(--casino-green)]/40 border-green-700/50" />
              <div className="w-14 flex-shrink-0" />
            </div>
          </div>
        </div>
      </div>

      {/* Active bets summary */}
      {bets.size > 0 && (
        <div className="max-w-6xl mx-auto px-4 mt-4 animate-fade-in">
          <div className="glass rounded-xl p-4">
            <h3 className="text-sm font-bold text-gray-400 mb-2">Active Bets</h3>
            <div className="flex flex-wrap gap-2">
              {Array.from(bets.values()).map((bet) => (
                <div
                  key={betKey(bet.type)}
                  className="flex items-center gap-2 bg-[var(--casino-card)] border border-[var(--casino-border)] rounded-lg px-3 py-1.5 text-sm"
                >
                  <span className="text-gray-300">{betLabel(bet.type)}</span>
                  <span className="text-[var(--gold)] font-bold">{bet.amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Payout info */}
      <div className="max-w-6xl mx-auto px-4 mt-6">
        <div className="glass rounded-xl p-4">
          <h3 className="text-sm font-bold text-gray-400 mb-3">Payouts</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
            <PayoutRow label="Straight (single #)" payout="35:1" />
            <PayoutRow label="Red / Black" payout="1:1" />
            <PayoutRow label="Odd / Even" payout="1:1" />
            <PayoutRow label="1-18 / 19-36" payout="1:1" />
            <PayoutRow label="Dozens (1st/2nd/3rd)" payout="2:1" />
            <PayoutRow label="Columns" payout="2:1" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function OutsideBetButton({
  label, betType, getBetAmount, placeBet, spinning, extraClass,
}: {
  label: string;
  betType: BetType;
  getBetAmount: (bt: BetType) => number;
  placeBet: (bt: BetType) => void;
  spinning: boolean;
  extraClass: string;
}) {
  const amt = getBetAmount(betType);
  return (
    <button
      onClick={() => placeBet(betType)}
      disabled={spinning}
      className={`relative flex-1 h-10 border rounded-sm hover:brightness-125 transition-all flex items-center justify-center text-white font-bold text-sm disabled:cursor-not-allowed ${extraClass}`}
    >
      {label}
      {amt > 0 && <ChipBadge amount={amt} />}
    </button>
  );
}

function PayoutRow({ label, payout }: { label: string; payout: string }) {
  return (
    <div className="flex items-center justify-between bg-[var(--casino-card)] rounded-lg px-3 py-2 border border-[var(--casino-border)]">
      <span className="text-gray-400">{label}</span>
      <span className="text-[var(--gold)] font-bold">{payout}</span>
    </div>
  );
}
