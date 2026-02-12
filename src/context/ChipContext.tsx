"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
} from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { User, AuthError } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Profile {
  id: string;
  username: string;
  chips: number;
  is_admin: boolean;
}

interface ChipContextType {
  // Chip management
  chips: number;
  addChips: (amount: number) => void;
  removeChips: (amount: number) => boolean;

  // Auth
  user: User | null;
  profile: Profile | null;
  username: string;
  isLoggedIn: boolean;
  isAdmin: boolean;
  loading: boolean;
  supabaseReady: boolean;

  // Auth actions
  signUp: (email: string, password: string, username: string) => Promise<{ error: AuthError | null }>;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;

  // Legacy compat
  login: (name: string) => void;
  logout: () => void;
  setUsername: (name: string) => void;
}

const ChipContext = createContext<ChipContextType | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function ChipProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [chips, setChips] = useState(10000);
  const [loading, setLoading] = useState(true);

  // Legacy state for non-Supabase mode
  const [legacyUsername, setLegacyUsername] = useState("Guest");
  const [legacyLoggedIn, setLegacyLoggedIn] = useState(false);

  // Debounced chip sync
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chipsRef = useRef(chips);
  chipsRef.current = chips;

  // ------------------------------------------------------------------
  // Load profile from Supabase
  // ------------------------------------------------------------------

  const loadProfile = useCallback(async (userId: string) => {
    if (!isSupabaseConfigured) return;
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) {
        console.error("Error loading profile:", error);
        return;
      }

      if (data) {
        setProfile({
          id: data.id as string,
          username: data.username as string,
          chips: data.chips as number,
          is_admin: data.is_admin as boolean,
        });
        setChips(data.chips as number);
      }
    } catch (err) {
      console.error("Failed to load profile:", err);
    }
  }, []);

  // ------------------------------------------------------------------
  // Debounced chip save to database
  // ------------------------------------------------------------------

  const syncChipsToDb = useCallback(
    (newChips: number) => {
      if (!isSupabaseConfigured || !user) return;
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = setTimeout(async () => {
        try {
          await supabase
            .from("profiles")
            .update({ chips: newChips, updated_at: new Date().toISOString() })
            .eq("id", user.id);
        } catch (err) {
          console.error("Failed to sync chips:", err);
        }
      }, 1000);
    },
    [user]
  );

  // ------------------------------------------------------------------
  // Auth state listener
  // ------------------------------------------------------------------

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        loadProfile(session.user.id);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        loadProfile(currentUser.id);
      } else {
        setProfile(null);
        setChips(10000);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  // ------------------------------------------------------------------
  // Chip management
  // ------------------------------------------------------------------

  const addChips = useCallback(
    (amount: number) => {
      setChips((prev) => {
        const next = prev + amount;
        syncChipsToDb(next);
        return next;
      });
    },
    [syncChipsToDb]
  );

  const removeChips = useCallback(
    (amount: number): boolean => {
      // Read current chips synchronously from ref to avoid race condition
      if (chipsRef.current < amount) return false;
      setChips((prev) => {
        if (prev >= amount) {
          const next = prev - amount;
          syncChipsToDb(next);
          return next;
        }
        return prev;
      });
      return true;
    },
    [syncChipsToDb]
  );

  // ------------------------------------------------------------------
  // Auth actions
  // ------------------------------------------------------------------

  const signUp = useCallback(
    async (email: string, password: string, username: string) => {
      if (!isSupabaseConfigured) {
        return { error: { message: "Supabase is not configured", name: "ConfigError", status: 500 } as unknown as AuthError };
      }
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { username },
          emailRedirectTo: `${window.location.origin}/auth/confirm`,
        },
      });
      return { error };
    },
    []
  );

  const signIn = useCallback(async (email: string, password: string) => {
    if (!isSupabaseConfigured) {
      return { error: { message: "Supabase is not configured", name: "ConfigError", status: 500 } as unknown as AuthError };
    }
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  }, []);

  const signOut = useCallback(async () => {
    if (!isSupabaseConfigured) {
      // Legacy mode logout
      setLegacyUsername("Guest");
      setLegacyLoggedIn(false);
      setChips(10000);
      return;
    }
    // Save chips before signing out
    if (user) {
      try {
        await supabase
          .from("profiles")
          .update({ chips: chipsRef.current, updated_at: new Date().toISOString() })
          .eq("id", user.id);
      } catch (err) {
        console.error("Failed to save chips on logout:", err);
      }
    }
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setChips(10000);
  }, [user]);

  // ------------------------------------------------------------------
  // Legacy compat
  // ------------------------------------------------------------------

  const login = useCallback((name: string) => {
    if (!isSupabaseConfigured) {
      setLegacyUsername(name);
      setLegacyLoggedIn(true);
    }
  }, []);

  const logout = useCallback(() => {
    signOut();
  }, [signOut]);

  const setUsernameCompat = useCallback((name: string) => {
    if (!isSupabaseConfigured) {
      setLegacyUsername(name);
    }
  }, []);

  // ------------------------------------------------------------------
  // Derived values
  // ------------------------------------------------------------------

  const username = isSupabaseConfigured
    ? (profile?.username ?? "Guest")
    : legacyUsername;
  const isLoggedIn = isSupabaseConfigured ? !!user : legacyLoggedIn;
  const isAdmin = profile?.is_admin ?? false;

  return (
    <ChipContext.Provider
      value={{
        chips,
        addChips,
        removeChips,
        user,
        profile,
        username,
        isLoggedIn,
        isAdmin,
        loading,
        supabaseReady: isSupabaseConfigured,
        signUp,
        signIn,
        signOut,
        login,
        logout,
        setUsername: setUsernameCompat,
      }}
    >
      {children}
    </ChipContext.Provider>
  );
}

export function useChips() {
  const context = useContext(ChipContext);
  if (!context) throw new Error("useChips must be used within a ChipProvider");
  return context;
}
