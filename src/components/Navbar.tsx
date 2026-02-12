"use client";

import Link from "next/link";
import { useChips } from "@/context/ChipContext";
import { useState } from "react";
import PlayerBadge from "./PlayerBadge";

export default function Navbar() {
  const {
    chips, username, isLoggedIn, isAdmin, loading,
    signIn, signUp, signOut, login, supabaseReady, equippedCosmetics,
  } = useChips();

  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const formatChips = (n: number) => {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
    if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
    return n.toLocaleString();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      if (!supabaseReady) {
        // Legacy mode: just use display name
        if (displayName.trim()) {
          login(displayName.trim());
          setShowAuth(false);
          resetForm();
        } else {
          setError("Display name is required");
        }
        setSubmitting(false);
        return;
      }

      if (authMode === "signup") {
        if (!displayName.trim()) {
          setError("Username is required");
          setSubmitting(false);
          return;
        }
        if (displayName.trim().length < 3) {
          setError("Username must be at least 3 characters");
          setSubmitting(false);
          return;
        }
        if (displayName.trim().length > 20) {
          setError("Username must be 20 characters or less");
          setSubmitting(false);
          return;
        }
        if (!/^[a-zA-Z0-9_]+$/.test(displayName.trim())) {
          setError("Username can only contain letters, numbers, and underscores");
          setSubmitting(false);
          return;
        }
        const { error: signUpError } = await signUp(email, password, displayName.trim());
        if (signUpError) {
          setError(signUpError.message);
        } else {
          setEmailSent(true);
        }
      } else {
        const { error: signInError } = await signIn(email, password);
        if (signInError) {
          setError(signInError.message);
        } else {
          setShowAuth(false);
          resetForm();
        }
      }
    } catch {
      setError("An unexpected error occurred");
    }
    setSubmitting(false);
  };

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setDisplayName("");
    setError("");
    setAuthMode("login");
    setEmailSent(false);
  };

  const handleOpenAuth = () => {
    resetForm();
    setShowAuth(true);
  };

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 glass">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 group">
              <span className="text-2xl font-black tracking-tight">
                <span className="text-white">Casino</span>{" "}
                <span className="text-[var(--gold)] group-hover:drop-shadow-[0_0_8px_rgba(212,175,55,0.4)] transition-all">X</span>
              </span>
            </Link>
            <div className="hidden md:flex items-center gap-1">
              {[
                { href: "/poker", label: "Poker" },
                { href: "/blackjack", label: "Blackjack" },
                { href: "/roulette", label: "Roulette" },
                { href: "/slots", label: "Slots" },
                { href: "/dice", label: "Dice" },
                { href: "/crash", label: "Crash" },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm text-gray-500 hover:text-[var(--gold)] transition-colors px-3 py-1.5 rounded-lg hover:bg-white/[0.02]"
                >
                  {link.label}
                </Link>
              ))}
              {isAdmin && (
                <Link
                  href="/admin"
                  className="text-sm text-red-400 hover:text-red-300 transition-colors px-3 py-1.5 rounded-lg hover:bg-white/[0.02]"
                >
                  Admin
                </Link>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/store"
              className="flex items-center gap-2 bg-[var(--casino-card)] border border-[var(--gold)]/20 rounded-full px-4 py-2 hover:border-[var(--gold)]/50 transition-all group"
            >
              <span className="text-lg">🪙</span>
              <span className="font-bold text-[var(--gold)]">{formatChips(chips)}</span>
              <span className="text-xs text-red-400 font-bold ml-0.5 group-hover:text-red-300">+</span>
            </Link>

            {isLoggedIn && (
              <Link
                href="/leaderboard"
                className="text-sm text-gray-500 hover:text-[var(--gold)] transition-colors px-2"
                title="Leaderboards"
              >
                🏆
              </Link>
            )}

            {loading ? (
              <div className="w-16 h-8 rounded-lg bg-[var(--casino-card)] animate-pulse" />
            ) : isLoggedIn ? (
              <div className="flex items-center gap-3">
                <PlayerBadge
                  username={username}
                  equippedCosmetics={equippedCosmetics ?? {}}
                  size="md"
                  showTitle={true}
                  showFrame={true}
                />
                <button
                  onClick={() => signOut()}
                  className="text-xs text-gray-600 hover:text-red-400 transition-colors"
                >
                  Logout
                </button>
              </div>
            ) : (
              <button
                onClick={handleOpenAuth}
                className="btn-casino text-sm"
              >
                Login
              </button>
            )}
          </div>
        </div>
        {/* Red accent line */}
        <div className="accent-line" />
      </nav>

      {showAuth && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70">
          <div className="bg-[var(--casino-card)] border border-[var(--casino-border)] rounded-2xl p-8 w-full max-w-sm animate-fade-in shadow-2xl shadow-black/50">
            <h2 className="text-xl font-bold mb-1">
              Welcome to <span className="text-white">Casino</span>{" "}
              <span className="text-[var(--gold)]">X</span>
            </h2>
            <div className="accent-line mb-4 mt-2" />

            {supabaseReady ? (
              <>
                {emailSent ? (
                  /* ─── Email verification sent ─── */
                  <div className="text-center animate-fade-in">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--gold)]/10 border border-[var(--gold)]/30 flex items-center justify-center">
                      <svg className="w-8 h-8 text-[var(--gold)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">Check your email</h3>
                    <p className="text-sm text-gray-400 mb-1">
                      We sent a verification link to
                    </p>
                    <p className="text-sm text-[var(--gold)] font-semibold mb-4">{email}</p>
                    <p className="text-xs text-gray-500 mb-6">
                      Click the link in the email to verify your account and start playing. Check your spam folder if you don&apos;t see it.
                    </p>
                    <button
                      onClick={() => { setShowAuth(false); resetForm(); }}
                      className="btn-casino w-full"
                    >
                      Got it
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Tabs */}
                    <div className="flex gap-1 mb-6 bg-[var(--casino-darker)] rounded-lg p-1">
                      <button
                        onClick={() => { setAuthMode("login"); setError(""); }}
                        className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${
                          authMode === "login"
                            ? "bg-[var(--casino-card)] text-[var(--gold)] shadow"
                            : "text-gray-500 hover:text-gray-300"
                        }`}
                      >
                        Sign In
                      </button>
                      <button
                        onClick={() => { setAuthMode("signup"); setError(""); }}
                        className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${
                          authMode === "signup"
                            ? "bg-[var(--casino-card)] text-[var(--gold)] shadow"
                            : "text-gray-500 hover:text-gray-300"
                        }`}
                      >
                        Sign Up
                      </button>
                    </div>

                    <form onSubmit={handleSubmit}>
                      {authMode === "signup" && (
                        <div className="mb-3">
                          <label className="block text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1.5">
                            Username
                          </label>
                          <input
                            type="text"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder="Choose a username"
                            className="w-full bg-[var(--casino-darker)] border border-[var(--casino-border)] rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-[var(--gold)]/50 transition-colors"
                            autoFocus
                            required
                            minLength={3}
                            maxLength={20}
                            pattern="[a-zA-Z0-9_]+"
                            title="Letters, numbers, and underscores only"
                          />
                          <p className="text-[10px] text-gray-600 mt-1">3-20 characters, letters, numbers & underscores</p>
                        </div>
                      )}
                      <div className="mb-3">
                        <label className="block text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1.5">
                          Email
                        </label>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@example.com"
                          className="w-full bg-[var(--casino-darker)] border border-[var(--casino-border)] rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-[var(--gold)]/50 transition-colors"
                          autoFocus={authMode === "login"}
                          required
                        />
                      </div>
                      <div className="mb-4">
                        <label className="block text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1.5">
                          Password
                        </label>
                        <input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder={authMode === "signup" ? "Min 6 characters" : "Your password"}
                          className="w-full bg-[var(--casino-darker)] border border-[var(--casino-border)] rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-[var(--gold)]/50 transition-colors"
                          required
                          minLength={6}
                        />
                      </div>

                      {error && (
                        <p className="text-sm text-red-400 mb-3 animate-fade-in">{error}</p>
                      )}

                      <div className="flex gap-3">
                        <button
                          type="submit"
                          disabled={submitting}
                          className="btn-casino flex-1 disabled:opacity-50"
                        >
                          {submitting
                            ? "..."
                            : authMode === "login"
                            ? "Sign In"
                            : "Create Account"}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setShowAuth(false); resetForm(); }}
                          className="btn-casino-outline flex-1"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </>
                )}
              </>
            ) : (
              <>
                {/* Legacy: display name only */}
                <p className="text-gray-500 text-sm mb-6">Enter a display name to play</p>
                <form onSubmit={handleSubmit}>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your display name"
                    className="w-full bg-[var(--casino-darker)] border border-[var(--casino-border)] rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-[var(--gold)]/50 transition-colors mb-4"
                    autoFocus
                  />

                  {error && (
                    <p className="text-sm text-red-400 mb-3 animate-fade-in">{error}</p>
                  )}

                  <div className="flex gap-3">
                    <button type="submit" className="btn-casino flex-1">
                      Play Now
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowAuth(false); resetForm(); }}
                      className="btn-casino-outline flex-1"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </>
            )}

            <p className="text-xs text-gray-600 mt-4 text-center">
              You must be 18+ to play. No real money involved.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
