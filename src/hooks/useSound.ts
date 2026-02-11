"use client";

import { useCallback, useRef } from "react";

// ---------------------------------------------------------------------------
// Sound effect types
// ---------------------------------------------------------------------------

type SoundName =
  | "bet"        // Chip click when placing a bet
  | "win"        // Small win (coin clink)
  | "bigWin"     // Big win (fanfare)
  | "lose"       // Lose sound
  | "spin"       // Wheel / reel spin
  | "roll"       // Dice roll
  | "crash"      // Crash game explosion
  | "cashout"    // Cash out success
  | "click"      // Generic UI click
  | "deal";      // Card deal

// ---------------------------------------------------------------------------
// Web Audio API sound synthesizer
// All sounds are generated procedurally — no external files needed
// ---------------------------------------------------------------------------

function createAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    return new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  } catch {
    return null;
  }
}

function playTone(
  ctx: AudioContext,
  frequency: number,
  duration: number,
  type: OscillatorType = "sine",
  volume: number = 0.3,
  delay: number = 0
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, ctx.currentTime + delay);
  gain.gain.setValueAtTime(volume, ctx.currentTime + delay);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime + delay);
  osc.stop(ctx.currentTime + delay + duration);
}

function playNoise(
  ctx: AudioContext,
  duration: number,
  volume: number = 0.1,
  delay: number = 0
) {
  const bufferSize = ctx.sampleRate * duration;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, ctx.currentTime + delay);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
  source.connect(gain);
  gain.connect(ctx.destination);
  source.start(ctx.currentTime + delay);
}

const soundGenerators: Record<SoundName, (ctx: AudioContext) => void> = {
  bet: (ctx) => {
    // Quick chip click
    playTone(ctx, 800, 0.08, "square", 0.15);
    playTone(ctx, 1200, 0.06, "square", 0.1, 0.03);
  },

  win: (ctx) => {
    // Ascending coin clink
    playTone(ctx, 600, 0.15, "sine", 0.2);
    playTone(ctx, 800, 0.15, "sine", 0.2, 0.1);
    playTone(ctx, 1000, 0.2, "sine", 0.25, 0.2);
  },

  bigWin: (ctx) => {
    // Fanfare — ascending major chord
    playTone(ctx, 523, 0.3, "sine", 0.2);      // C5
    playTone(ctx, 659, 0.3, "sine", 0.2, 0.15); // E5
    playTone(ctx, 784, 0.3, "sine", 0.2, 0.3);  // G5
    playTone(ctx, 1047, 0.5, "sine", 0.3, 0.45); // C6
    // Sparkle
    playTone(ctx, 2000, 0.1, "sine", 0.1, 0.5);
    playTone(ctx, 2500, 0.1, "sine", 0.1, 0.55);
    playTone(ctx, 3000, 0.1, "sine", 0.1, 0.6);
  },

  lose: (ctx) => {
    // Descending sad tone
    playTone(ctx, 400, 0.2, "sine", 0.15);
    playTone(ctx, 300, 0.3, "sine", 0.12, 0.15);
  },

  spin: (ctx) => {
    // Roulette-like whirring
    for (let i = 0; i < 8; i++) {
      playTone(ctx, 300 + i * 50, 0.05, "triangle", 0.08, i * 0.04);
    }
  },

  roll: (ctx) => {
    // Dice rattling
    for (let i = 0; i < 5; i++) {
      playNoise(ctx, 0.04, 0.15, i * 0.06);
      playTone(ctx, 200 + Math.random() * 300, 0.04, "square", 0.05, i * 0.06);
    }
  },

  crash: (ctx) => {
    // Explosion / crash sound
    playNoise(ctx, 0.3, 0.3);
    playTone(ctx, 100, 0.4, "sawtooth", 0.2);
    playTone(ctx, 50, 0.5, "sine", 0.15, 0.1);
  },

  cashout: (ctx) => {
    // Cash register ding
    playTone(ctx, 1200, 0.15, "sine", 0.2);
    playTone(ctx, 1800, 0.2, "sine", 0.25, 0.08);
  },

  click: (ctx) => {
    // Simple UI click
    playTone(ctx, 1000, 0.04, "square", 0.1);
  },

  deal: (ctx) => {
    // Card swoosh
    playNoise(ctx, 0.08, 0.1);
    playTone(ctx, 500, 0.06, "triangle", 0.05);
  },
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSound() {
  const ctxRef = useRef<AudioContext | null>(null);
  const enabledRef = useRef(true);

  const play = useCallback((name: SoundName) => {
    if (!enabledRef.current) return;
    if (typeof window === "undefined") return;

    // Lazy-create audio context on first user interaction
    if (!ctxRef.current) {
      ctxRef.current = createAudioContext();
    }

    const ctx = ctxRef.current;
    if (!ctx) return;

    // Resume if suspended (browsers require user gesture)
    if (ctx.state === "suspended") {
      ctx.resume();
    }

    const generator = soundGenerators[name];
    if (generator) {
      generator(ctx);
    }
  }, []);

  const setEnabled = useCallback((enabled: boolean) => {
    enabledRef.current = enabled;
  }, []);

  return { play, setEnabled };
}
