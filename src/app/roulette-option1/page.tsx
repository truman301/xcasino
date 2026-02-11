"use client";

import { useState, useCallback, useRef } from "react";
import { useChips } from "@/context/ChipContext";
import dynamic from "next/dynamic";
import type { RouletteSceneHandle } from "./RouletteScene";

const RouletteScene = dynamic(() => import("./RouletteScene"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center rounded-full"
      style={{ width: 420, height: 420, background: "radial-gradient(circle, #0f0f18, #050508)" }}>
      <div className="text-gray-500 text-sm animate-pulse">Loading 3D wheel...</div>
    </div>
  ),
});

// ---------------------------------------------------------------------------
// Constants (same as main roulette page)
// ---------------------------------------------------------------------------

const RED_NUMBERS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const BLACK_NUMBERS = new Set([2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35]);
const CHIP_VALUES = [100, 500, 1000, 5000] as const;
type ChipValue = (typeof CHIP_VALUES)[number];
const COLUMN_1 = [1,4,7,10,13,16,19,22,25,28,31,34];
const COLUMN_2 = [2,5,8,11,14,17,20,23,26,29,32,35];
const COLUMN_3 = [3,6,9,12,15,18,21,24,27,30,33,36];
const TABLE_ROWS: number[][] = [COLUMN_3, COLUMN_2, COLUMN_1];

type BetType =
  | { kind: "straight"; number: number } | { kind: "red" } | { kind: "black" }
  | { kind: "odd" } | { kind: "even" } | { kind: "low" } | { kind: "high" }
  | { kind: "dozen"; dozen: 1 | 2 | 3 } | { kind: "column"; column: 1 | 2 | 3 };

interface Bet { type: BetType; amount: number; }

function betKey(bt: BetType): string {
  switch (bt.kind) {
    case "straight": return `straight-${bt.number}`;
    default: return bt.kind === "dozen" ? `dozen-${bt.dozen}` : bt.kind === "column" ? `column-${bt.column}` : bt.kind;
  }
}
function betLabel(bt: BetType): string {
  switch (bt.kind) {
    case "straight": return `#${bt.number}`; case "red": return "Red"; case "black": return "Black";
    case "odd": return "Odd"; case "even": return "Even"; case "low": return "1-18"; case "high": return "19-36";
    case "dozen": return bt.dozen === 1 ? "1st 12" : bt.dozen === 2 ? "2nd 12" : "3rd 12";
    case "column": return `Col ${bt.column}`;
  }
}
function getNumberColor(n: number): "red" | "black" | "green" {
  if (n === 0) return "green"; if (RED_NUMBERS.has(n)) return "red"; return "black";
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
    case "dozen": return result > 0 && (bt.dozen === 1 ? result <= 12 : bt.dozen === 2 ? result >= 13 && result <= 24 : result >= 25);
    case "column": return result > 0 && (bt.column === 1 ? COLUMN_1 : bt.column === 2 ? COLUMN_2 : COLUMN_3).includes(result);
  }
}
function getPayout(bt: BetType): number {
  switch (bt.kind) { case "straight": return 35; case "dozen": case "column": return 2; default: return 1; }
}
function numberBg(n: number): string {
  const c = getNumberColor(n); if (c === "green") return "bg-[var(--casino-green)]"; if (c === "red") return "bg-[var(--casino-red)]"; return "bg-[#1a1a2e]";
}
function historyBg(n: number): string {
  const c = getNumberColor(n); if (c === "green") return "bg-green-600"; if (c === "red") return "bg-red-600"; return "bg-gray-700";
}
function ChipBadge({ amount }: { amount: number }) {
  return (
    <span className="absolute -top-1 -right-1 min-w-[20px] h-5 flex items-center justify-center rounded-full bg-[var(--gold)] text-[10px] font-bold text-black px-1 shadow-md z-10 pointer-events-none">
      {amount >= 1000 ? `${amount / 1000}k` : amount}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function RouletteOption1Page() {
  const { chips, addChips, removeChips } = useChips();
  const [selectedChip, setSelectedChip] = useState<ChipValue>(100);
  const [bets, setBets] = useState<Map<string, Bet>>(new Map());
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const [message, setMessage] = useState<string>("");
  const [lastWin, setLastWin] = useState<number>(0);
  const wheelRef = useRef<RouletteSceneHandle>(null);

  const totalBet = useCallback(() => { let t = 0; bets.forEach((b) => { t += b.amount; }); return t; }, [bets]);

  const placeBet = useCallback((bt: BetType) => {
    if (spinning) return;
    const key = betKey(bt); const existing = bets.get(key); const cur = existing ? existing.amount : 0;
    const ok = removeChips(selectedChip); if (!ok) { setMessage("Not enough chips!"); return; }
    setBets((prev) => { const n = new Map(prev); n.set(key, { type: bt, amount: cur + selectedChip }); return n; });
    setMessage("");
  }, [spinning, bets, selectedChip, removeChips]);

  const clearBets = useCallback(() => {
    if (spinning) return; let r = 0; bets.forEach((b) => { r += b.amount; });
    if (r > 0) addChips(r); setBets(new Map()); setMessage(""); setLastWin(0);
  }, [spinning, bets, addChips]);

  const spin = useCallback(async () => {
    if (spinning) return; if (bets.size === 0) { setMessage("Place at least one bet!"); return; }
    setSpinning(true); setMessage(""); setResult(null); setLastWin(0);
    const winningNumber = Math.floor(Math.random() * 37);
    const spinDuration = 4500 + Math.random() * 1500;
    if (wheelRef.current) { await wheelRef.current.spin(winningNumber, spinDuration); }
    else { await new Promise((r) => setTimeout(r, spinDuration)); }
    setResult(winningNumber);
    let totalWinnings = 0;
    bets.forEach((bet) => { if (doesBetWin(bet.type, winningNumber)) { totalWinnings += bet.amount + bet.amount * getPayout(bet.type); } });
    if (totalWinnings > 0) { addChips(totalWinnings); setLastWin(totalWinnings); setMessage(`Winner! +${totalWinnings.toLocaleString()} chips`); }
    else { setMessage(`No luck. The ball landed on ${winningNumber}.`); }
    setHistory((prev) => [winningNumber, ...prev].slice(0, 10)); setBets(new Map()); setSpinning(false);
  }, [spinning, bets, addChips]);

  const getBetAmount = (bt: BetType): number => bets.get(betKey(bt))?.amount ?? 0;

  return (
    <div className="min-h-screen pb-20 animate-fade-in">
      <div className="max-w-6xl mx-auto px-4 pt-6 pb-4">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">
            <span className="text-[var(--gold)]">Roulette</span>
            <span className="text-gray-500 text-sm ml-3 font-normal">Option 1: R3F + Environment Map</span>
          </h1>
          <div className="glass rounded-full px-5 py-2 flex items-center gap-2">
            <span className="text-xl">🪙</span>
            <span className="text-xl font-bold text-[var(--gold)]">{chips.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 mb-6">
        <div className="rounded-2xl p-4 md:p-8 flex flex-col items-center justify-center" style={{ background: "radial-gradient(ellipse at 50% 40%, rgba(15,15,24,0.95), rgba(5,5,8,0.98))" }}>
          <div className="mb-4 scale-[0.72] sm:scale-[0.85] md:scale-100 origin-center">
            <RouletteScene ref={wheelRef} size={420} />
          </div>

          {result !== null && !spinning && (
            <div className="animate-fade-in mb-3 flex items-center gap-3">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-black text-white border-2 shadow-lg ${
                getNumberColor(result) === "green" ? "bg-green-700 border-green-400" : getNumberColor(result) === "red" ? "bg-red-700 border-red-400" : "bg-[#1a1a2e] border-gray-500"
              }`}>{result}</div>
              <div>
                <p className="text-sm text-gray-400 uppercase tracking-wider">Result</p>
                <p className={`text-lg font-bold ${lastWin > 0 ? "text-[var(--gold)]" : "text-gray-300"}`}>{message}</p>
              </div>
            </div>
          )}
          {spinning && (
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 bg-[var(--gold)] rounded-full animate-pulse" />
              <span className="text-sm text-gray-400 italic">No more bets...</span>
            </div>
          )}
          {message && !spinning && result === null && <p className="text-sm text-red-400 mb-3 animate-fade-in">{message}</p>}
          {history.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap justify-center">
              <span className="text-xs text-gray-500 mr-1">History:</span>
              {history.map((n, i) => (
                <span key={`${n}-${i}`} className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${historyBg(n)} ${i === 0 ? "ring-2 ring-[var(--gold)] scale-110" : "opacity-60"} transition-all`}>{n}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 mb-4">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400 mr-1">Bet:</span>
            {CHIP_VALUES.map((val) => (
              <button key={val} onClick={() => setSelectedChip(val)} disabled={spinning}
                className={`relative w-12 h-12 rounded-full font-bold text-xs flex items-center justify-center border-2 transition-all duration-150 ${selectedChip === val ? "border-[var(--gold)] bg-[var(--gold)] text-black scale-110 shadow-lg shadow-[var(--gold)]/30" : "border-[var(--casino-border)] bg-[var(--casino-card)] text-gray-300 hover:border-gray-500"} ${spinning ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
                {val >= 1000 ? `${val / 1000}k` : val}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400">Total bet: <span className="text-white font-bold">{totalBet().toLocaleString()}</span></span>
            <button onClick={clearBets} disabled={spinning || bets.size === 0} className="btn-casino-outline px-4 py-2 rounded-lg text-sm hover:bg-red-900/20 hover:border-red-500 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed">Clear Bets</button>
            <button onClick={spin} disabled={spinning || bets.size === 0} className="btn-casino px-8 py-3 rounded-xl text-base tracking-wider disabled:opacity-30 disabled:cursor-not-allowed">{spinning ? "Spinning..." : "SPIN"}</button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4">
        <div className="felt-texture rounded-2xl border border-green-900/50 p-4 md:p-6 overflow-x-auto">
          <div className="min-w-[700px]">
            <div className="flex gap-[2px]">
              <div className="flex-shrink-0">
                <button onClick={() => placeBet({ kind: "straight", number: 0 })} disabled={spinning}
                  className="relative w-14 h-full min-h-[132px] rounded-l-lg bg-[var(--casino-green)] border border-green-600 hover:brightness-125 transition-all flex items-center justify-center text-white font-black text-2xl disabled:cursor-not-allowed">
                  0{getBetAmount({ kind: "straight", number: 0 }) > 0 && <ChipBadge amount={getBetAmount({ kind: "straight", number: 0 })} />}
                </button>
              </div>
              <div className="flex-1 grid grid-rows-3 gap-[2px]">
                {TABLE_ROWS.map((row, rowIdx) => (
                  <div key={rowIdx} className="grid grid-cols-12 gap-[2px]">
                    {row.map((num) => {
                      const amt = getBetAmount({ kind: "straight", number: num });
                      return (
                        <button key={num} onClick={() => placeBet({ kind: "straight", number: num })} disabled={spinning}
                          className={`relative h-11 rounded-sm ${numberBg(num)} border border-white/10 hover:brightness-150 hover:scale-105 transition-all flex items-center justify-center text-white font-bold text-sm disabled:cursor-not-allowed`}>
                          {num}{amt > 0 && <ChipBadge amount={amt} />}
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
                    <button key={col} onClick={() => placeBet({ kind: "column", column: col })} disabled={spinning}
                      className="relative w-14 h-11 rounded-r-sm bg-[var(--casino-green)]/60 border border-green-700/50 hover:brightness-125 transition-all flex items-center justify-center text-white font-bold text-xs disabled:cursor-not-allowed">
                      2:1{amt > 0 && <ChipBadge amount={amt} />}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex gap-[2px] mt-[2px]">
              <div className="w-14 flex-shrink-0" />
              {([1, 2, 3] as const).map((d) => {
                const amt = getBetAmount({ kind: "dozen", dozen: d });
                return (
                  <button key={d} onClick={() => placeBet({ kind: "dozen", dozen: d })} disabled={spinning}
                    className="relative flex-1 h-10 bg-[var(--casino-green)]/40 border border-green-700/50 rounded-sm hover:brightness-125 transition-all flex items-center justify-center text-white font-bold text-sm disabled:cursor-not-allowed">
                    {d === 1 ? "1st 12" : d === 2 ? "2nd 12" : "3rd 12"}{amt > 0 && <ChipBadge amount={amt} />}
                  </button>
                );
              })}
              <div className="w-14 flex-shrink-0" />
            </div>
            <div className="flex gap-[2px] mt-[2px]">
              <div className="w-14 flex-shrink-0" />
              {[
                { label: "1-18", bt: { kind: "low" as const }, cls: "bg-[var(--casino-green)]/40 border-green-700/50" },
                { label: "EVEN", bt: { kind: "even" as const }, cls: "bg-[var(--casino-green)]/40 border-green-700/50" },
                { label: "RED", bt: { kind: "red" as const }, cls: "bg-[var(--casino-red)] border-red-700/50" },
                { label: "BLACK", bt: { kind: "black" as const }, cls: "bg-[#1a1a2e] border-gray-600/50" },
                { label: "ODD", bt: { kind: "odd" as const }, cls: "bg-[var(--casino-green)]/40 border-green-700/50" },
                { label: "19-36", bt: { kind: "high" as const }, cls: "bg-[var(--casino-green)]/40 border-green-700/50" },
              ].map(({ label, bt, cls }) => {
                const amt = getBetAmount(bt);
                return (
                  <button key={label} onClick={() => placeBet(bt)} disabled={spinning}
                    className={`relative flex-1 h-10 border rounded-sm hover:brightness-125 transition-all flex items-center justify-center text-white font-bold text-sm disabled:cursor-not-allowed ${cls}`}>
                    {label}{amt > 0 && <ChipBadge amount={amt} />}
                  </button>
                );
              })}
              <div className="w-14 flex-shrink-0" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
