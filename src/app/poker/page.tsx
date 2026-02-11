"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useChips } from "@/context/ChipContext";
import {
  Card,
  Rank,
  createDeck,
  shuffleDeck,
  RANK_VALUES,
} from "@/lib/cards";
import PlayingCard from "@/components/PlayingCard";
import Link from "next/link";

// ─── Types ──────────────────────────────────────────────────────────────────────

interface Player {
  id: number;
  name: string;
  cards: Card[];
  chipStack: number;
  currentBet: number;
  folded: boolean;
  isAllIn: boolean;
  isBot: boolean;
  isDealer: boolean;
  seatIndex: number;
  hasActedThisRound: boolean;
}

type GamePhase =
  | "idle"
  | "preflop"
  | "flop"
  | "turn"
  | "river"
  | "showdown"
  | "hand-over";

type PlayerAction = "fold" | "check" | "call" | "raise" | "all-in";

interface HandResult {
  rank: number;
  rankName: string;
  values: number[];
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const NUM_PLAYERS = 6;
const SMALL_BLIND = 50;
const BIG_BLIND = 100;
const BOT_STARTING_CHIPS = 5000;
const BOT_DELAY_MS = 900;

const BOT_NAMES = [
  "Lucky Lou",
  "Bluff King",
  "Ace Alice",
  "Wild Card",
  "Snake Eyes",
];

// ─── Hand Evaluator ─────────────────────────────────────────────────────────────

function getRankValue(rank: Rank): number {
  return RANK_VALUES[rank];
}

function getCombinations(arr: Card[], k: number): Card[][] {
  const results: Card[][] = [];
  function combine(start: number, combo: Card[]) {
    if (combo.length === k) {
      results.push([...combo]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      combo.push(arr[i]);
      combine(i + 1, combo);
      combo.pop();
    }
  }
  combine(0, []);
  return results;
}

function evaluateFiveCards(cards: Card[]): HandResult {
  const values = cards
    .map((c) => getRankValue(c.rank))
    .sort((a, b) => b - a);
  const suits = cards.map((c) => c.suit);

  const isFlush = suits.every((s) => s === suits[0]);

  // Straight check
  let isStraight = false;
  let straightHigh = 0;
  const uniqueVals = [...new Set(values)].sort((a, b) => b - a);

  if (uniqueVals.length === 5) {
    if (uniqueVals[0] - uniqueVals[4] === 4) {
      isStraight = true;
      straightHigh = uniqueVals[0];
    }
    // Ace-low straight: A-2-3-4-5
    if (
      uniqueVals[0] === 14 &&
      uniqueVals[1] === 5 &&
      uniqueVals[2] === 4 &&
      uniqueVals[3] === 3 &&
      uniqueVals[4] === 2
    ) {
      isStraight = true;
      straightHigh = 5;
    }
  }

  // Count rank occurrences
  const counts: Record<number, number> = {};
  for (const v of values) {
    counts[v] = (counts[v] || 0) + 1;
  }

  const groups = Object.entries(counts)
    .map(([val, count]) => ({ val: parseInt(val), count }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return b.val - a.val;
    });

  const maxCount = groups[0]?.count || 0;
  const secondMaxCount = groups[1]?.count || 0;

  // Royal flush
  if (isFlush && isStraight && straightHigh === 14) {
    return { rank: 9, rankName: "Royal Flush", values: [14] };
  }

  // Straight flush
  if (isFlush && isStraight) {
    return { rank: 8, rankName: "Straight Flush", values: [straightHigh] };
  }

  // Four of a kind
  if (maxCount === 4) {
    const quadVal = groups[0].val;
    const kicker = groups[1].val;
    return { rank: 7, rankName: "Four of a Kind", values: [quadVal, kicker] };
  }

  // Full house
  if (maxCount === 3 && secondMaxCount >= 2) {
    return {
      rank: 6,
      rankName: "Full House",
      values: [groups[0].val, groups[1].val],
    };
  }

  // Flush
  if (isFlush) {
    return { rank: 5, rankName: "Flush", values: values.slice(0, 5) };
  }

  // Straight
  if (isStraight) {
    return { rank: 4, rankName: "Straight", values: [straightHigh] };
  }

  // Three of a kind
  if (maxCount === 3) {
    const tripVal = groups[0].val;
    const kickers = groups
      .filter((g) => g.count !== 3)
      .map((g) => g.val)
      .sort((a, b) => b - a)
      .slice(0, 2);
    return {
      rank: 3,
      rankName: "Three of a Kind",
      values: [tripVal, ...kickers],
    };
  }

  // Two pair
  if (maxCount === 2 && secondMaxCount === 2) {
    const pairVals = groups
      .filter((g) => g.count === 2)
      .map((g) => g.val)
      .sort((a, b) => b - a);
    const kicker = groups
      .filter((g) => g.count === 1)
      .map((g) => g.val)
      .sort((a, b) => b - a)[0] || 0;
    return { rank: 2, rankName: "Two Pair", values: [...pairVals, kicker] };
  }

  // One pair
  if (maxCount === 2) {
    const pairVal = groups[0].val;
    const kickers = groups
      .filter((g) => g.count === 1)
      .map((g) => g.val)
      .sort((a, b) => b - a)
      .slice(0, 3);
    return { rank: 1, rankName: "One Pair", values: [pairVal, ...kickers] };
  }

  // High card
  return { rank: 0, rankName: "High Card", values: values.slice(0, 5) };
}

function evaluateBestHand(
  holeCards: Card[],
  communityCards: Card[]
): HandResult {
  const allCards = [...holeCards, ...communityCards];
  if (allCards.length < 5) {
    const values = allCards
      .map((c) => getRankValue(c.rank))
      .sort((a, b) => b - a);
    return { rank: 0, rankName: "High Card", values };
  }

  const combos = getCombinations(allCards, 5);
  let best: HandResult | null = null;

  for (const combo of combos) {
    const result = evaluateFiveCards(combo);
    if (!best || compareHands(result, best) > 0) {
      best = result;
    }
  }

  return best!;
}

function compareHands(a: HandResult, b: HandResult): number {
  if (a.rank !== b.rank) return a.rank - b.rank;
  for (let i = 0; i < Math.min(a.values.length, b.values.length); i++) {
    if (a.values[i] !== b.values[i]) return a.values[i] - b.values[i];
  }
  return 0;
}

// ─── Bot AI ─────────────────────────────────────────────────────────────────────

function evaluatePreflopStrength(cards: Card[]): number {
  const v1 = getRankValue(cards[0].rank);
  const v2 = getRankValue(cards[1].rank);
  const high = Math.max(v1, v2);
  const low = Math.min(v1, v2);
  const isPair = v1 === v2;
  const isSuited = cards[0].suit === cards[1].suit;
  const gap = high - low;

  let score = 0;
  if (isPair) {
    score = high * 2 + 20;
  } else {
    score = high + low * 0.6;
    if (isSuited) score += 4;
    if (gap <= 2) score += 3;
    if (gap <= 4) score += 1;
  }
  return score;
}

function botDecision(
  bot: Player,
  communityCards: Card[],
  currentHighBet: number,
  pot: number,
  phase: GamePhase
): { action: PlayerAction; raiseAmount?: number } {
  const callAmount = currentHighBet - bot.currentBet;
  const random = Math.random();

  // ~20% bluff/random factor
  if (random < 0.08) {
    const raiseAmt = Math.min(
      BIG_BLIND * (2 + Math.floor(Math.random() * 3)),
      bot.chipStack
    );
    if (raiseAmt > callAmount && bot.chipStack >= raiseAmt) {
      return { action: "raise", raiseAmount: currentHighBet + raiseAmt };
    }
  }
  if (random < 0.12 && callAmount > 0 && callAmount <= bot.chipStack) {
    return { action: "call" };
  }

  if (phase === "preflop") {
    const strength = evaluatePreflopStrength(bot.cards);

    if (strength >= 40) {
      const raiseAmt = BIG_BLIND * (3 + Math.floor(Math.random() * 3));
      return {
        action: "raise",
        raiseAmount: Math.min(
          currentHighBet + raiseAmt,
          bot.chipStack + bot.currentBet
        ),
      };
    } else if (strength >= 28) {
      if (callAmount <= BIG_BLIND * 3) {
        if (random < 0.4) {
          return {
            action: "raise",
            raiseAmount: Math.min(
              currentHighBet + BIG_BLIND * 3,
              bot.chipStack + bot.currentBet
            ),
          };
        }
        return callAmount > 0 ? { action: "call" } : { action: "check" };
      }
      if (callAmount <= BIG_BLIND * 6 && callAmount <= bot.chipStack) {
        return { action: "call" };
      }
      return callAmount === 0 ? { action: "check" } : { action: "fold" };
    } else if (strength >= 18) {
      if (callAmount === 0) return { action: "check" };
      if (callAmount <= BIG_BLIND * 2 && callAmount <= bot.chipStack) {
        return { action: "call" };
      }
      return { action: "fold" };
    } else {
      if (callAmount === 0) return { action: "check" };
      return { action: "fold" };
    }
  }

  // Post-flop evaluation
  const handResult = evaluateBestHand(bot.cards, communityCards);
  const handRank = handResult.rank;

  if (handRank >= 6) {
    const raiseAmt = Math.min(pot + BIG_BLIND * 4, bot.chipStack);
    return {
      action: "raise",
      raiseAmount: currentHighBet + raiseAmt,
    };
  } else if (handRank >= 4) {
    if (random < 0.7) {
      const raiseAmt = Math.min(
        Math.floor(pot * 0.6) + BIG_BLIND * 2,
        bot.chipStack
      );
      return {
        action: "raise",
        raiseAmount: currentHighBet + raiseAmt,
      };
    }
    return callAmount > 0 && callAmount <= bot.chipStack
      ? { action: "call" }
      : { action: "check" };
  } else if (handRank >= 2) {
    if (random < 0.5) {
      const raiseAmt = Math.min(
        Math.floor(pot * 0.4) + BIG_BLIND,
        bot.chipStack
      );
      return {
        action: "raise",
        raiseAmount: currentHighBet + raiseAmt,
      };
    }
    return callAmount > 0 && callAmount <= bot.chipStack
      ? { action: "call" }
      : { action: "check" };
  } else if (handRank === 1) {
    if (callAmount === 0) {
      if (random < 0.3) {
        const raiseAmt = Math.min(BIG_BLIND * 2, bot.chipStack);
        return {
          action: "raise",
          raiseAmount: currentHighBet + raiseAmt,
        };
      }
      return { action: "check" };
    }
    if (callAmount <= pot * 0.5 && callAmount <= bot.chipStack) {
      return { action: "call" };
    }
    if (callAmount <= BIG_BLIND * 3 && callAmount <= bot.chipStack) {
      return { action: "call" };
    }
    return { action: "fold" };
  } else {
    if (callAmount === 0) return { action: "check" };
    if (callAmount <= BIG_BLIND && random < 0.3 && callAmount <= bot.chipStack) {
      return { action: "call" };
    }
    return { action: "fold" };
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function findNextActivePlayer(
  players: Player[],
  fromIdx: number
): number {
  let idx = (fromIdx + 1) % NUM_PLAYERS;
  let safety = 0;
  while (safety < NUM_PLAYERS) {
    if (!players[idx].folded && !players[idx].isAllIn) {
      return idx;
    }
    idx = (idx + 1) % NUM_PLAYERS;
    safety++;
  }
  return -1; // No active players
}

function isBettingRoundComplete(players: Player[], highBet: number): boolean {
  const canAct = players.filter((p) => !p.folded && !p.isAllIn);
  if (canAct.length === 0) return true;
  return canAct.every((p) => p.hasActedThisRound && p.currentBet === highBet);
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export default function PokerPage() {
  const { chips, addChips, removeChips, username } = useChips();

  const [players, setPlayers] = useState<Player[]>([]);
  const [communityCards, setCommunityCards] = useState<Card[]>([]);
  const [pot, setPot] = useState(0);
  const [phase, setPhase] = useState<GamePhase>("idle");
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(-1);
  const [dealerIndex, setDealerIndex] = useState(-1);
  const [deck, setDeck] = useState<Card[]>([]);
  const [highestBet, setHighestBet] = useState(0);
  const [raiseAmount, setRaiseAmount] = useState(BIG_BLIND * 2);
  const [message, setMessage] = useState(
    "Welcome to Texas Hold'em! Hit Deal Hand to begin."
  );
  const [showdownResults, setShowdownResults] = useState<
    { playerId: number; hand: HandResult; cards: Card[] }[]
  >([]);
  const [winnerId, setWinnerId] = useState<number | null>(null);
  const [winAmount, setWinAmount] = useState(0);
  const [lastAction, setLastAction] = useState<Record<number, string>>({});
  const [minRaise, setMinRaise] = useState(BIG_BLIND);
  const [isProcessing, setIsProcessing] = useState(false);

  const botTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refs to hold latest state for use in timeouts
  const stateRef = useRef({
    players,
    pot,
    deck,
    communityCards,
    phase,
    highestBet,
    minRaise,
    currentPlayerIndex,
    isProcessing,
  });
  stateRef.current = {
    players,
    pot,
    deck,
    communityCards,
    phase,
    highestBet,
    minRaise,
    currentPlayerIndex,
    isProcessing,
  };

  // ─── Seat positions around the oval ─────────────────────────────────────────
  const seatPositions = [
    { top: "85%", left: "50%" },  // Seat 0: Player (bottom center)
    { top: "70%", left: "8%" },   // Seat 1
    { top: "20%", left: "8%" },   // Seat 2
    { top: "5%", left: "50%" },   // Seat 3
    { top: "20%", left: "92%" },  // Seat 4
    { top: "70%", left: "92%" },  // Seat 5
  ];

  // ─── Create fresh player list ─────────────────────────────────────────────────

  const createPlayers = useCallback(
    (existingPlayers?: Player[]): Player[] => {
      if (existingPlayers && existingPlayers.length === NUM_PLAYERS) {
        return existingPlayers.map((p) => ({
          ...p,
          cards: [],
          currentBet: 0,
          folded: false,
          isAllIn: false,
          isDealer: false,
          hasActedThisRound: false,
          chipStack: p.isBot
            ? p.chipStack <= 0
              ? BOT_STARTING_CHIPS
              : p.chipStack
            : chips,
        }));
      }
      return [
        {
          id: 0,
          name: username || "You",
          cards: [],
          chipStack: chips,
          currentBet: 0,
          folded: false,
          isAllIn: false,
          isBot: false,
          isDealer: false,
          seatIndex: 0,
          hasActedThisRound: false,
        },
        ...BOT_NAMES.map((name, i) => ({
          id: i + 1,
          name,
          cards: [],
          chipStack: BOT_STARTING_CHIPS,
          currentBet: 0,
          folded: false,
          isAllIn: false,
          isBot: true,
          isDealer: false,
          seatIndex: i + 1,
          hasActedThisRound: false,
        })),
      ];
    },
    [chips, username]
  );

  // ─── Handle awarding the winner ────────────────────────────────────────────────

  const awardWinner = useCallback(
    (
      winnerPlayerId: number,
      totalPot: number,
      finalPlayers: Player[],
      results?: { playerId: number; hand: HandResult; cards: Card[] }[]
    ) => {
      setWinnerId(winnerPlayerId);
      setWinAmount(totalPot);
      setPhase("hand-over");
      setCurrentPlayerIndex(-1);

      const updatedPlayers = finalPlayers.map((p) => {
        if (p.id === winnerPlayerId) {
          return { ...p, chipStack: p.chipStack + totalPot };
        }
        return p;
      });

      if (winnerPlayerId === 0) {
        addChips(totalPot);
      }

      setPlayers(updatedPlayers);

      const winner = updatedPlayers.find((p) => p.id === winnerPlayerId);
      if (results && results.length > 0) {
        const result = results.find((r) => r.playerId === winnerPlayerId);
        setMessage(
          `${winner?.name} wins ${totalPot.toLocaleString()} chips with ${result?.hand.rankName || "best hand"}!`
        );
      } else {
        setMessage(
          `${winner?.name} wins ${totalPot.toLocaleString()} chips! Everyone else folded.`
        );
      }
    },
    [addChips]
  );

  // ─── Run showdown ──────────────────────────────────────────────────────────────

  const runShowdown = useCallback(
    (
      currentPlayers: Player[],
      currentPot: number,
      currentDeck: Card[],
      currentCommunity: Card[]
    ) => {
      // Deal remaining community cards
      let finalDeck = [...currentDeck];
      let finalCommunity = [...currentCommunity];
      while (finalCommunity.length < 5) {
        finalDeck = finalDeck.slice(1); // burn
        if (finalDeck.length === 0) break;
        finalCommunity.push({ ...finalDeck[0], faceUp: true });
        finalDeck = finalDeck.slice(1);
      }

      setDeck(finalDeck);
      setCommunityCards(finalCommunity);

      const activePlayers = currentPlayers.filter((p) => !p.folded);
      const results = activePlayers.map((p) => ({
        playerId: p.id,
        hand: evaluateBestHand(p.cards, finalCommunity),
        cards: p.cards.map((c) => ({ ...c, faceUp: true })),
      }));
      results.sort((a, b) => compareHands(b.hand, a.hand));

      // Flip all active players' cards face up
      const finalPlayers = currentPlayers.map((p) => ({
        ...p,
        cards: p.cards.map((c) =>
          !p.folded ? { ...c, faceUp: true } : c
        ),
      }));

      setPlayers(finalPlayers);
      setShowdownResults(results);
      setPhase("showdown");
      setCurrentPlayerIndex(-1);

      const winnerName = finalPlayers.find(
        (p) => p.id === results[0].playerId
      )?.name;
      setMessage(
        `Showdown! ${winnerName} wins with ${results[0].hand.rankName}!`
      );

      setTimeout(() => {
        awardWinner(results[0].playerId, currentPot, finalPlayers, results);
      }, 2500);
    },
    [awardWinner]
  );

  // ─── Advance to next phase ────────────────────────────────────────────────────

  const advancePhase = useCallback(
    (
      currentPlayers: Player[],
      currentPot: number,
      currentDeck: Card[],
      currentCommunity: Card[],
      currentPhase: GamePhase
    ) => {
      // Reset bets and hasActed for new betting round
      const newPlayers = currentPlayers.map((p) => ({
        ...p,
        currentBet: 0,
        hasActedThisRound: false,
      }));

      // Check if only one player remains
      const active = newPlayers.filter((p) => !p.folded);
      if (active.length <= 1) {
        if (active.length === 1) {
          awardWinner(active[0].id, currentPot, newPlayers);
        }
        return;
      }

      // Check if all active players are all-in
      const canStillBet = active.filter((p) => !p.isAllIn);

      let newDeck = [...currentDeck];
      let newCommunity = [...currentCommunity];
      let nextPhase: GamePhase = currentPhase;

      switch (currentPhase) {
        case "preflop":
          newDeck = newDeck.slice(1); // burn
          for (let i = 0; i < 3; i++) {
            newCommunity.push({ ...newDeck[0], faceUp: true });
            newDeck = newDeck.slice(1);
          }
          nextPhase = "flop";
          break;
        case "flop":
          newDeck = newDeck.slice(1);
          newCommunity.push({ ...newDeck[0], faceUp: true });
          newDeck = newDeck.slice(1);
          nextPhase = "turn";
          break;
        case "turn":
          newDeck = newDeck.slice(1);
          newCommunity.push({ ...newDeck[0], faceUp: true });
          newDeck = newDeck.slice(1);
          nextPhase = "river";
          break;
        case "river":
          nextPhase = "showdown";
          break;
      }

      setDeck(newDeck);
      setCommunityCards(newCommunity);
      setHighestBet(0);
      setMinRaise(BIG_BLIND);
      setLastAction({});
      setPlayers(newPlayers);

      // If showdown or everyone all-in, run showdown
      if (nextPhase === "showdown" || canStillBet.length <= 1) {
        runShowdown(newPlayers, currentPot, newDeck, newCommunity);
        return;
      }

      setPhase(nextPhase);

      // First to act: first active player after dealer
      const dealerPos = newPlayers.findIndex((p) => p.isDealer);
      const firstToAct = findNextActivePlayer(newPlayers, dealerPos);

      if (firstToAct === -1) {
        runShowdown(newPlayers, currentPot, newDeck, newCommunity);
        return;
      }

      setCurrentPlayerIndex(firstToAct);
      setIsProcessing(false);

      const phaseLabels: Record<string, string> = {
        flop: "Flop",
        turn: "Turn",
        river: "River",
      };
      setMessage(`${phaseLabels[nextPhase] || nextPhase} dealt!`);
    },
    [awardWinner, runShowdown]
  );

  // ─── Execute an action for a given player ─────────────────────────────────────

  const executeAction = useCallback(
    (
      playerIdx: number,
      action: PlayerAction,
      amount: number,
      currentPlayers: Player[],
      currentPot: number,
      currentHighBet: number,
      currentMinRaise: number,
      currentDeck: Card[],
      currentCommunity: Card[],
      currentPhase: GamePhase
    ) => {
      const newPlayers = currentPlayers.map((p) => ({ ...p }));
      let newPot = currentPot;
      let newHighBet = currentHighBet;
      let newMinRaise = currentMinRaise;
      const player = newPlayers[playerIdx];

      player.hasActedThisRound = true;

      switch (action) {
        case "fold":
          player.folded = true;
          setLastAction((prev) => ({ ...prev, [player.id]: "Fold" }));
          break;

        case "check":
          setLastAction((prev) => ({ ...prev, [player.id]: "Check" }));
          break;

        case "call": {
          const callAmt = Math.min(
            newHighBet - player.currentBet,
            player.chipStack
          );
          player.chipStack -= callAmt;
          player.currentBet += callAmt;
          newPot += callAmt;
          if (player.chipStack === 0) player.isAllIn = true;
          if (playerIdx === 0) removeChips(callAmt);
          setLastAction((prev) => ({
            ...prev,
            [player.id]: `Call ${callAmt}`,
          }));
          break;
        }

        case "raise": {
          const totalBet = Math.min(amount, player.chipStack + player.currentBet);
          const additionalChips = totalBet - player.currentBet;
          player.chipStack -= additionalChips;
          newPot += additionalChips;
          player.currentBet = totalBet;
          if (player.chipStack === 0) player.isAllIn = true;

          const raiseOver = totalBet - newHighBet;
          if (raiseOver > newMinRaise) newMinRaise = raiseOver;
          newHighBet = totalBet;

          // When someone raises, everyone else needs to act again
          for (const p of newPlayers) {
            if (p.id !== player.id && !p.folded && !p.isAllIn) {
              p.hasActedThisRound = false;
            }
          }

          if (playerIdx === 0) removeChips(additionalChips);
          setLastAction((prev) => ({
            ...prev,
            [player.id]: `Raise to ${totalBet}`,
          }));
          break;
        }

        case "all-in": {
          const allInAmt = player.chipStack;
          const newBet = player.currentBet + allInAmt;
          newPot += allInAmt;
          if (newBet > newHighBet) {
            const raiseOver = newBet - newHighBet;
            if (raiseOver > newMinRaise) newMinRaise = raiseOver;
            newHighBet = newBet;
            // Re-open action for others
            for (const p of newPlayers) {
              if (p.id !== player.id && !p.folded && !p.isAllIn) {
                p.hasActedThisRound = false;
              }
            }
          }
          player.chipStack = 0;
          player.currentBet = newBet;
          player.isAllIn = true;
          if (playerIdx === 0) removeChips(allInAmt);
          setLastAction((prev) => ({
            ...prev,
            [player.id]: `All-In ${allInAmt}`,
          }));
          break;
        }
      }

      // Check if only one player remains (everyone else folded)
      const activePlayers = newPlayers.filter((p) => !p.folded);
      if (activePlayers.length <= 1) {
        setPlayers(newPlayers);
        setPot(newPot);
        if (activePlayers.length === 1) {
          awardWinner(activePlayers[0].id, newPot, newPlayers);
        }
        return;
      }

      // Check if betting round is complete
      const roundDone = isBettingRoundComplete(newPlayers, newHighBet);

      setPlayers(newPlayers);
      setPot(newPot);
      setHighestBet(newHighBet);
      setMinRaise(newMinRaise);

      if (roundDone) {
        setIsProcessing(true);
        setTimeout(() => {
          advancePhase(
            newPlayers,
            newPot,
            currentDeck,
            currentCommunity,
            currentPhase
          );
        }, 600);
        return;
      }

      // Move to next player
      const nextIdx = findNextActivePlayer(newPlayers, playerIdx);
      if (nextIdx === -1) {
        // No one else can act
        setIsProcessing(true);
        setTimeout(() => {
          advancePhase(
            newPlayers,
            newPot,
            currentDeck,
            currentCommunity,
            currentPhase
          );
        }, 600);
        return;
      }

      setCurrentPlayerIndex(nextIdx);
      setIsProcessing(false);
    },
    [removeChips, awardWinner, advancePhase]
  );

  // ─── Start a new hand ─────────────────────────────────────────────────────────

  const startNewHand = useCallback(() => {
    if (chips < BIG_BLIND) {
      setMessage(
        `Not enough chips! You need at least ${BIG_BLIND} to play.`
      );
      return;
    }

    const newDealerIdx = (dealerIndex + 1) % NUM_PLAYERS;
    setDealerIndex(newDealerIdx);

    const newPlayers = createPlayers(
      players.length === NUM_PLAYERS ? players : undefined
    );
    newPlayers[newDealerIdx].isDealer = true;

    // Shuffle and deal
    let currentDeck = shuffleDeck(createDeck());
    for (let round = 0; round < 2; round++) {
      for (let i = 0; i < NUM_PLAYERS; i++) {
        const card = currentDeck[0];
        currentDeck = currentDeck.slice(1);
        newPlayers[i].cards.push({
          ...card,
          faceUp: i === 0, // Only player sees their cards
        });
      }
    }

    // Post blinds
    const sbIdx = (newDealerIdx + 1) % NUM_PLAYERS;
    const bbIdx = (newDealerIdx + 2) % NUM_PLAYERS;

    const sbAmt = Math.min(SMALL_BLIND, newPlayers[sbIdx].chipStack);
    const bbAmt = Math.min(BIG_BLIND, newPlayers[bbIdx].chipStack);

    newPlayers[sbIdx].chipStack -= sbAmt;
    newPlayers[sbIdx].currentBet = sbAmt;
    if (newPlayers[sbIdx].chipStack === 0) newPlayers[sbIdx].isAllIn = true;

    newPlayers[bbIdx].chipStack -= bbAmt;
    newPlayers[bbIdx].currentBet = bbAmt;
    if (newPlayers[bbIdx].chipStack === 0) newPlayers[bbIdx].isAllIn = true;

    // Blinds don't count as "having acted" for betting round purposes
    // because they haven't had a chance to decide yet
    // BB has option to raise pre-flop

    if (sbIdx === 0) removeChips(sbAmt);
    if (bbIdx === 0) removeChips(bbAmt);

    const totalPot = sbAmt + bbAmt;
    const firstToAct = (bbIdx + 1) % NUM_PLAYERS;

    setDeck(currentDeck);
    setPlayers(newPlayers);
    setPot(totalPot);
    setCommunityCards([]);
    setHighestBet(BIG_BLIND);
    setMinRaise(BIG_BLIND);
    setPhase("preflop");
    setShowdownResults([]);
    setWinnerId(null);
    setWinAmount(0);
    setLastAction({});
    setIsProcessing(false);
    setRaiseAmount(BIG_BLIND * 2);
    setCurrentPlayerIndex(firstToAct);

    setMessage(
      `${newPlayers[sbIdx].name} posts SB (${sbAmt}), ${newPlayers[bbIdx].name} posts BB (${bbAmt})`
    );
  }, [chips, dealerIndex, createPlayers, players, removeChips]);

  // ─── Handle player action ─────────────────────────────────────────────────────

  const handlePlayerAction = useCallback(
    (action: PlayerAction, amount: number = 0) => {
      if (currentPlayerIndex !== 0 || isProcessing) return;
      if (
        phase === "idle" ||
        phase === "showdown" ||
        phase === "hand-over"
      )
        return;

      setIsProcessing(true);

      executeAction(
        0,
        action,
        amount,
        players,
        pot,
        highestBet,
        minRaise,
        deck,
        communityCards,
        phase
      );
    },
    [
      currentPlayerIndex,
      isProcessing,
      phase,
      players,
      pot,
      highestBet,
      minRaise,
      deck,
      communityCards,
      executeAction,
    ]
  );

  // ─── Bot turn processing ──────────────────────────────────────────────────────

  useEffect(() => {
    if (
      phase === "idle" ||
      phase === "showdown" ||
      phase === "hand-over"
    )
      return;
    if (currentPlayerIndex < 0 || currentPlayerIndex >= players.length)
      return;
    if (isProcessing) return;

    const currentPlayer = players[currentPlayerIndex];
    if (!currentPlayer || !currentPlayer.isBot) return;
    if (currentPlayer.folded || currentPlayer.isAllIn) {
      // Skip this player
      const nextIdx = findNextActivePlayer(players, currentPlayerIndex);
      if (nextIdx === -1 || isBettingRoundComplete(players, highestBet)) {
        setIsProcessing(true);
        setTimeout(() => {
          advancePhase(players, pot, deck, communityCards, phase);
        }, 400);
      } else {
        setCurrentPlayerIndex(nextIdx);
      }
      return;
    }

    botTimerRef.current = setTimeout(() => {
      // Re-check state from refs (it may have changed)
      const s = stateRef.current;
      if (
        s.phase === "idle" ||
        s.phase === "showdown" ||
        s.phase === "hand-over"
      )
        return;
      if (s.isProcessing) return;

      setIsProcessing(true);

      const decision = botDecision(
        currentPlayer,
        s.communityCards,
        s.highestBet,
        s.pot,
        s.phase
      );

      let action = decision.action;
      let amount = decision.raiseAmount || 0;

      // Validate action
      const callAmt = s.highestBet - currentPlayer.currentBet;

      if (action === "call" && callAmt === 0) {
        action = "check";
      }
      if (action === "raise") {
        const minTotal = s.highestBet + s.minRaise;
        amount = Math.max(amount, minTotal);
        amount = Math.min(
          amount,
          currentPlayer.chipStack + currentPlayer.currentBet
        );
        if (amount <= s.highestBet) {
          action = callAmt > 0 ? "call" : "check";
        }
      }
      if (action === "call" && callAmt >= currentPlayer.chipStack) {
        action = "all-in";
      }

      executeAction(
        currentPlayerIndex,
        action,
        amount,
        s.players,
        s.pot,
        s.highestBet,
        s.minRaise,
        s.deck,
        s.communityCards,
        s.phase
      );
    }, BOT_DELAY_MS);

    return () => {
      if (botTimerRef.current) clearTimeout(botTimerRef.current);
    };
  }, [
    currentPlayerIndex,
    phase,
    isProcessing,
    players,
    highestBet,
    pot,
    deck,
    communityCards,
    minRaise,
    advancePhase,
    executeAction,
  ]);

  // ─── Computed values ──────────────────────────────────────────────────────────

  const playerData = players[0];
  const isPlayerTurn =
    currentPlayerIndex === 0 &&
    !isProcessing &&
    phase !== "idle" &&
    phase !== "showdown" &&
    phase !== "hand-over";
  const callAmount = playerData
    ? Math.min(
        highestBet - (playerData.currentBet || 0),
        playerData.chipStack || 0
      )
    : 0;
  const canCheck = callAmount === 0;
  const minRaiseTotal = highestBet + minRaise;
  const maxRaise = playerData
    ? playerData.chipStack + (playerData.currentBet || 0)
    : 0;
  const isActive =
    phase !== "idle" && phase !== "showdown" && phase !== "hand-over";

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen pt-20 pb-8 px-4">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-gray-400 hover:text-white transition-colors text-sm"
            >
              &larr; Lobby
            </Link>
            <h1 className="text-2xl font-bold">
              <span className="text-[var(--gold)]">Texas</span> Hold&apos;em
            </h1>
          </div>
          <div className="glass rounded-full px-4 py-2 flex items-center gap-2">
            <span className="text-lg">🪙</span>
            <span className="font-bold text-[var(--gold)]">
              {chips.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Main Table Area */}
      <div className="max-w-6xl mx-auto">
        <div
          className="relative w-full"
          style={{ paddingBottom: "58%" }}
        >
          {/* Oval Felt Table */}
          <div
            className="absolute inset-4 md:inset-8 rounded-[50%] felt-texture border-4 border-[var(--casino-border)]"
            style={{
              boxShadow:
                "inset 0 0 60px rgba(0,0,0,0.5), 0 0 40px rgba(0,0,0,0.5), 0 0 80px rgba(13,94,46,0.3)",
            }}
          >
            {/* Inner rim */}
            <div className="absolute inset-3 md:inset-6 rounded-[50%] border-2 border-[rgba(255,255,255,0.08)]" />

            {/* Center: Pot + Community Cards */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 z-10">
              {pot > 0 && (
                <div className="glass rounded-full px-4 py-2 animate-fade-in flex items-center gap-2">
                  <span className="text-xs text-gray-400">Pot</span>
                  <span className="text-lg font-bold text-[var(--gold)]">
                    {pot.toLocaleString()}
                  </span>
                </div>
              )}

              {/* Community Cards */}
              <div className="flex gap-1 md:gap-2 mt-1">
                {communityCards.map((card, i) => (
                  <div key={i} className="animate-fade-in">
                    <PlayingCard card={card} size="sm" />
                  </div>
                ))}
                {isActive &&
                  Array.from({
                    length: 5 - communityCards.length,
                  }).map((_, i) => (
                    <div
                      key={`slot-${i}`}
                      className="w-12 h-[4.5rem] rounded-lg border border-dashed border-[rgba(255,255,255,0.1)]"
                    />
                  ))}
              </div>

              {isActive && (
                <span className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">
                  {phase}
                </span>
              )}
            </div>
          </div>

          {/* Player Seats */}
          {players.map((player) => {
            const pos = seatPositions[player.seatIndex];
            const isCurrent = currentPlayerIndex === player.id && isActive;
            const isWinner =
              winnerId === player.id && phase === "hand-over";

            return (
              <div
                key={player.id}
                className="absolute transform -translate-x-1/2 -translate-y-1/2 z-20"
                style={{ top: pos.top, left: pos.left }}
              >
                <div
                  className={`flex flex-col items-center gap-0.5 transition-all duration-300 ${
                    player.folded ? "opacity-40" : ""
                  }`}
                >
                  {/* Player cards */}
                  {player.cards.length > 0 && (
                    <div className="flex -space-x-3 mb-0.5">
                      {player.cards.map((card, ci) => (
                        <div
                          key={ci}
                          className="transition-transform duration-300"
                        >
                          <PlayingCard card={card} size="sm" />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Player info badge */}
                  <div
                    className={`glass rounded-xl px-3 py-1.5 text-center min-w-[90px] transition-all duration-300 ${
                      isCurrent
                        ? "ring-2 ring-[var(--gold)] glow-gold"
                        : ""
                    } ${isWinner ? "ring-2 ring-green-400" : ""}`}
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      {player.isDealer && (
                        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[var(--gold)] text-black text-[10px] font-bold shrink-0">
                          D
                        </span>
                      )}
                      <span
                        className={`text-xs font-semibold truncate max-w-[70px] ${
                          player.id === 0
                            ? "text-[var(--gold)]"
                            : "text-white"
                        }`}
                      >
                        {player.name}
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-400">
                      {player.chipStack.toLocaleString()}
                    </div>

                    {player.currentBet > 0 && (
                      <div className="text-[10px] text-yellow-400 font-semibold">
                        Bet: {player.currentBet}
                      </div>
                    )}

                    {lastAction[player.id] && isActive && (
                      <div
                        className={`text-[10px] font-medium ${
                          lastAction[player.id]?.includes("Fold")
                            ? "text-red-400"
                            : lastAction[player.id]?.includes("Raise") ||
                              lastAction[player.id]?.includes("All-In")
                            ? "text-green-400"
                            : "text-blue-400"
                        }`}
                      >
                        {lastAction[player.id]}
                      </div>
                    )}

                    {player.folded && (
                      <div className="text-[10px] text-red-500 font-bold">
                        FOLDED
                      </div>
                    )}

                    {player.isAllIn && !player.folded && (
                      <div className="text-[10px] text-yellow-500 font-bold animate-pulse">
                        ALL-IN
                      </div>
                    )}
                  </div>

                  {isWinner && (
                    <div className="text-xs font-bold text-green-400 animate-fade-in mt-0.5">
                      +{winAmount.toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Message Bar */}
        <div className="glass rounded-xl px-6 py-3 text-center mb-4 animate-fade-in">
          <p className="text-sm text-gray-300">{message}</p>
        </div>

        {/* Showdown Results */}
        {(phase === "showdown" || (phase === "hand-over" && showdownResults.length > 0)) && (
          <div className="glass rounded-xl p-4 mb-4 animate-fade-in">
            <h3 className="text-sm font-bold text-[var(--gold)] mb-2">
              Showdown Results
            </h3>
            <div className="space-y-2">
              {showdownResults.map((result, i) => {
                const p = players.find((pl) => pl.id === result.playerId);
                return (
                  <div
                    key={result.playerId}
                    className={`flex items-center justify-between text-sm px-3 py-1.5 rounded-lg ${
                      i === 0
                        ? "bg-green-900/30 border border-green-700"
                        : "bg-[var(--casino-darker)]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {i === 0 && (
                        <span className="text-green-400">&#9733;</span>
                      )}
                      <span
                        className={
                          i === 0
                            ? "text-green-300 font-bold"
                            : "text-gray-400"
                        }
                      >
                        {p?.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex gap-0.5">
                        {result.cards.map((c, ci) => (
                          <PlayingCard
                            key={ci}
                            card={{ ...c, faceUp: true }}
                            size="sm"
                          />
                        ))}
                      </div>
                      <span
                        className={`text-xs font-semibold min-w-[80px] text-right ${
                          i === 0
                            ? "text-[var(--gold)]"
                            : "text-gray-500"
                        }`}
                      >
                        {result.hand.rankName}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Player Controls */}
        <div className="glass rounded-xl p-4">
          {/* Idle state */}
          {phase === "idle" && (
            <div className="flex flex-col items-center gap-4">
              <p className="text-gray-400 text-sm">
                Blinds: {SMALL_BLIND}/{BIG_BLIND} | Min buy-in: {BIG_BLIND}{" "}
                chips
              </p>
              <button
                onClick={startNewHand}
                disabled={chips < BIG_BLIND}
                className="bg-gradient-to-r from-[var(--gold-dark)] to-[var(--gold)] text-black font-bold px-8 py-3 rounded-xl hover:brightness-110 transition-all active:scale-95 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Deal Hand
              </button>
              {chips < BIG_BLIND && (
                <p className="text-red-400 text-xs">
                  You need at least {BIG_BLIND} chips to play.
                </p>
              )}
            </div>
          )}

          {/* Hand over state */}
          {phase === "hand-over" && (
            <div className="flex flex-col items-center gap-4">
              <button
                onClick={startNewHand}
                disabled={chips < BIG_BLIND}
                className="bg-gradient-to-r from-[var(--gold-dark)] to-[var(--gold)] text-black font-bold px-8 py-3 rounded-xl hover:brightness-110 transition-all active:scale-95 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next Hand
              </button>
            </div>
          )}

          {/* Active game controls */}
          {isActive && (
            <div className="space-y-3">
              {/* Action buttons */}
              <div className="flex flex-wrap items-center justify-center gap-2">
                {/* Fold */}
                <button
                  onClick={() => handlePlayerAction("fold")}
                  disabled={!isPlayerTurn}
                  className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                    isPlayerTurn
                      ? "bg-gradient-to-r from-red-800 to-red-700 hover:from-red-700 hover:to-red-600 border border-red-600/50 text-white active:scale-95 shadow-lg"
                      : "bg-gray-800 text-gray-600 cursor-not-allowed"
                  }`}
                >
                  Fold
                </button>

                {/* Check / Call */}
                {canCheck ? (
                  <button
                    onClick={() => handlePlayerAction("check")}
                    disabled={!isPlayerTurn}
                    className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                      isPlayerTurn
                        ? "bg-gradient-to-r from-gray-600 to-gray-500 hover:from-gray-500 hover:to-gray-400 text-white active:scale-95 shadow-lg"
                        : "bg-gray-800 text-gray-600 cursor-not-allowed"
                    }`}
                  >
                    Check
                  </button>
                ) : (
                  <button
                    onClick={() => handlePlayerAction("call")}
                    disabled={!isPlayerTurn}
                    className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                      isPlayerTurn
                        ? "bg-gradient-to-r from-green-700 to-green-600 hover:from-green-600 hover:to-green-500 text-white active:scale-95 shadow-lg"
                        : "bg-gray-800 text-gray-600 cursor-not-allowed"
                    }`}
                  >
                    Call {callAmount}
                  </button>
                )}

                {/* Raise */}
                <button
                  onClick={() =>
                    handlePlayerAction(
                      "raise",
                      Math.max(minRaiseTotal, raiseAmount)
                    )
                  }
                  disabled={
                    !isPlayerTurn ||
                    (playerData?.chipStack || 0) <= callAmount
                  }
                  className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                    isPlayerTurn &&
                    (playerData?.chipStack || 0) > callAmount
                      ? "bg-gradient-to-r from-[var(--gold-dark)] to-[var(--gold)] hover:brightness-110 text-black font-bold active:scale-95 shadow-lg"
                      : "bg-gray-800 text-gray-600 cursor-not-allowed"
                  }`}
                >
                  Raise to{" "}
                  {Math.max(minRaiseTotal, raiseAmount).toLocaleString()}
                </button>

                {/* All-In */}
                <button
                  onClick={() => handlePlayerAction("all-in")}
                  disabled={
                    !isPlayerTurn ||
                    (playerData?.chipStack || 0) === 0
                  }
                  className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                    isPlayerTurn && (playerData?.chipStack || 0) > 0
                      ? "bg-gradient-to-r from-red-600 to-[var(--gold-dark)] hover:brightness-110 text-white active:scale-95 shadow-lg shadow-red-900/40 border border-red-500/30"
                      : "bg-gray-800 text-gray-600 cursor-not-allowed"
                  }`}
                >
                  All-In ({(playerData?.chipStack || 0).toLocaleString()})
                </button>
              </div>

              {/* Raise slider */}
              {isPlayerTurn &&
                (playerData?.chipStack || 0) > callAmount && (
                  <div className="flex items-center gap-3 justify-center max-w-md mx-auto">
                    <span className="text-xs text-gray-500 w-14 text-right">
                      {minRaiseTotal}
                    </span>
                    <input
                      type="range"
                      min={minRaiseTotal}
                      max={maxRaise}
                      step={SMALL_BLIND}
                      value={Math.max(raiseAmount, minRaiseTotal)}
                      onChange={(e) =>
                        setRaiseAmount(parseInt(e.target.value))
                      }
                      className="flex-1 h-2 bg-[var(--casino-border)] rounded-lg appearance-none cursor-pointer accent-[var(--gold)]"
                    />
                    <span className="text-xs text-gray-500 w-14">
                      {maxRaise}
                    </span>
                  </div>
                )}

              {/* Quick raise presets */}
              {isPlayerTurn &&
                (playerData?.chipStack || 0) > callAmount && (
                  <div className="flex justify-center gap-2 flex-wrap">
                    {[
                      { label: "2x BB", val: BIG_BLIND * 2 },
                      { label: "3x BB", val: BIG_BLIND * 3 },
                      {
                        label: "1/2 Pot",
                        val: Math.max(
                          Math.floor(pot / 2),
                          minRaiseTotal
                        ),
                      },
                      {
                        label: "Pot",
                        val: Math.max(pot, minRaiseTotal),
                      },
                    ]
                      .filter(
                        (p) =>
                          p.val <= maxRaise && p.val >= minRaiseTotal
                      )
                      .map((preset) => (
                        <button
                          key={preset.label}
                          onClick={() => setRaiseAmount(preset.val)}
                          className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                            raiseAmount === preset.val
                              ? "bg-[var(--gold)] text-black"
                              : "bg-[var(--casino-card)] border border-[var(--casino-border)] text-gray-400 hover:border-[var(--gold)] hover:text-white"
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                  </div>
                )}

              {/* Turn indicator */}
              <div className="text-center">
                <p className="text-xs text-gray-500">
                  {isPlayerTurn
                    ? "Your turn to act"
                    : `Waiting for ${
                        players[currentPlayerIndex]?.name || "..."
                      }...`}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Hand Rankings Reference */}
        <details className="mt-4 glass rounded-xl">
          <summary className="px-4 py-3 text-sm text-gray-400 cursor-pointer hover:text-white transition-colors select-none">
            Hand Rankings Reference
          </summary>
          <div className="px-4 pb-4 grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
            {[
              { name: "Royal Flush", desc: "A K Q J 10 same suit" },
              {
                name: "Straight Flush",
                desc: "5 sequential same suit",
              },
              { name: "Four of a Kind", desc: "4 same rank cards" },
              { name: "Full House", desc: "3 of a kind + pair" },
              { name: "Flush", desc: "5 same suit cards" },
              { name: "Straight", desc: "5 sequential cards" },
              {
                name: "Three of a Kind",
                desc: "3 same rank cards",
              },
              { name: "Two Pair", desc: "2 different pairs" },
              { name: "One Pair", desc: "2 same rank cards" },
              { name: "High Card", desc: "Highest card wins" },
            ].map((hand, i) => (
              <div
                key={hand.name}
                className="bg-[var(--casino-darker)] rounded-lg px-3 py-2"
              >
                <div className="text-[var(--gold)] font-semibold">
                  {10 - i}. {hand.name}
                </div>
                <div className="text-gray-500">{hand.desc}</div>
              </div>
            ))}
          </div>
        </details>
      </div>

      {/* Footer */}
      <div className="max-w-6xl mx-auto mt-6 text-center">
        <p className="text-xs text-gray-600">
          For entertainment purposes only. No real money involved.
        </p>
      </div>
    </div>
  );
}
