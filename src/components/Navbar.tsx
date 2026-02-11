"use client";

import Link from "next/link";
import { useChips } from "@/context/ChipContext";
import { useState } from "react";

export default function Navbar() {
  const { chips, username, isLoggedIn, login, logout } = useChips();
  const [showLogin, setShowLogin] = useState(false);
  const [loginName, setLoginName] = useState("");

  const formatChips = (n: number) => {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
    if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
    return n.toLocaleString();
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginName.trim()) {
      login(loginName.trim());
      setShowLogin(false);
      setLoginName("");
    }
  };

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-[var(--casino-border)]">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-2xl font-black tracking-tight">
                <span className="text-[var(--gold)]">X</span>
                <span className="text-white">Casino</span>
              </span>
            </Link>
            <div className="hidden md:flex items-center gap-4">
              <Link href="/poker" className="text-sm text-gray-400 hover:text-white transition-colors">
                Poker
              </Link>
              <Link href="/blackjack" className="text-sm text-gray-400 hover:text-white transition-colors">
                Blackjack
              </Link>
              <Link href="/roulette" className="text-sm text-gray-400 hover:text-white transition-colors">
                Roulette
              </Link>
              <Link href="/slots" className="text-sm text-gray-400 hover:text-white transition-colors">
                Slots
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/store"
              className="flex items-center gap-2 bg-[var(--casino-card)] border border-[var(--casino-border)] rounded-full px-4 py-2 hover:border-[var(--gold)] transition-colors"
            >
              <span className="text-xl">🪙</span>
              <span className="font-bold text-[var(--gold)]">{formatChips(chips)}</span>
              <span className="text-xs text-green-400 font-bold ml-1">+</span>
            </Link>

            {isLoggedIn ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-300">{username}</span>
                <button
                  onClick={logout}
                  className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                  Logout
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowLogin(true)}
                className="btn-casino text-sm"
              >
                Login
              </button>
            )}
          </div>
        </div>
      </nav>

      {showLogin && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60">
          <div className="bg-[var(--casino-card)] border border-[var(--casino-border)] rounded-2xl p-8 w-full max-w-sm animate-fade-in">
            <h2 className="text-xl font-bold mb-1">Welcome to <span className="text-[var(--gold)]">X</span>Casino</h2>
            <p className="text-gray-400 text-sm mb-6">Enter a display name to play</p>
            <form onSubmit={handleLogin}>
              <input
                type="text"
                value={loginName}
                onChange={(e) => setLoginName(e.target.value)}
                placeholder="Your display name"
                className="w-full bg-[var(--casino-darker)] border border-[var(--casino-border)] rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[var(--gold)] transition-colors mb-4"
                autoFocus
              />
              <div className="flex gap-3">
                <button type="submit" className="btn-casino flex-1">
                  Play Now
                </button>
                <button
                  type="button"
                  onClick={() => setShowLogin(false)}
                  className="btn-casino-outline flex-1"
                >
                  Cancel
                </button>
              </div>
            </form>
            <p className="text-xs text-gray-500 mt-4 text-center">
              You must be 18+ to play. No real money involved.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
