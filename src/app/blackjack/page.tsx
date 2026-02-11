"use client";

import { useState, useEffect, useRef } from "react";
import { useChips } from "@/context/ChipContext";
import { Card, createDeck, shuffleDeck, dealCard } from "@/lib/cards";
import PlayingCard from "@/components/PlayingCard";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GamePhase =
  | "betting"
  | "dealing"
  | "player-turn"
  | "splitting"
  | "dealer-turn"
  | "result";

type HandResult = "blackjack" | "win" | "lose" | "push" | "bust" | null;

interface Hand {
  cards: Card[];
  bet: number;
  result: HandResult;
  doubled: boolean;
  stood: boolean;
}

// ---------------------------------------------------------------------------
// Pure helpers (no hooks, no state)
// ---------------------------------------------------------------------------

function bjValue(cards: Card[]): number {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    if (!c.faceUp) continue;
    if (c.rank === "A") {
      aces += 1;
      total += 11;
    } else if (["K", "Q", "J"].includes(c.rank)) {
      total += 10;
    } else {
      total += parseInt(c.rank, 10);
    }
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return total;
}

function bjValueAll(cards: Card[]): number {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    if (c.rank === "A") {
      aces += 1;
      total += 11;
    } else if (["K", "Q", "J"].includes(c.rank)) {
      total += 10;
    } else {
      total += parseInt(c.rank, 10);
    }
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return total;
}

function isSoft(cards: Card[]): boolean {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    if (c.rank === "A") {
      aces += 1;
      total += 11;
    } else if (["K", "Q", "J"].includes(c.rank)) {
      total += 10;
    } else {
      total += parseInt(c.rank, 10);
    }
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return aces > 0 && total <= 21;
}

function isNatural(cards: Card[]): boolean {
  return cards.length === 2 && bjValueAll(cards) === 21;
}

function canSplitHand(hand: Hand): boolean {
  if (hand.cards.length !== 2) return false;
  const r1 = hand.cards[0].rank;
  const r2 = hand.cards[1].rank;
  const v1 = ["K", "Q", "J"].includes(r1) ? 10 : r1 === "A" ? 11 : parseInt(r1, 10);
  const v2 = ["K", "Q", "J"].includes(r2) ? 10 : r2 === "A" ? 11 : parseInt(r2, 10);
  return v1 === v2;
}

function handValueDisplay(cards: Card[], hideHole: boolean = false): string {
  if (hideHole) {
    const val = bjValue(cards);
    return val > 0 ? String(val) : "?";
  }
  const val = bjValueAll(cards);
  if (val === 0) return "0";
  if (cards.length === 2 && val === 21) return "Blackjack!";
  const soft = isSoft(cards);
  return soft ? `Soft ${val}` : String(val);
}

function resultLabel(result: HandResult): string {
  switch (result) {
    case "blackjack":
      return "BLACKJACK!";
    case "win":
      return "WIN!";
    case "lose":
      return "LOSE";
    case "push":
      return "PUSH";
    case "bust":
      return "BUST";
    default:
      return "";
  }
}

function resultColor(result: HandResult): string {
  switch (result) {
    case "blackjack":
      return "text-[var(--gold)]";
    case "win":
      return "text-green-400";
    case "lose":
    case "bust":
      return "text-red-400";
    case "push":
      return "text-yellow-300";
    default:
      return "text-white";
  }
}

const BET_OPTIONS = [100, 500, 1000, 5000];

function createShoe(): Card[] {
  let shoe: Card[] = [];
  for (let i = 0; i < 6; i++) {
    shoe = shoe.concat(createDeck());
  }
  return shuffleDeck(shoe);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BlackjackPage() {
  const { chips, addChips, removeChips } = useChips();

  const [shoe, setShoe] = useState<Card[]>(() => createShoe());
  const [phase, setPhase] = useState<GamePhase>("betting");
  const [currentBet, setCurrentBet] = useState<number>(0);
  const [dealerCards, setDealerCards] = useState<Card[]>([]);
  const [hands, setHands] = useState<Hand[]>([]);
  const [activeHandIndex, setActiveHandIndex] = useState<number>(0);
  const [message, setMessage] = useState<string>("");
  const [lastBet, setLastBet] = useState<number>(100);
  const [totalWinnings, setTotalWinnings] = useState<number>(0);

  // Refs for timers and latest state (to avoid stale closures in timeouts)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shoeRef = useRef(shoe);
  shoeRef.current = shoe;

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // ------ internal helpers that touch state via setters ------

  function drawCard(currentShoe: Card[], faceUp: boolean = true): { card: Card; remaining: Card[] } {
    return dealCard(currentShoe, faceUp);
  }

  function getShoe(): Card[] {
    if (shoeRef.current.length < 78) {
      const fresh = createShoe();
      setShoe(fresh);
      shoeRef.current = fresh;
      return fresh;
    }
    return shoeRef.current;
  }

  // ------ resolve game (called at end of dealer turn) ------

  function resolveGame(finalDealerCards: Card[], playerHands: Hand[]) {
    const dealerVal = bjValueAll(finalDealerCards);
    const dealerBust = dealerVal > 21;
    let totalWin = 0;

    const resolvedHands = playerHands.map((hand) => {
      if (hand.result === "bust") {
        totalWin -= hand.bet;
        return hand;
      }
      const playerVal = bjValueAll(hand.cards);

      if (dealerBust) {
        addChips(hand.bet * 2);
        totalWin += hand.bet;
        return { ...hand, result: "win" as HandResult };
      }
      if (playerVal > dealerVal) {
        addChips(hand.bet * 2);
        totalWin += hand.bet;
        return { ...hand, result: "win" as HandResult };
      }
      if (playerVal === dealerVal) {
        addChips(hand.bet);
        return { ...hand, result: "push" as HandResult };
      }
      totalWin -= hand.bet;
      return { ...hand, result: "lose" as HandResult };
    });

    setHands(resolvedHands);
    setTotalWinnings(totalWin);

    if (totalWin > 0) {
      setMessage(`You win ${totalWin.toLocaleString()} chips!`);
    } else if (totalWin < 0) {
      setMessage(`You lose ${Math.abs(totalWin).toLocaleString()} chips.`);
    } else {
      setMessage("Push! Bet returned.");
    }
    setPhase("result");
  }

  // ------ dealer turn (recursive with timeouts) ------

  function startDealerTurn(finalHands: Hand[], currentDealerCards: Card[]) {
    setPhase("dealer-turn");

    const revealed = currentDealerCards.map((c) => ({ ...c, faceUp: true }));
    setDealerCards(revealed);

    function playDealer(dCards: Card[], dShoe: Card[]) {
      const dealerVal = bjValueAll(dCards);
      if (dealerVal < 17) {
        timerRef.current = setTimeout(() => {
          const d = drawCard(dShoe, true);
          const newDCards = [...dCards, d.card];
          setDealerCards(newDCards);
          setShoe(d.remaining);
          shoeRef.current = d.remaining;
          playDealer(newDCards, d.remaining);
        }, 500);
      } else {
        timerRef.current = setTimeout(() => {
          resolveGame(dCards, finalHands);
        }, 400);
      }
    }

    timerRef.current = setTimeout(() => {
      playDealer(revealed, shoeRef.current);
    }, 400);
  }

  // ------ advance to next hand or dealer ------

  function advanceAfterHandDone(newHands: Hand[], currentIdx: number, currentDealerCards: Card[]) {
    const nextIdx = currentIdx + 1;
    if (nextIdx < newHands.length && !newHands[nextIdx].stood) {
      setActiveHandIndex(nextIdx);
      return;
    }
    // All player hands are done
    const allBust = newHands.every((h) => h.result === "bust");
    if (allBust) {
      const revealedDealer = currentDealerCards.map((c) => ({ ...c, faceUp: true }));
      setDealerCards(revealedDealer);
      setMessage("Bust! You lose!");
      setTotalWinnings(-newHands.reduce((s, h) => s + h.bet, 0));
      setPhase("result");
    } else {
      startDealerTurn(newHands, currentDealerCards);
    }
  }

  // -----------------------------------------------------------------------
  // Place bet & deal
  // -----------------------------------------------------------------------

  function placeBet(amount: number) {
    if (phase !== "betting") return;
    if (!removeChips(amount)) {
      setMessage("Not enough chips!");
      return;
    }
    setCurrentBet(amount);
    setLastBet(amount);
    setMessage("");
    setPhase("dealing");

    let curShoe = getShoe();

    const playerCards: Card[] = [];
    const dealerHand: Card[] = [];

    let d = drawCard(curShoe, true);
    playerCards.push(d.card);
    curShoe = d.remaining;

    d = drawCard(curShoe, true);
    dealerHand.push(d.card);
    curShoe = d.remaining;

    d = drawCard(curShoe, true);
    playerCards.push(d.card);
    curShoe = d.remaining;

    d = drawCard(curShoe, false);
    dealerHand.push(d.card);
    curShoe = d.remaining;

    setShoe(curShoe);
    shoeRef.current = curShoe;
    setDealerCards(dealerHand);
    setHands([{ cards: playerCards, bet: amount, result: null, doubled: false, stood: false }]);
    setActiveHandIndex(0);
    setTotalWinnings(0);

    timerRef.current = setTimeout(() => {
      const playerBJ = isNatural(playerCards);
      const dealerBJ = isNatural(dealerHand);

      if (playerBJ || dealerBJ) {
        const revealedDealer = dealerHand.map((c) => ({ ...c, faceUp: true }));
        setDealerCards(revealedDealer);

        if (playerBJ && dealerBJ) {
          setHands([{ cards: playerCards, bet: amount, result: "push", doubled: false, stood: true }]);
          addChips(amount);
          setTotalWinnings(0);
          setMessage("Both have Blackjack - Push!");
        } else if (playerBJ) {
          const winnings = Math.floor(amount * 2.5);
          setHands([{ cards: playerCards, bet: amount, result: "blackjack", doubled: false, stood: true }]);
          addChips(winnings);
          setTotalWinnings(winnings - amount);
          setMessage("Blackjack! You win!");
        } else {
          setHands([{ cards: playerCards, bet: amount, result: "lose", doubled: false, stood: true }]);
          setTotalWinnings(-amount);
          setMessage("Dealer has Blackjack!");
        }
        setPhase("result");
      } else {
        setPhase("player-turn");
      }
    }, 600);
  }

  function rebet() {
    placeBet(lastBet);
  }

  // -----------------------------------------------------------------------
  // Player actions
  // -----------------------------------------------------------------------

  function hit() {
    if (phase !== "player-turn" && phase !== "splitting") return;
    const currentHand = hands[activeHandIndex];
    if (!currentHand || currentHand.stood) return;

    let curShoe = [...shoeRef.current];
    const d = drawCard(curShoe, true);
    curShoe = d.remaining;
    setShoe(curShoe);
    shoeRef.current = curShoe;

    const newCards = [...currentHand.cards, d.card];
    const val = bjValueAll(newCards);

    const newHands = [...hands];
    newHands[activeHandIndex] = { ...currentHand, cards: newCards };

    if (val > 21) {
      newHands[activeHandIndex].result = "bust";
      newHands[activeHandIndex].stood = true;
      setHands(newHands);
      advanceAfterHandDone(newHands, activeHandIndex, dealerCards);
    } else if (val === 21) {
      newHands[activeHandIndex].stood = true;
      setHands(newHands);
      advanceAfterHandDone(newHands, activeHandIndex, dealerCards);
    } else {
      setHands(newHands);
    }
  }

  function stand() {
    if (phase !== "player-turn" && phase !== "splitting") return;
    const newHands = [...hands];
    newHands[activeHandIndex] = { ...newHands[activeHandIndex], stood: true };
    setHands(newHands);
    advanceAfterHandDone(newHands, activeHandIndex, dealerCards);
  }

  function doubleDown() {
    if (phase !== "player-turn" && phase !== "splitting") return;
    const currentHand = hands[activeHandIndex];
    if (!currentHand || currentHand.cards.length !== 2) return;

    if (!removeChips(currentHand.bet)) {
      setMessage("Not enough chips to double down!");
      return;
    }

    let curShoe = [...shoeRef.current];
    const d = drawCard(curShoe, true);
    curShoe = d.remaining;
    setShoe(curShoe);
    shoeRef.current = curShoe;

    const newCards = [...currentHand.cards, d.card];
    const val = bjValueAll(newCards);

    const newHands = [...hands];
    newHands[activeHandIndex] = {
      ...currentHand,
      cards: newCards,
      bet: currentHand.bet * 2,
      doubled: true,
      stood: true,
      result: val > 21 ? "bust" : null,
    };
    setHands(newHands);
    advanceAfterHandDone(newHands, activeHandIndex, dealerCards);
  }

  function split() {
    if (phase !== "player-turn") return;
    const currentHand = hands[activeHandIndex];
    if (!currentHand || !canSplitHand(currentHand)) return;

    if (!removeChips(currentHand.bet)) {
      setMessage("Not enough chips to split!");
      return;
    }

    let curShoe = [...shoeRef.current];
    const card1 = currentHand.cards[0];
    const card2 = currentHand.cards[1];

    let d = drawCard(curShoe, true);
    curShoe = d.remaining;
    const newCard1 = d.card;

    d = drawCard(curShoe, true);
    curShoe = d.remaining;
    const newCard2 = d.card;

    setShoe(curShoe);
    shoeRef.current = curShoe;

    const hand1: Hand = {
      cards: [card1, newCard1],
      bet: currentHand.bet,
      result: null,
      doubled: false,
      stood: false,
    };
    const hand2: Hand = {
      cards: [card2, newCard2],
      bet: currentHand.bet,
      result: null,
      doubled: false,
      stood: false,
    };

    // Split aces: one card each, auto-stand
    if (card1.rank === "A") {
      hand1.stood = true;
      hand2.stood = true;
      const newHands = [hand1, hand2];
      setHands(newHands);
      setActiveHandIndex(0);
      setPhase("splitting");
      timerRef.current = setTimeout(() => {
        startDealerTurn(newHands, dealerCards);
      }, 500);
      return;
    }

    const newHands = [...hands];
    newHands.splice(activeHandIndex, 1, hand1, hand2);
    setHands(newHands);
    setActiveHandIndex(activeHandIndex);
    setPhase("splitting");
  }

  // -----------------------------------------------------------------------
  // New round
  // -----------------------------------------------------------------------

  function newRound() {
    setPhase("betting");
    setDealerCards([]);
    setHands([]);
    setActiveHandIndex(0);
    setMessage("");
    setCurrentBet(0);
    setTotalWinnings(0);
  }

  // -----------------------------------------------------------------------
  // Derived state
  // -----------------------------------------------------------------------

  const activeHand = hands[activeHandIndex] || null;
  const playerCanHit =
    (phase === "player-turn" || phase === "splitting") &&
    activeHand !== null &&
    !activeHand.stood;
  const playerCanStand = playerCanHit;
  const playerCanDouble =
    playerCanHit &&
    activeHand !== null &&
    activeHand.cards.length === 2 &&
    chips >= activeHand.bet;
  const playerCanSplit =
    phase === "player-turn" &&
    activeHand !== null &&
    canSplitHand(activeHand) &&
    hands.length < 4 &&
    chips >= activeHand.bet;

  const dealerDisplayVal =
    phase === "result" || phase === "dealer-turn"
      ? handValueDisplay(dealerCards)
      : handValueDisplay(dealerCards, true);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header bar */}
      <div className="bg-[var(--casino-card)] border-b border-[var(--casino-border)] px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-gray-400 hover:text-white transition-colors text-sm flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Lobby
            </Link>
            <h1 className="text-xl font-bold">
              <span className="text-[var(--gold)]">Blackjack</span>
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-[var(--casino-darker)] border border-[var(--casino-border)] rounded-full px-4 py-1.5">
              <span className="text-lg">🪙</span>
              <span className="font-bold text-[var(--gold)]">{chips.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main table area */}
      <div className="flex-1 felt-texture relative flex flex-col items-center justify-center px-4 py-8 overflow-hidden">
        {/* Decorative table border */}
        <div className="absolute inset-4 md:inset-8 border-2 border-[var(--casino-green)] rounded-[40px] opacity-30 pointer-events-none" />

        {/* -------- Dealer area -------- */}
        <div className="w-full max-w-2xl mb-8 animate-fade-in">
          <div className="text-center mb-3">
            <span className="text-sm text-green-200/70 uppercase tracking-wider font-semibold">
              Dealer
            </span>
            {dealerCards.length > 0 && (
              <span className="ml-3 text-sm font-mono text-white/80 bg-black/30 rounded-full px-3 py-0.5">
                {dealerDisplayVal}
              </span>
            )}
          </div>
          <div className="flex items-center justify-center gap-2 min-h-[96px]">
            {dealerCards.map((card, i) => (
              <div
                key={`dealer-${i}`}
                className="animate-fade-in"
                style={{ animationDelay: `${i * 150}ms` }}
              >
                <PlayingCard card={card} size="md" />
              </div>
            ))}
            {dealerCards.length === 0 && (
              <div className="w-16 h-24 rounded-lg border-2 border-dashed border-green-700/40" />
            )}
          </div>
        </div>

        {/* -------- Result banner -------- */}
        {phase === "result" && (
          <div className="animate-fade-in mb-6">
            <div className="glass glow-gold rounded-2xl px-8 py-4 text-center">
              {hands.map((hand, i) => (
                <div key={`result-${i}`} className="mb-1 last:mb-0">
                  {hands.length > 1 && (
                    <span className="text-xs text-gray-400 mr-2">Hand {i + 1}:</span>
                  )}
                  <span className={`text-lg font-black ${resultColor(hand.result)}`}>
                    {resultLabel(hand.result)}
                  </span>
                </div>
              ))}
              {totalWinnings !== 0 && (
                <div
                  className={`text-sm mt-2 font-semibold ${
                    totalWinnings > 0 ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {totalWinnings > 0 ? "+" : ""}
                  {totalWinnings.toLocaleString()} chips
                </div>
              )}
            </div>
          </div>
        )}

        {/* -------- Player hands -------- */}
        <div className="w-full max-w-3xl mb-6">
          {hands.length > 0 && (
            <div className={`flex ${hands.length > 1 ? "gap-8" : ""} items-start justify-center`}>
              {hands.map((hand, handIdx) => {
                const isActive =
                  hands.length > 1 &&
                  handIdx === activeHandIndex &&
                  phase !== "result" &&
                  phase !== "dealer-turn";
                return (
                  <div
                    key={`hand-${handIdx}`}
                    className={`flex flex-col items-center animate-fade-in ${
                      isActive
                        ? "ring-2 ring-[var(--gold)] rounded-xl p-3 bg-black/20"
                        : hands.length > 1
                        ? "p-3 opacity-70"
                        : ""
                    }`}
                  >
                    {hands.length > 1 && (
                      <span className="text-xs text-green-200/50 mb-1 uppercase tracking-wider">
                        Hand {handIdx + 1}
                        {hand.doubled && " (Doubled)"}
                      </span>
                    )}
                    <div className="flex items-center justify-center gap-2 min-h-[96px]">
                      {hand.cards.map((card, cardIdx) => (
                        <div
                          key={`p-${handIdx}-${cardIdx}`}
                          className="animate-fade-in"
                          style={{ animationDelay: `${cardIdx * 150}ms` }}
                        >
                          <PlayingCard card={card} size="md" />
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-sm font-mono text-white/80 bg-black/30 rounded-full px-3 py-0.5">
                        {handValueDisplay(hand.cards)}
                      </span>
                      {hand.result && (
                        <span className={`text-xs font-bold ${resultColor(hand.result)}`}>
                          {resultLabel(hand.result)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {hands.length === 0 && phase === "betting" && (
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 min-h-[96px]">
                <div className="w-16 h-24 rounded-lg border-2 border-dashed border-green-700/40" />
                <div className="w-16 h-24 rounded-lg border-2 border-dashed border-green-700/40" />
              </div>
              <p className="text-green-200/50 text-sm mt-2">Your hand</p>
            </div>
          )}

          {hands.length > 0 && (
            <div className="text-center mt-2">
              <span className="text-sm text-green-200/70 uppercase tracking-wider font-semibold">
                Your Hand
              </span>
            </div>
          )}
        </div>

        {/* -------- Non-result messages -------- */}
        {message && phase !== "result" && (
          <div className="text-center mb-4 animate-fade-in">
            <span className="text-yellow-300 text-sm font-medium">{message}</span>
          </div>
        )}

        {/* -------- Action buttons -------- */}
        <div className="w-full max-w-lg">
          {/* Betting phase */}
          {phase === "betting" && (
            <div className="animate-fade-in">
              <p className="text-center text-green-200/70 text-sm mb-4 uppercase tracking-wider">
                Place Your Bet
              </p>
              <div className="flex items-center justify-center gap-3 flex-wrap mb-4">
                {BET_OPTIONS.map((amt) => (
                  <button
                    key={amt}
                    onClick={() => placeBet(amt)}
                    disabled={chips < amt}
                    className={`relative flex flex-col items-center justify-center w-20 h-20 rounded-full border-2 transition-all duration-200 ${
                      chips >= amt
                        ? "border-[var(--gold)] bg-gradient-to-br from-[var(--gold-dark)] to-[var(--gold)] hover:scale-110 hover:shadow-[0_0_25px_rgba(212,175,55,0.5)] active:scale-95 cursor-pointer"
                        : "border-gray-600 bg-gray-800 opacity-40 cursor-not-allowed"
                    }`}
                  >
                    <span className="text-xs text-black/50 font-bold">🪙</span>
                    <span className={`text-sm font-black ${chips >= amt ? "text-black" : "text-gray-500"}`}>
                      {amt >= 1000 ? `${amt / 1000}K` : amt}
                    </span>
                  </button>
                ))}
              </div>
              {lastBet > 0 && (
                <div className="text-center">
                  <button
                    onClick={rebet}
                    disabled={chips < lastBet}
                    className="text-[var(--gold)] hover:text-[var(--gold-light)] text-sm font-medium disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    Rebet {lastBet.toLocaleString()} 🪙
                  </button>
                </div>
              )}
              {message && (
                <p className="text-center text-red-400 text-sm mt-2">{message}</p>
              )}
            </div>
          )}

          {/* Dealing phase */}
          {phase === "dealing" && (
            <div className="text-center animate-fade-in">
              <div className="inline-flex items-center gap-2 glass rounded-full px-6 py-3">
                <div className="w-2 h-2 bg-[var(--gold)] rounded-full animate-pulse" />
                <span className="text-sm text-gray-300">Dealing...</span>
              </div>
            </div>
          )}

          {/* Player turn actions */}
          {(phase === "player-turn" || phase === "splitting") && (
            <div className="flex items-center justify-center gap-3 flex-wrap animate-fade-in">
              <button
                onClick={hit}
                disabled={!playerCanHit}
                className="px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-wider bg-gradient-to-r from-green-700 to-green-600 border border-green-500 hover:from-green-600 hover:to-green-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95 text-white shadow-lg"
              >
                Hit
              </button>
              <button
                onClick={stand}
                disabled={!playerCanStand}
                className="px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-wider bg-gradient-to-r from-red-700 to-red-600 border border-red-500 hover:from-red-600 hover:to-red-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95 text-white shadow-lg"
              >
                Stand
              </button>
              <button
                onClick={doubleDown}
                disabled={!playerCanDouble}
                className="px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-wider bg-gradient-to-r from-[var(--gold-dark)] to-[var(--gold)] border border-[var(--gold-light)] hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95 text-black font-black shadow-lg"
              >
                Double
              </button>
              {playerCanSplit && (
                <button
                  onClick={split}
                  className="px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-wider bg-gradient-to-r from-red-800 to-red-700 border border-red-500 hover:from-red-700 hover:to-red-600 transition-all hover:scale-105 active:scale-95 text-white shadow-lg"
                >
                  Split
                </button>
              )}
            </div>
          )}

          {/* Dealer turn */}
          {phase === "dealer-turn" && (
            <div className="text-center animate-fade-in">
              <div className="inline-flex items-center gap-2 glass rounded-full px-6 py-3">
                <div className="w-2 h-2 bg-[var(--gold)] rounded-full animate-pulse" />
                <span className="text-sm text-gray-300">Dealer is playing...</span>
              </div>
            </div>
          )}

          {/* Result phase */}
          {phase === "result" && (
            <div className="flex flex-col items-center gap-3 animate-fade-in">
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={rebet}
                  disabled={chips < lastBet}
                  className="px-8 py-3 rounded-xl text-sm font-bold uppercase tracking-wider bg-gradient-to-r from-green-700 to-green-600 border border-green-500 hover:from-green-600 hover:to-green-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95 text-white shadow-lg"
                >
                  Rebet {lastBet.toLocaleString()}
                </button>
                <button
                  onClick={newRound}
                  className="px-8 py-3 rounded-xl text-sm font-bold uppercase tracking-wider bg-gradient-to-r from-gray-700 to-gray-600 border border-gray-500 hover:from-gray-600 hover:to-gray-500 transition-all hover:scale-105 active:scale-95 text-white shadow-lg"
                >
                  New Bet
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Bet display pill */}
        {currentBet > 0 && phase !== "betting" && (
          <div className="mt-6 animate-fade-in">
            <div className="glass rounded-full px-5 py-2 flex items-center gap-2">
              <span className="text-sm text-gray-400">Bet:</span>
              <span className="text-[var(--gold)] font-bold">
                {hands.reduce((s, h) => s + h.bet, 0).toLocaleString()}
              </span>
              <span className="text-sm">🪙</span>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="bg-[var(--casino-card)] border-t border-[var(--casino-border)] px-4 py-2">
        <div className="max-w-5xl mx-auto flex items-center justify-between text-xs text-gray-500">
          <span>6-Deck Shoe | Dealer stands on 17 | Blackjack pays 3:2</span>
          <span>Cards remaining: {shoe.length}</span>
        </div>
      </div>
    </div>
  );
}
