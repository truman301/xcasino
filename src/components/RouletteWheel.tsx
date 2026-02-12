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
// Uses requestAnimationFrame for smooth physics:
//   - Wheel spins clockwise at a steady speed (slows gently, never fully stops)
//   - Ball launches counter-clockwise fast, decelerates with friction,
//     and comes to rest after 4.5–7 s
//   - Final ball angle is pre-calculated so that when the ball stops it
//     visually sits on the winning slot relative to the wheel's position
//     at that exact moment
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
      ballAngle.current += ballSpeed.current * dt;
      // Apply friction (ballSpeed is negative, friction is positive → moves toward 0)
      ballSpeed.current += ballFriction.current * dt;
      if (ballSpeed.current >= 0) {
        ballSpeed.current = 0;
        ballStopped.current = true;
        if (!spinFired.current) {
          spinFired.current = true;
          // Let the player see where it landed for 600 ms
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

    spinFired.current = false;
    ballStopped.current = false;

    // Random duration the ball spins: 4.5 – 7 s
    const duration = 4500 + Math.random() * 2500; // ms

    // Speed up the wheel while ball is in play (~120 deg/s)
    wheelSpeed.current = 0.12;

    // After the ball stops, ease the wheel back to idle speed
    setTimeout(() => {
      // Gradually slow wheel back to idle over ~2 s (step down)
      const steps = 20;
      const interval = 100; // ms per step
      const startSpeed = wheelSpeed.current;
      const endSpeed = 0.02;
      let step = 0;
      const slowDown = setInterval(() => {
        step++;
        wheelSpeed.current = startSpeed + (endSpeed - startSpeed) * (step / steps);
        if (step >= steps) clearInterval(slowDown);
      }, interval);
    }, duration + 800);

    // Calculate where wheel will be when ball stops
    // wheelAngle at ball stop ≈ current + wheelSpeed * duration
    // (wheel speed is constant during the ball spin)
    const wheelAtStop = wheelAngle.current + 0.12 * duration;

    // The winning slot sits at (slotIdx * SLOT_ANGLE) in wheel-local coords.
    // In world coords that's: wheelAtStop + slotIdx * SLOT_ANGLE
    // The ball must end there.
    const targetBallAngle = wheelAtStop + slotIdx * SLOT_ANGLE;

    // Ball travels CCW from current position to targetBallAngle,
    // plus several extra full laps for visual effect.
    const extraLaps = 6 + Math.floor(Math.random() * 4); // 6-9
    // Normalize the remainder so it's positive
    const remainder = ((targetBallAngle - ballAngle.current) % 360 + 360) % 360;
    // Total CCW distance (negative because CCW)
    const totalDist = -(extraLaps * 360 + remainder);

    // Kinematics:  dist = v0*t + ½*a*t²   and   v0 + a*t = 0 (stops at t)
    //   ⇒ v0 = 2*dist / t   and   a = -v0/t = -2*dist/t²
    const v0 = (2 * totalDist) / duration; // negative
    const a = -v0 / duration; // positive (friction)

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
