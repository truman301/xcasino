"use client";

import { useChips } from "@/context/ChipContext";
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  CATEGORY_ORDER,
  CATEGORY_META,
  RARITY_COLORS,
  getCosmeticsByCategory,
  formatPrice,
  getNameColorStyle,
  getNameColorClass,
  type CosmeticCategory,
  type CosmeticItem,
} from "@/lib/cosmetics";

// ---------------------------------------------------------------------------
// Constants (Daily Bonus + Free Refill — kept as-is)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Rarity hex colors for top-border styling (inline, not Tailwind classes)
// ---------------------------------------------------------------------------

const RARITY_HEX: Record<string, string> = {
  common: "#6b7280",
  uncommon: "#22c55e",
  rare: "#3b82f6",
  epic: "#a855f7",
  legendary: "#eab308",
};

// ---------------------------------------------------------------------------
// Purchase Modal
// ---------------------------------------------------------------------------

function PurchaseModal({
  item,
  chips,
  onConfirm,
  onCancel,
}: {
  item: CosmeticItem;
  chips: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [state, setState] = useState<"idle" | "processing" | "success" | "error">("idle");
  const canAfford = chips >= item.price;
  const rarityColor = RARITY_COLORS[item.rarity];

  const handleConfirm = () => {
    if (!canAfford) {
      setState("error");
      setTimeout(() => setState("idle"), 2000);
      return;
    }
    setState("processing");
    // Small delay for perceived processing feel
    setTimeout(() => {
      onConfirm();
      setState("success");
      setTimeout(() => onCancel(), 800);
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={state === "idle" ? onCancel : undefined}
      />

      {/* Modal */}
      <div className="relative glass rounded-2xl border border-[var(--casino-border)] max-w-sm w-full p-6 animate-fade-in">
        {/* Rarity glow line */}
        <div
          className="absolute top-0 left-4 right-4 h-[2px] rounded-full"
          style={{ background: RARITY_HEX[item.rarity] }}
        />

        <div className="text-center">
          {/* Preview */}
          <div className="text-6xl mb-4 mt-2">{item.preview}</div>

          {/* Name */}
          <h3 className="text-xl font-bold text-white mb-1">{item.name}</h3>

          {/* Rarity badge */}
          <span
            className={`inline-block text-[10px] font-bold uppercase tracking-widest px-3 py-0.5 rounded-full mb-3 ${rarityColor.bg} ${rarityColor.text}`}
          >
            {item.rarity}
          </span>

          {/* Description */}
          <p className="text-gray-400 text-sm mb-6">{item.description}</p>

          {/* Price */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <span className="text-2xl">🪙</span>
            <span className="text-2xl font-black text-[var(--gold)]">
              {item.price.toLocaleString()}
            </span>
          </div>

          {/* Insufficient funds warning */}
          {!canAfford && state === "idle" && (
            <p className="text-red-400 text-xs mb-4 animate-fade-in">
              Not enough chips! You need{" "}
              <span className="font-bold">
                {(item.price - chips).toLocaleString()}
              </span>{" "}
              more.
            </p>
          )}

          {state === "error" && (
            <p className="text-red-400 text-xs mb-4 animate-fade-in font-bold">
              Purchase failed — insufficient chips.
            </p>
          )}

          {state === "success" && (
            <p className="text-green-400 text-sm mb-4 animate-fade-in font-bold">
              Purchase successful!
            </p>
          )}

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              disabled={state === "processing" || state === "success"}
              className="btn-casino-outline flex-1 text-sm disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!canAfford || state === "processing" || state === "success"}
              className={`flex-1 px-6 py-3 rounded-xl font-bold text-sm uppercase tracking-wide transition-all duration-200 ${
                state === "success"
                  ? "bg-green-600 text-white"
                  : canAfford
                  ? "bg-gradient-to-r from-[var(--gold-dark)] to-[var(--gold)] text-black hover:brightness-110 active:scale-95 shadow-lg"
                  : "bg-gray-700 text-gray-500 cursor-not-allowed"
              }`}
            >
              {state === "processing"
                ? "..."
                : state === "success"
                ? "Done!"
                : `Buy for ${formatPrice(item.price)}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cosmetic Item Card
// ---------------------------------------------------------------------------

function CosmeticCard({
  item,
  owned,
  equipped,
  onBuy,
  onEquip,
  onUnequip,
  username,
}: {
  item: CosmeticItem;
  owned: boolean;
  equipped: boolean;
  onBuy: () => void;
  onEquip: () => void;
  onUnequip: () => void;
  username: string;
}) {
  const rarityColor = RARITY_COLORS[item.rarity];

  // Build the category-specific preview
  const renderPreview = () => {
    if (item.category === "name_color") {
      const style = getNameColorStyle(item.id);
      const cls = getNameColorClass(item.id);
      return (
        <div className="flex flex-col items-center gap-2">
          <span className="text-4xl">{item.preview}</span>
          <span
            className={`text-lg font-bold ${cls}`}
            style={style}
          >
            {username || "Player"}
          </span>
        </div>
      );
    }
    if (item.category === "badge") {
      return <span className="text-5xl">{item.cssValue}</span>;
    }
    if (item.category === "title") {
      return (
        <div className="flex flex-col items-center gap-2">
          <span className="text-3xl">{item.preview}</span>
          <span className="text-sm font-semibold text-[var(--gold)] italic">
            &ldquo;{item.cssValue}&rdquo;
          </span>
        </div>
      );
    }
    // avatar_frame, chat_flair, table_effect — just show the preview emoji large
    return <span className="text-5xl">{item.preview}</span>;
  };

  return (
    <div
      className="group relative glass rounded-xl overflow-hidden border border-[var(--casino-border)] hover:border-[var(--gold)]/30 transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_20px_rgba(212,175,55,0.08)] flex flex-col"
    >
      {/* Rarity top border */}
      <div
        className="h-[2px] w-full"
        style={{ background: RARITY_HEX[item.rarity] }}
      />

      {/* Rarity pill badge — top right corner */}
      <div className="absolute top-3 right-3 z-10">
        <span
          className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${rarityColor.bg} ${rarityColor.text}`}
        >
          {item.rarity}
        </span>
      </div>

      {/* Preview area */}
      <div className="flex items-center justify-center h-28 pt-4 pb-2">
        {renderPreview()}
      </div>

      {/* Info */}
      <div className="px-4 pb-2 flex-1">
        <h4 className="text-sm font-bold text-white truncate">{item.name}</h4>
        <p className="text-[11px] text-gray-500 leading-snug line-clamp-2 mt-0.5">
          {item.description}
        </p>
      </div>

      {/* Price + action */}
      <div className="px-4 pb-4 pt-1">
        {/* Price row */}
        {!owned && (
          <div className="flex items-center gap-1 mb-2">
            <span className="text-sm">🪙</span>
            <span className="text-sm font-bold text-[var(--gold)]">
              {formatPrice(item.price)}
            </span>
          </div>
        )}

        {/* Action button */}
        {!owned ? (
          <button
            onClick={onBuy}
            className="w-full px-3 py-2 rounded-lg font-bold text-xs uppercase tracking-wide bg-gradient-to-r from-[var(--gold-dark)] to-[var(--gold)] text-black hover:brightness-110 active:scale-95 transition-all duration-200 shadow-md"
          >
            Buy for {formatPrice(item.price)}
          </button>
        ) : equipped ? (
          <div className="flex flex-col gap-1.5">
            <button
              disabled
              className="w-full px-3 py-2 rounded-lg font-bold text-xs uppercase tracking-wide bg-green-600/90 text-white cursor-default"
            >
              Equipped ✓
            </button>
            <button
              onClick={onUnequip}
              className="w-full px-2 py-1 rounded-md text-[10px] text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              Unequip
            </button>
          </div>
        ) : (
          <button
            onClick={onEquip}
            className="w-full px-3 py-2 rounded-lg font-bold text-xs uppercase tracking-wide btn-casino-outline"
          >
            Equip
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Store Page
// ---------------------------------------------------------------------------

export default function StorePage() {
  const {
    chips,
    addChips,
    username,
    purchaseCosmetic,
    equipCosmetic,
    ownsCosmetic,
    getEquippedItem,
  } = useChips();

  // ── Daily Bonus + Refill state (kept exactly as original) ──────────────
  const [bonusCooldownRemaining, setBonusCooldownRemaining] = useState<number>(0);
  const [bonusClaimed, setBonusClaimed] = useState(false);
  const [refillClaimed, setRefillClaimed] = useState(false);
  const [mounted, setMounted] = useState(false);

  // ── Cosmetics state ────────────────────────────────────────────────────
  const [selectedCategory, setSelectedCategory] = useState<CosmeticCategory>("name_color");
  const [purchaseTarget, setPurchaseTarget] = useState<CosmeticItem | null>(null);

  // ── Daily Bonus logic (unchanged) ──────────────────────────────────────
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

  // ── Cosmetics data ────────────────────────────────────────────────────
  const categoryItems = useMemo(
    () => getCosmeticsByCategory(selectedCategory),
    [selectedCategory]
  );

  const handlePurchase = (item: CosmeticItem) => {
    setPurchaseTarget(item);
  };

  const confirmPurchase = () => {
    if (!purchaseTarget) return;
    purchaseCosmetic(purchaseTarget.id, purchaseTarget.price);
  };

  // ────────────────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen pb-20">
      {/* ═══════════════════ Header / Balance ═══════════════════ */}
      <section className="relative overflow-hidden py-16 px-4">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0f0808] via-[var(--casino-darker)] to-transparent" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-80 bg-red-900/8 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-4xl mx-auto text-center animate-fade-in">
          <h1 className="text-4xl md:text-5xl font-black mb-2 tracking-tight">
            <span className="text-[var(--gold)]">Store</span>
          </h1>
          <div className="accent-line max-w-xs mx-auto mb-4 mt-2" />
          <p className="text-gray-500 mb-8">
            Free chips, premium cosmetics &amp; more
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

      {/* ═══════════════════ Daily Bonus + Free Refill ═══════════════════ */}
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

      {/* ═══════════════════ Cosmetics Shop ═══════════════════ */}
      <section className="max-w-5xl mx-auto px-4 mb-16">
        {/* Section header */}
        <div className="text-center mb-8 animate-fade-in" style={{ animationDelay: "150ms", animationFillMode: "backwards" }}>
          <h2 className="text-2xl md:text-3xl font-black text-white mb-2">
            Cosmetics <span className="text-[var(--gold)]">Shop</span>
          </h2>
          <div className="accent-line-gold max-w-[200px] mx-auto mb-3" />
          <p className="text-gray-500 text-sm">
            Stand out at the tables with exclusive styles
          </p>
        </div>

        {/* Category tab bar */}
        <div className="mb-8 animate-fade-in" style={{ animationDelay: "200ms", animationFillMode: "backwards" }}>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0 md:justify-center md:flex-wrap">
            {CATEGORY_ORDER.map((cat) => {
              const meta = CATEGORY_META[cat];
              const isActive = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`
                    flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold
                    whitespace-nowrap transition-all duration-200 border shrink-0
                    ${
                      isActive
                        ? "bg-gradient-to-r from-[var(--gold-dark)]/20 to-[var(--gold)]/10 border-[var(--gold)]/40 text-[var(--gold)] shadow-[0_0_12px_rgba(212,175,55,0.15)]"
                        : "glass border-[var(--casino-border)] text-gray-400 hover:text-white hover:border-gray-600"
                    }
                  `}
                >
                  <span className="text-base">{meta.icon}</span>
                  <span>{meta.label}</span>
                </button>
              );
            })}
          </div>

          {/* Category description */}
          <p className="text-center text-gray-500 text-xs mt-3">
            {CATEGORY_META[selectedCategory].description}
          </p>
        </div>

        {/* Items grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 animate-fade-in">
          {categoryItems.map((item, i) => {
            const owned = ownsCosmetic(item.id);
            const equippedItemId = getEquippedItem(item.category);
            const isEquipped = equippedItemId === item.id;

            return (
              <div
                key={item.id}
                style={{
                  animationDelay: `${i * 40}ms`,
                  animationFillMode: "backwards",
                }}
                className="animate-fade-in"
              >
                <CosmeticCard
                  item={item}
                  owned={owned}
                  equipped={isEquipped}
                  onBuy={() => handlePurchase(item)}
                  onEquip={() => equipCosmetic(item.category, item.id)}
                  onUnequip={() => equipCosmetic(item.category, null)}
                  username={username}
                />
              </div>
            );
          })}
        </div>

        {/* Empty state */}
        {categoryItems.length === 0 && (
          <div className="text-center py-16 text-gray-600">
            <p className="text-4xl mb-3">🚧</p>
            <p className="font-semibold">No items in this category yet.</p>
            <p className="text-sm mt-1">Check back soon!</p>
          </div>
        )}
      </section>

      {/* ═══════════════════ Disclaimer ═══════════════════ */}
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

      {/* ═══════════════════ Purchase Modal ═══════════════════ */}
      {purchaseTarget && (
        <PurchaseModal
          item={purchaseTarget}
          chips={chips}
          onConfirm={confirmPurchase}
          onCancel={() => setPurchaseTarget(null)}
        />
      )}
    </div>
  );
}
