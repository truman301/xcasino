"use client";

import { useState, useCallback, useRef } from "react";
import { useChips } from "@/context/ChipContext";
import { useSound } from "@/hooks/useSound";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CHIP_VALUES = [100, 500, 1000, 5000] as const;
type ChipValue = (typeof CHIP_VALUES)[number];

// Provably fair RNG
function secureRandom(): number {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return arr[0] / (0xffffffff + 1);
}

function rollDie(): number {
  return Math.floor(secureRandom() * 6) + 1;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BetType = "pass" | "dontPass" | "field" | "come" | "dontCome";
type GamePhase = "comeOut" | "point";

interface ActiveBet {
  type: BetType;
  amount: number;
  point?: number; // for come/dontCome bets that have established a point
}

interface RollResult {
  dice: [number, number];
  total: number;
  betsResolved: { type: string; amount: number; won: boolean; payout: number }[];
  timestamp: number;
}

// Dice face SVG — renders pips for a single die
function DieFace({ value, size = 56, color = "white" }: { value: number; size?: number; color?: string }) {
  const p: Record<number, [number, number][]> = {
    1: [[28, 28]],
    2: [[14, 14], [42, 42]],
    3: [[14, 14], [28, 28], [42, 42]],
    4: [[14, 14], [42, 14], [14, 42], [42, 42]],
    5: [[14, 14], [42, 14], [28, 28], [14, 42], [42, 42]],
    6: [[14, 14], [42, 14], [14, 28], [42, 28], [14, 42], [42, 42]],
  };
  const pips = p[value] || [];
  return (
    <svg width={size} height={size} viewBox="0 0 56 56">
      <rect x="1" y="1" width="54" height="54" rx="8" fill={color === "red" ? "#c41e1e" : "#1a1a2e"}
        stroke={color === "red" ? "#a01818" : "#333"} strokeWidth="2" />
      {pips.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="5" fill={color === "red" ? "#fff" : "#e8e8e8"} />
      ))}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Payout rules
// ---------------------------------------------------------------------------

// Field bet pays: 3,4,9,10,11 = 1:1; 2 = 2:1; 12 = 3:1; else lose
function fieldPayout(total: number, bet: number): number {
  if (total === 2) return bet * 3; // 2:1 + original
  if (total === 12) return bet * 4; // 3:1 + original
  if ([3, 4, 9, 10, 11].includes(total)) return bet * 2; // 1:1 + original
  return 0;
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function CrapsPage() {
  const { chips, addChips, removeChips } = useChips();
  const { play } = useSound();

  const [selectedChip, setSelectedChip] = useState<ChipValue>(100);
  const [rolling, setRolling] = useState(false);
  const [message, setMessage] = useState("Place your bets and roll!");
  const [history, setHistory] = useState<RollResult[]>([]);

  // Dice display
  const [dice, setDice] = useState<[number, number]>([0, 0]);
  const [lastWon, setLastWon] = useState<boolean | null>(null);
  const rollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Game state
  const [phase, setPhase] = useState<GamePhase>("comeOut");
  const [point, setPoint] = useState<number | null>(null);
  const [bets, setBets] = useState<ActiveBet[]>([]);

  // Pending bets placed before rolling (not yet resolved)
  const [pendingBets, setPendingBets] = useState<ActiveBet[]>([]);

  // ---------------------------------------------------------------------------
  // Place a bet
  // ---------------------------------------------------------------------------
  const placeBet = useCallback(
    (type: BetType) => {
      if (rolling) return;

      // Restrictions based on phase
      if (phase === "point" && (type === "pass" || type === "dontPass")) {
        setMessage("Pass/Don't Pass bets can only be placed on the come-out roll.");
        return;
      }
      if (phase === "comeOut" && (type === "come" || type === "dontCome")) {
        setMessage("Come/Don't Come bets require a point to be established first.");
        return;
      }

      const ok = removeChips(selectedChip);
      if (!ok) {
        setMessage("Not enough chips!");
        return;
      }

      play("bet");

      const newBet: ActiveBet = { type, amount: selectedChip };
      setPendingBets((prev) => {
        // Stack same bet types
        const existing = prev.find((b) => b.type === type && !b.point);
        if (existing) {
          return prev.map((b) =>
            b === existing ? { ...b, amount: b.amount + selectedChip } : b
          );
        }
        return [...prev, newBet];
      });
      setMessage(`${selectedChip.toLocaleString()} on ${betLabel(type)}!`);
    },
    [rolling, selectedChip, phase, removeChips, play]
  );

  // ---------------------------------------------------------------------------
  // Roll the dice
  // ---------------------------------------------------------------------------
  const doRoll = useCallback(() => {
    if (rolling) return;

    // Must have at least one bet
    const allBets = [...bets, ...pendingBets];
    if (allBets.length === 0) {
      setMessage("Place a bet first!");
      return;
    }

    setRolling(true);
    setLastWon(null);
    setMessage("");
    play("roll");

    // Animate dice for ~800ms
    let ticks = 0;
    rollIntervalRef.current = setInterval(() => {
      setDice([
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
      ]);
      ticks++;
      if (ticks > 16) {
        clearInterval(rollIntervalRef.current!);

        // Final result
        const d1 = rollDie();
        const d2 = rollDie();
        const total = d1 + d2;
        setDice([d1, d2]);

        // Merge pending into active
        const activeBets = [...bets, ...pendingBets];
        setPendingBets([]);

        // Resolve bets
        const resolved: RollResult["betsResolved"] = [];
        const survivingBets: ActiveBet[] = [];
        let totalPayout = 0;
        let anyWin = false;
        let anyLoss = false;

        for (const bet of activeBets) {
          switch (bet.type) {
            case "pass": {
              if (phase === "comeOut") {
                if (total === 7 || total === 11) {
                  // Natural — win
                  const payout = bet.amount * 2;
                  totalPayout += payout;
                  anyWin = true;
                  resolved.push({ type: "Pass Line", amount: bet.amount, won: true, payout });
                } else if (total === 2 || total === 3 || total === 12) {
                  // Craps — lose
                  anyLoss = true;
                  resolved.push({ type: "Pass Line", amount: bet.amount, won: false, payout: 0 });
                } else {
                  // Point established — bet carries over
                  survivingBets.push(bet);
                }
              } else {
                // Point phase
                if (total === point) {
                  // Hit the point — win
                  const payout = bet.amount * 2;
                  totalPayout += payout;
                  anyWin = true;
                  resolved.push({ type: "Pass Line", amount: bet.amount, won: true, payout });
                } else if (total === 7) {
                  // Seven-out — lose
                  anyLoss = true;
                  resolved.push({ type: "Pass Line", amount: bet.amount, won: false, payout: 0 });
                } else {
                  survivingBets.push(bet);
                }
              }
              break;
            }
            case "dontPass": {
              if (phase === "comeOut") {
                if (total === 2 || total === 3) {
                  const payout = bet.amount * 2;
                  totalPayout += payout;
                  anyWin = true;
                  resolved.push({ type: "Don't Pass", amount: bet.amount, won: true, payout });
                } else if (total === 12) {
                  // Push — return bet
                  totalPayout += bet.amount;
                  resolved.push({ type: "Don't Pass (push)", amount: bet.amount, won: false, payout: bet.amount });
                } else if (total === 7 || total === 11) {
                  anyLoss = true;
                  resolved.push({ type: "Don't Pass", amount: bet.amount, won: false, payout: 0 });
                } else {
                  survivingBets.push(bet);
                }
              } else {
                if (total === 7) {
                  const payout = bet.amount * 2;
                  totalPayout += payout;
                  anyWin = true;
                  resolved.push({ type: "Don't Pass", amount: bet.amount, won: true, payout });
                } else if (total === point) {
                  anyLoss = true;
                  resolved.push({ type: "Don't Pass", amount: bet.amount, won: false, payout: 0 });
                } else {
                  survivingBets.push(bet);
                }
              }
              break;
            }
            case "come": {
              if (bet.point) {
                // Come bet with established point
                if (total === bet.point) {
                  const payout = bet.amount * 2;
                  totalPayout += payout;
                  anyWin = true;
                  resolved.push({ type: `Come (${bet.point})`, amount: bet.amount, won: true, payout });
                } else if (total === 7) {
                  anyLoss = true;
                  resolved.push({ type: `Come (${bet.point})`, amount: bet.amount, won: false, payout: 0 });
                } else {
                  survivingBets.push(bet);
                }
              } else {
                // Fresh come bet — works like come-out
                if (total === 7 || total === 11) {
                  const payout = bet.amount * 2;
                  totalPayout += payout;
                  anyWin = true;
                  resolved.push({ type: "Come", amount: bet.amount, won: true, payout });
                } else if (total === 2 || total === 3 || total === 12) {
                  anyLoss = true;
                  resolved.push({ type: "Come", amount: bet.amount, won: false, payout: 0 });
                } else {
                  // Establish come point
                  survivingBets.push({ ...bet, point: total });
                }
              }
              break;
            }
            case "dontCome": {
              if (bet.point) {
                if (total === 7) {
                  const payout = bet.amount * 2;
                  totalPayout += payout;
                  anyWin = true;
                  resolved.push({ type: `Don't Come (${bet.point})`, amount: bet.amount, won: true, payout });
                } else if (total === bet.point) {
                  anyLoss = true;
                  resolved.push({ type: `Don't Come (${bet.point})`, amount: bet.amount, won: false, payout: 0 });
                } else {
                  survivingBets.push(bet);
                }
              } else {
                if (total === 2 || total === 3) {
                  const payout = bet.amount * 2;
                  totalPayout += payout;
                  anyWin = true;
                  resolved.push({ type: "Don't Come", amount: bet.amount, won: true, payout });
                } else if (total === 12) {
                  totalPayout += bet.amount;
                  resolved.push({ type: "Don't Come (push)", amount: bet.amount, won: false, payout: bet.amount });
                } else if (total === 7 || total === 11) {
                  anyLoss = true;
                  resolved.push({ type: "Don't Come", amount: bet.amount, won: false, payout: 0 });
                } else {
                  survivingBets.push({ ...bet, point: total });
                }
              }
              break;
            }
            case "field": {
              const payout = fieldPayout(total, bet.amount);
              if (payout > 0) {
                totalPayout += payout;
                anyWin = true;
                resolved.push({ type: "Field", amount: bet.amount, won: true, payout });
              } else {
                anyLoss = true;
                resolved.push({ type: "Field", amount: bet.amount, won: false, payout: 0 });
              }
              break;
            }
          }
        }

        // Update phase
        if (phase === "comeOut") {
          if (total === 7 || total === 11 || total === 2 || total === 3 || total === 12) {
            // Stay in comeOut
            setPhase("comeOut");
            setPoint(null);
          } else {
            // Point established
            setPhase("point");
            setPoint(total);
          }
        } else {
          // Point phase
          if (total === point || total === 7) {
            // Back to come-out
            setPhase("comeOut");
            setPoint(null);
          }
        }

        // Pay out
        if (totalPayout > 0) {
          addChips(totalPayout);
        }

        // Sound
        if (anyWin && !anyLoss) {
          play(totalPayout >= 5000 ? "bigWin" : "win");
        } else if (anyLoss && !anyWin) {
          play("lose");
        } else if (anyWin) {
          play("win");
        }

        // Build message
        const msgs: string[] = [`Rolled ${total} (${d1} + ${d2})`];
        if (phase === "comeOut" && ![7, 11, 2, 3, 12].includes(total)) {
          msgs.push(`Point is ${total}`);
        }
        if (phase === "point" && total === point) {
          msgs.push("Point hit!");
        }
        if (phase === "point" && total === 7) {
          msgs.push("Seven out!");
        }
        for (const r of resolved) {
          if (r.won) {
            msgs.push(`${r.type}: +${r.payout.toLocaleString()}`);
          } else if (r.payout > 0) {
            msgs.push(`${r.type}: push`);
          } else {
            msgs.push(`${r.type}: lost`);
          }
        }

        setMessage(msgs.join(" | "));
        setLastWon(anyWin ? true : anyLoss ? false : null);
        setBets(survivingBets);

        setHistory((prev) =>
          [{ dice: [d1, d2] as [number, number], total, betsResolved: resolved, timestamp: Date.now() }, ...prev].slice(0, 20)
        );
        setRolling(false);
      }
    }, 50);
  }, [rolling, bets, pendingBets, phase, point, addChips, play]);

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function betLabel(type: BetType): string {
    switch (type) {
      case "pass": return "Pass Line";
      case "dontPass": return "Don't Pass";
      case "field": return "Field";
      case "come": return "Come";
      case "dontCome": return "Don't Come";
    }
  }

  function totalBetOn(type: BetType): number {
    return [...bets, ...pendingBets]
      .filter((b) => b.type === type)
      .reduce((sum, b) => sum + b.amount, 0);
  }

  // Clear pending bets (return chips)
  const clearPendingBets = useCallback(() => {
    if (rolling) return;
    let refund = 0;
    for (const b of pendingBets) refund += b.amount;
    if (refund > 0) addChips(refund);
    setPendingBets([]);
    setMessage("Bets cleared.");
  }, [rolling, pendingBets, addChips]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const allBets = [...bets, ...pendingBets];
  const hasBets = allBets.length > 0;

  return (
    <div className="min-h-screen pb-20 animate-fade-in">
      {/* Header */}
      <div className="max-w-4xl mx-auto px-4 pt-6 pb-4">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">
            <span className="text-[var(--gold)]">Craps</span>
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
          {/* Phase + Point indicator */}
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className={`px-4 py-2 rounded-full text-sm font-bold border ${
              phase === "comeOut"
                ? "border-[var(--gold)]/50 bg-[var(--gold)]/10 text-[var(--gold)]"
                : "border-blue-500/50 bg-blue-500/10 text-blue-400"
            }`}>
              {phase === "comeOut" ? "COME-OUT ROLL" : `POINT: ${point}`}
            </div>
            {point !== null && (
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-500">Target:</span>
                <span className="text-lg font-black text-white">{point}</span>
              </div>
            )}
          </div>

          {/* Dice Display */}
          <div className="flex flex-col items-center mb-6">
            <div className={`flex gap-4 mb-4 ${rolling ? "animate-pulse" : ""}`}>
              {dice[0] > 0 ? (
                <>
                  <DieFace value={dice[0]} color={lastWon === false ? "red" : "white"} />
                  <DieFace value={dice[1]} color={lastWon === false ? "red" : "white"} />
                </>
              ) : (
                <>
                  <div className="w-14 h-14 rounded-lg border-2 border-dashed border-gray-700 flex items-center justify-center text-gray-600">?</div>
                  <div className="w-14 h-14 rounded-lg border-2 border-dashed border-gray-700 flex items-center justify-center text-gray-600">?</div>
                </>
              )}
            </div>

            {dice[0] > 0 && !rolling && (
              <p className={`text-3xl font-black mb-1 ${
                lastWon === true ? "text-green-400" : lastWon === false ? "text-red-400" : "text-white"
              }`}>
                {dice[0] + dice[1]}
              </p>
            )}

            {/* Result message */}
            {message && !rolling && (
              <p className={`text-sm font-bold text-center max-w-lg ${
                lastWon === true ? "text-green-400" : lastWon === false ? "text-red-400" : "text-gray-400"
              }`}>
                {message}
              </p>
            )}

            {rolling && (
              <p className="text-sm text-gray-400 italic animate-pulse">Rolling...</p>
            )}
          </div>

          {/* Betting Table */}
          <div className="max-w-xl mx-auto">
            {/* Main bets */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              {/* Pass Line */}
              <button
                onClick={() => placeBet("pass")}
                disabled={rolling || phase === "point"}
                className={`relative rounded-xl p-4 text-center border-2 transition-all ${
                  totalBetOn("pass") > 0
                    ? "border-green-500 bg-green-900/20 shadow-lg shadow-green-900/20"
                    : "border-[var(--casino-border)] bg-[var(--casino-card)] hover:border-green-700"
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                <p className="text-sm font-bold text-white">PASS LINE</p>
                <p className="text-[10px] text-gray-500">7, 11 win | 2, 3, 12 lose</p>
                {totalBetOn("pass") > 0 && (
                  <span className="absolute top-1 right-2 text-xs font-bold text-[var(--gold)]">
                    {totalBetOn("pass").toLocaleString()}
                  </span>
                )}
              </button>

              {/* Don't Pass */}
              <button
                onClick={() => placeBet("dontPass")}
                disabled={rolling || phase === "point"}
                className={`relative rounded-xl p-4 text-center border-2 transition-all ${
                  totalBetOn("dontPass") > 0
                    ? "border-red-500 bg-red-900/20 shadow-lg shadow-red-900/20"
                    : "border-[var(--casino-border)] bg-[var(--casino-card)] hover:border-red-700"
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                <p className="text-sm font-bold text-white">DON&apos;T PASS</p>
                <p className="text-[10px] text-gray-500">2, 3 win | 7, 11 lose | 12 push</p>
                {totalBetOn("dontPass") > 0 && (
                  <span className="absolute top-1 right-2 text-xs font-bold text-[var(--gold)]">
                    {totalBetOn("dontPass").toLocaleString()}
                  </span>
                )}
              </button>
            </div>

            {/* Come / Don't Come / Field */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <button
                onClick={() => placeBet("come")}
                disabled={rolling || phase === "comeOut"}
                className={`relative rounded-xl p-3 text-center border-2 transition-all ${
                  totalBetOn("come") > 0
                    ? "border-green-500 bg-green-900/20"
                    : "border-[var(--casino-border)] bg-[var(--casino-card)] hover:border-green-700"
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                <p className="text-xs font-bold text-white">COME</p>
                {totalBetOn("come") > 0 && (
                  <span className="text-[10px] font-bold text-[var(--gold)]">
                    {totalBetOn("come").toLocaleString()}
                  </span>
                )}
              </button>

              <button
                onClick={() => placeBet("field")}
                disabled={rolling}
                className={`relative rounded-xl p-3 text-center border-2 transition-all ${
                  totalBetOn("field") > 0
                    ? "border-[var(--gold)] bg-amber-900/20"
                    : "border-[var(--casino-border)] bg-[var(--casino-card)] hover:border-[var(--gold)]/50"
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                <p className="text-xs font-bold text-white">FIELD</p>
                <p className="text-[9px] text-gray-500">2,3,4,9,10,11,12</p>
                {totalBetOn("field") > 0 && (
                  <span className="text-[10px] font-bold text-[var(--gold)]">
                    {totalBetOn("field").toLocaleString()}
                  </span>
                )}
              </button>

              <button
                onClick={() => placeBet("dontCome")}
                disabled={rolling || phase === "comeOut"}
                className={`relative rounded-xl p-3 text-center border-2 transition-all ${
                  totalBetOn("dontCome") > 0
                    ? "border-red-500 bg-red-900/20"
                    : "border-[var(--casino-border)] bg-[var(--casino-card)] hover:border-red-700"
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                <p className="text-xs font-bold text-white">DON&apos;T COME</p>
                {totalBetOn("dontCome") > 0 && (
                  <span className="text-[10px] font-bold text-[var(--gold)]">
                    {totalBetOn("dontCome").toLocaleString()}
                  </span>
                )}
              </button>
            </div>

            {/* Active bets summary */}
            {(bets.length > 0) && (
              <div className="mb-4 p-3 rounded-xl bg-[var(--casino-card)] border border-[var(--casino-border)]">
                <p className="text-xs text-gray-500 mb-2 font-bold">Active Bets (from previous rolls)</p>
                <div className="flex flex-wrap gap-2">
                  {bets.map((b, i) => (
                    <span key={i} className="text-xs bg-white/5 border border-white/10 rounded-lg px-2 py-1">
                      <span className="text-gray-400">{betLabel(b.type)}</span>
                      {b.point && <span className="text-blue-400 ml-1">({b.point})</span>}
                      <span className="text-[var(--gold)] ml-1 font-bold">{b.amount.toLocaleString()}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

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
                  } ${rolling ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  {val >= 1000 ? `${val / 1000}k` : val}
                </button>
              ))}
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={doRoll}
                disabled={rolling || !hasBets}
                className="flex-1 btn-casino py-4 rounded-xl text-xl tracking-wider disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {rolling ? "Rolling..." : "🎲 ROLL"}
              </button>
              {pendingBets.length > 0 && !rolling && (
                <button
                  onClick={clearPendingBets}
                  className="px-4 py-4 rounded-xl border border-red-900/50 text-red-400 text-sm font-bold hover:bg-red-900/20 transition-all"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Roll History */}
      {history.length > 0 && (
        <div className="max-w-4xl mx-auto px-4 mt-6">
          <div className="glass rounded-xl p-4">
            <h3 className="text-sm font-bold text-gray-400 mb-3">Recent Rolls</h3>
            <div className="flex flex-wrap gap-2">
              {history.map((r, i) => {
                const anyWin = r.betsResolved.some((b) => b.won);
                const anyLose = r.betsResolved.some((b) => !b.won && b.payout === 0);
                return (
                  <div
                    key={r.timestamp}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm border ${
                      anyWin && !anyLose
                        ? "bg-green-900/20 border-green-800/50"
                        : anyLose && !anyWin
                        ? "bg-red-900/20 border-red-800/50"
                        : "bg-gray-900/20 border-gray-700/50"
                    } ${i === 0 ? "ring-1 ring-[var(--gold)]" : "opacity-70"}`}
                  >
                    <span
                      className={`font-black text-lg ${
                        anyWin ? "text-green-400" : anyLose ? "text-red-400" : "text-gray-400"
                      }`}
                    >
                      {r.total}
                    </span>
                    <span className="text-gray-600 text-xs">
                      ({r.dice[0]}+{r.dice[1]})
                    </span>
                    {r.betsResolved.some((b) => b.payout > 0) && (
                      <span className="text-[var(--gold)] font-bold text-xs">
                        +{r.betsResolved.reduce((s, b) => s + b.payout, 0).toLocaleString()}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* How to play */}
      <div className="max-w-4xl mx-auto px-4 mt-6">
        <div className="glass rounded-xl p-4">
          <h3 className="text-sm font-bold text-gray-400 mb-3">How to Play</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="bg-[var(--casino-card)] rounded-lg px-3 py-2 border border-[var(--casino-border)]">
              <span className="text-[var(--gold)] font-bold">Pass Line:</span>{" "}
              <span className="text-gray-400">
                Win on 7/11 come-out. Point established on 4-6, 8-10. Hit point to win, 7 to lose.
              </span>
            </div>
            <div className="bg-[var(--casino-card)] rounded-lg px-3 py-2 border border-[var(--casino-border)]">
              <span className="text-[var(--gold)] font-bold">Don&apos;t Pass:</span>{" "}
              <span className="text-gray-400">
                Opposite of Pass. Win on 2/3 come-out, push on 12. Win on 7 in point phase.
              </span>
            </div>
            <div className="bg-[var(--casino-card)] rounded-lg px-3 py-2 border border-[var(--casino-border)]">
              <span className="text-[var(--gold)] font-bold">Field:</span>{" "}
              <span className="text-gray-400">
                One-roll bet. Wins on 2 (2:1), 12 (3:1), 3, 4, 9, 10, 11 (1:1).
              </span>
            </div>
            <div className="bg-[var(--casino-card)] rounded-lg px-3 py-2 border border-[var(--casino-border)]">
              <span className="text-[var(--gold)] font-bold">Come/Don&apos;t Come:</span>{" "}
              <span className="text-gray-400">
                Like Pass/Don&apos;t Pass but placed during point phase. Gets its own point.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
