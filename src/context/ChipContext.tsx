"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface ChipContextType {
  chips: number;
  addChips: (amount: number) => void;
  removeChips: (amount: number) => boolean;
  username: string;
  setUsername: (name: string) => void;
  isLoggedIn: boolean;
  login: (name: string) => void;
  logout: () => void;
}

const ChipContext = createContext<ChipContextType | null>(null);

export function ChipProvider({ children }: { children: ReactNode }) {
  const [chips, setChips] = useState(10000); // Start with 10k free chips
  const [username, setUsername] = useState("Guest");
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const addChips = useCallback((amount: number) => {
    setChips((prev) => prev + amount);
  }, []);

  const removeChips = useCallback((amount: number): boolean => {
    let success = false;
    setChips((prev) => {
      if (prev >= amount) {
        success = true;
        return prev - amount;
      }
      return prev;
    });
    return success;
  }, []);

  const login = useCallback((name: string) => {
    setUsername(name);
    setIsLoggedIn(true);
  }, []);

  const logout = useCallback(() => {
    setUsername("Guest");
    setIsLoggedIn(false);
    setChips(10000);
  }, []);

  return (
    <ChipContext.Provider
      value={{ chips, addChips, removeChips, username, setUsername, isLoggedIn, login, logout }}
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
