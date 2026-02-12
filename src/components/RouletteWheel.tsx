"use client";

import { useEffect, useRef, useCallback } from "react";

// ---------------------------------------------------------------------------
// American roulette wheel sequence (clockwise, standard)
// ---------------------------------------------------------------------------

const WHEEL_SEQUENCE: string[] = [
  "0","28","9","26","30","11","7","20","32","17","5","22","34","15","3","24","36","13","1",
  "00","27","10","25","29","12","8","19","31","18","6","21","33","16","4","23","35","14","2",
];

const RED_NUMBERS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

function getColor(num: string): "red" | "black" | "green" {
  if (num === "0" || num === "00") return "green";
  return RED_NUMBERS.has(Number(num)) ? "red" : "black";
}

const NUM_SLOTS = WHEEL_SEQUENCE.length; // 38
const SLOT_ANGLE = 360 / NUM_SLOTS; // ~9.47° per slot

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RouletteWheelProps {
  start: boolean;
  winningBet: string;
  onSpinningEnd?: () => void;
  withAnimation?: boolean;
}

// ---------------------------------------------------------------------------
// Component
//
// Two-phase ball physics (no prediction, no snap):
//   Phase 1 (first ~70% of duration): Ball decelerates with constant friction,
//     looking natural and random.
//   Phase 2 (last ~30%): We compute the REAL remaining distance to the winning
//     slot (using the actual wheel angle, not a prediction) and smoothly
//     recalculate v0/friction so the ball arrives exactly at the target.
//     This is seamless — the ball just appears to decelerate into the slot.
// ---------------------------------------------------------------------------

const WHEEL_SIZE = 340;
const CENTER = WHEEL_SIZE / 2;
const OUTER_R = WHEEL_SIZE / 2;
const INNER_R = OUTER_R * 0.62;
const NUM_R = (OUTER_R + INNER_R) / 2;
const BALL_R = OUTER_R * 0.85;

export default function RouletteWheel({
  start,
  winningBet,
  onSpinningEnd,
}: RouletteWheelProps) {
  const prevStartRef = useRef(false);

  // Continuous angles (mutated every frame — NOT React state)
  const wheelAngle = useRef(0);
  const ballAngle = useRef(0);

  // Physics refs
  const wheelSpeed = useRef(0.02); // deg/ms idle
  const ballSpeed = useRef(0); // deg/ms, negative = CCW
  const ballFriction = useRef(0); // positive, opposes ballSpeed
  const ballStopped = useRef(true);
  const spinFired = useRef(false); // has onSpinningEnd been called?
  const winningSlotIdx = useRef(0); // the slot the ball must land on

  // Two-phase tracking
  const spinStartTime = useRef(0); // timestamp when spin started
  const spinDuration = useRef(0); // total planned duration
  const phase2Started = useRef(false); // have we entered phase 2?

  // RAF
  const rafId = useRef(0);
  const lastTs = useRef(0);

  // Stable callback ref so the animation loop never goes stale
  const onEndRef = useRef(onSpinningEnd);
  onEndRef.current = onSpinningEnd;

  // DOM refs — written to every frame, no React re-renders
  const wheelDiv = useRef<HTMLDivElement>(null);
  const ballG = useRef<SVGGElement>(null);

  // -------------------------------------------------------------------
  // Animation loop
  // -------------------------------------------------------------------
  const loop = useCallback((now: number) => {
    if (lastTs.current === 0) {
      lastTs.current = now;
      rafId.current = requestAnimationFrame(loop);
      return;
    }
    const dt = Math.min(now - lastTs.current, 50); // cap at 50 ms to avoid jumps
    lastTs.current = now;

    // Wheel — constant-ish clockwise rotation
    wheelAngle.current += wheelSpeed.current * dt;

    // Ball — decelerating CCW
    if (!ballStopped.current) {
      const elapsed = now - spinStartTime.current;
      const totalDur = spinDuration.current;
      const phase2Time = totalDur * 0.70; // switch at 70%

      // --- Phase 2 transition ---
      // When we hit 70% of duration, recalculate ball physics so it arrives
      // exactly at the winning slot using real-time wheel angle (no prediction).
      if (!phase2Started.current && elapsed >= phase2Time) {
        phase2Started.current = true;

        const remaining = totalDur - elapsed; // ms left

        // Where the winning slot will be when the ball stops:
        // wheelAngle will advance by (wheelSpeed * remaining) more degrees.
        // The slot in world coords = (wheelAngle + wheelSpeed*remaining) + slotIdx*SLOT_ANGLE
        // We keep wheel speed constant during the spin so this is accurate.
        const wheelAtEnd = wheelAngle.current + wheelSpeed.current * remaining;
        const targetAngle = wheelAtEnd + winningSlotIdx.current * SLOT_ANGLE;

        // Ball needs to go from current position to targetAngle (CCW, so negative distance).
        // Add 2-3 extra laps so it doesn't look like it's speeding up or reversing.
        const rawDiff = ((targetAngle - ballAngle.current) % 360 + 360) % 360;
        const extraLaps = 2 + Math.floor(Math.random() * 2); // 2-3 laps
        const totalDist = -(extraLaps * 360 + rawDiff); // negative = CCW

        // Kinematics: dist = v0*t + ½*a*t², v_final = 0 → v0 + a*t = 0
        //   v0 = 2*dist/t, a = -v0/t
        const v0 = (2 * totalDist) / remaining;
        const a = -v0 / remaining;

        ballSpeed.current = v0;
        ballFriction.current = a;
      }

      // Normal physics step
      ballAngle.current += ballSpeed.current * dt;
      ballSpeed.current += ballFriction.current * dt;

      if (ballSpeed.current >= 0) {
        ballSpeed.current = 0;
        ballStopped.current = true;

        // No snap needed — the phase 2 kinematics land us on the slot.
        // Just do a tiny correction to be pixel-perfect (< 1 degree drift).
        ballAngle.current = wheelAngle.current + winningSlotIdx.current * SLOT_ANGLE;

        if (!spinFired.current) {
          spinFired.current = true;
          setTimeout(() => {
            onEndRef.current?.();
          }, 600);
        }
      }
    } else {
      // Ball has stopped — lock it to the wheel so it moves with the number
      ballAngle.current += wheelSpeed.current * dt;
    }

    // Write directly to DOM
    if (wheelDiv.current) {
      wheelDiv.current.style.transform = `rotate(${wheelAngle.current}deg)`;
    }
    if (ballG.current) {
      ballG.current.style.transform = `rotate(${ballAngle.current}deg)`;
    }

    rafId.current = requestAnimationFrame(loop);
  }, []);

  // Start loop on mount, clean up on unmount
  useEffect(() => {
    lastTs.current = 0;
    rafId.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId.current);
  }, [loop]);

  // -------------------------------------------------------------------
  // Trigger a spin when `start` goes from false → true
  // -------------------------------------------------------------------
  const triggerSpin = useCallback(() => {
    const slotIdx = WHEEL_SEQUENCE.indexOf(winningBet);
    if (slotIdx === -1) return;

    winningSlotIdx.current = slotIdx;
    spinFired.current = false;
    ballStopped.current = false;
    phase2Started.current = false;

    // Random duration the ball spins: 4.5 – 7 s
    const duration = 4500 + Math.random() * 2500; // ms
    spinDuration.current = duration;
    spinStartTime.current = performance.now();

    // Speed up the wheel while ball is in play (~120 deg/s)
    wheelSpeed.current = 0.12;

    // After the ball stops, ease the wheel back to idle speed
    setTimeout(() => {
      const steps = 20;
      const interval = 100;
      const startSpeed = wheelSpeed.current;
      const endSpeed = 0.02;
      let step = 0;
      const slowDown = setInterval(() => {
        step++;
        wheelSpeed.current = startSpeed + (endSpeed - startSpeed) * (step / steps);
        if (step >= steps) clearInterval(slowDown);
      }, interval);
    }, duration + 800);

    // Phase 1 physics: Ball launches CCW fast, decelerates randomly.
    // This doesn't need to aim at anything — phase 2 will correct the trajectory.
    // Give it enough speed for 5-7 visible laps during phase 1 (~70% of duration).
    const phase1Duration = duration * 0.70;
    const phase1Laps = 5 + Math.random() * 3; // 5-8 laps
    const phase1Dist = -(phase1Laps * 360); // negative = CCW

    // We want the ball to still be moving at end of phase 1 (not stopped).
    // Use kinematics where ball still has ~30% of v0 left at phase1Duration:
    //   dist = v0*t + ½*a*t²
    //   v_end = v0 + a*t = 0.3*v0  ⟹  a = -0.7*v0/t
    //   dist = v0*t + ½*(-0.7*v0/t)*t² = v0*t - 0.35*v0*t = 0.65*v0*t
    //   v0 = dist / (0.65 * t)
    const v0 = phase1Dist / (0.65 * phase1Duration);
    const a = -0.7 * v0 / phase1Duration;

    ballSpeed.current = v0;
    ballFriction.current = a;
  }, [winningBet]);

  useEffect(() => {
    if (start && !prevStartRef.current) {
      triggerSpin();
    }
    prevStartRef.current = start;
  }, [start, triggerSpin]);

  // -------------------------------------------------------------------
  // Static SVG sectors (computed once)
  // -------------------------------------------------------------------
  const sectors = WHEEL_SEQUENCE.map((num, i) => {
    const slotCenter = i * SLOT_ANGLE;
    const halfSlot = SLOT_ANGLE / 2;
    const startDeg = slotCenter - halfSlot - 90;
    const endDeg = slotCenter + halfSlot - 90;
    const startRad = (startDeg * Math.PI) / 180;
    const endRad = (endDeg * Math.PI) / 180;

    const x1O = CENTER + OUTER_R * Math.cos(startRad);
    const y1O = CENTER + OUTER_R * Math.sin(startRad);
    const x2O = CENTER + OUTER_R * Math.cos(endRad);
    const y2O = CENTER + OUTER_R * Math.sin(endRad);
    const x1I = CENTER + INNER_R * Math.cos(endRad);
    const y1I = CENTER + INNER_R * Math.sin(endRad);
    const x2I = CENTER + INNER_R * Math.cos(startRad);
    const y2I = CENTER + INNER_R * Math.sin(startRad);

    const color = getColor(num);
    const fill = color === "green" ? "#00802b" : color === "red" ? "#c41e1e" : "#1a1a1a";

    const midRad = ((startDeg + endDeg) / 2) * (Math.PI / 180);
    const textX = CENTER + NUM_R * Math.cos(midRad);
    const textY = CENTER + NUM_R * Math.sin(midRad);
    const textRot = (startDeg + endDeg) / 2 + 90;

    return (
      <g key={num}>
        <path
          d={`M ${x1O} ${y1O} A ${OUTER_R} ${OUTER_R} 0 0 1 ${x2O} ${y2O} L ${x1I} ${y1I} A ${INNER_R} ${INNER_R} 0 0 0 ${x2I} ${y2I} Z`}
          fill={fill} stroke="#2a2a2a" strokeWidth="0.5"
        />
        <text
          x={textX} y={textY} textAnchor="middle" dominantBaseline="central"
          fill="white" fontSize="10" fontWeight="bold"
          transform={`rotate(${textRot}, ${textX}, ${textY})`}
        >
          {num}
        </text>
      </g>
    );
  });

  // -------------------------------------------------------------------
  // Render — no state-driven re-renders during animation
  // -------------------------------------------------------------------
  return (
    <div className="relative" style={{ width: WHEEL_SIZE, height: WHEEL_SIZE }}>
      {/* Decorative ring (static) */}
      <svg width={WHEEL_SIZE} height={WHEEL_SIZE} className="absolute inset-0 z-0"
        style={{ filter: "drop-shadow(0 0 20px rgba(212,175,55,0.15))" }}>
        <circle cx={CENTER} cy={CENTER} r={OUTER_R - 1} fill="none" stroke="#b8960c" strokeWidth="3" />
        <circle cx={CENTER} cy={CENTER} r={INNER_R} fill="none" stroke="#b8960c" strokeWidth="1.5" />
      </svg>

      {/* Wheel (spins via ref) */}
      <div ref={wheelDiv} className="absolute inset-0 z-10">
        <svg width={WHEEL_SIZE} height={WHEEL_SIZE}>
          {sectors}
          <circle cx={CENTER} cy={CENTER} r={INNER_R * 0.55} fill="#1a1018" />
          <circle cx={CENTER} cy={CENTER} r={INNER_R * 0.5} fill="url(#hubG)" stroke="#b8960c" strokeWidth="2" />
          <defs>
            <radialGradient id="hubG">
              <stop offset="0%" stopColor="#2a2020" />
              <stop offset="100%" stopColor="#0f0a0a" />
            </radialGradient>
          </defs>
          <text x={CENTER} y={CENTER} textAnchor="middle" dominantBaseline="central"
            fill="#d4af37" fontSize="16" fontWeight="bold" fontFamily="serif">
            X
          </text>
        </svg>
      </div>

      {/* Ball (spins independently via ref) */}
      <svg width={WHEEL_SIZE} height={WHEEL_SIZE} className="absolute inset-0 z-20 pointer-events-none">
        <g ref={ballG} style={{ transformOrigin: `${CENTER}px ${CENTER}px` }}>
          <circle
            cx={CENTER} cy={CENTER - BALL_R} r={6}
            fill="#e8e8e8" stroke="#bbb" strokeWidth="1"
            style={{ filter: "drop-shadow(0 0 4px rgba(255,255,255,0.9))" }}
          />
        </g>
      </svg>
    </div>
  );
}
