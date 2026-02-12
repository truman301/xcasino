"use client";

import { useState, useEffect, useRef, useCallback } from "react";

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
  winningBet: string; // "0", "00", or "1"-"36"
  onSpinningEnd?: () => void;
  withAnimation?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RouletteWheel({
  start,
  winningBet,
  onSpinningEnd,
}: RouletteWheelProps) {
  const [spinning, setSpinning] = useState(false);
  // wheelAngle is the cumulative rotation of the wheel (positive = clockwise)
  const [wheelAngle, setWheelAngle] = useState(0);
  // ballAngle is the angle of the ball in world-space (separate from wheel)
  const [ballAngle, setBallAngle] = useState(0);
  const prevStartRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const WHEEL_SIZE = 340;
  const CENTER = WHEEL_SIZE / 2;
  const OUTER_R = WHEEL_SIZE / 2;
  const INNER_R = OUTER_R * 0.62;
  const NUM_R = (OUTER_R + INNER_R) / 2;
  const BALL_R = OUTER_R * 0.85;

  // The first slot ("0") is drawn centered at the top (12 o'clock = -90°).
  // Slot i is at angle: i * SLOT_ANGLE degrees (measured clockwise from top).
  // When the wheel rotates by W degrees clockwise, slot i's world position
  // is at angle: i * SLOT_ANGLE + W.
  //
  // To make the ball land on slot S, we need:
  //   ballAngle ≡ S * SLOT_ANGLE + wheelAngle   (mod 360)
  //
  // Strategy:
  //   - Spin the wheel clockwise a bunch of times
  //   - Spin the ball counter-clockwise a bunch of times, ending exactly
  //     on the winning slot's world position.

  const triggerSpin = useCallback(() => {
    if (spinning) return;
    setSpinning(true);

    const slotIdx = WHEEL_SEQUENCE.indexOf(winningBet);
    if (slotIdx === -1) return;

    // Wheel spins clockwise: add 5-8 full rotations
    const wheelSpins = 5 + Math.random() * 3;
    const newWheelAngle = wheelAngle + 360 * wheelSpins;

    // Ball target: the slot's world-space angle after the wheel stops
    // Slot i is drawn at (i * SLOT_ANGLE) on the wheel graphic.
    // After wheel rotates by newWheelAngle, slot i is at world angle:
    //   slotWorldAngle = i * SLOT_ANGLE + newWheelAngle
    // We want the ball to end up there.
    const slotWorldAngle = slotIdx * SLOT_ANGLE + newWheelAngle;

    // Ball spins counter-clockwise: go backwards 7-10 full rotations,
    // then land on slotWorldAngle.
    const ballSpins = 7 + Math.random() * 3;
    // Current ball angle -> target. Make it go counter-clockwise by subtracting.
    // We need to end at slotWorldAngle (mod 360 doesn't matter for animation).
    // Make sure we add enough backward spins to look like it's spinning opposite.
    const newBallAngle = slotWorldAngle - 360 * ballSpins;

    setWheelAngle(newWheelAngle);
    setBallAngle(newBallAngle);

    // End after animation completes
    timerRef.current = setTimeout(() => {
      setSpinning(false);
      onSpinningEnd?.();
    }, 5000);
  }, [spinning, winningBet, wheelAngle, onSpinningEnd]);

  useEffect(() => {
    if (start && !prevStartRef.current) {
      triggerSpin();
    }
    prevStartRef.current = start;
  }, [start, triggerSpin]);

  // Clean up timer
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // -------------------------------------------------------------------------
  // Build SVG sectors
  // -------------------------------------------------------------------------

  const sectors = WHEEL_SEQUENCE.map((num, i) => {
    // Each slot spans SLOT_ANGLE degrees, centered at i * SLOT_ANGLE from top
    const slotCenter = i * SLOT_ANGLE; // degrees clockwise from top
    const halfSlot = SLOT_ANGLE / 2;
    // Convert to standard math angles (counterclockwise from right = 0)
    // "top" in SVG = -90 degrees in math
    const startDeg = slotCenter - halfSlot - 90;
    const endDeg = slotCenter + halfSlot - 90;
    const startRad = (startDeg * Math.PI) / 180;
    const endRad = (endDeg * Math.PI) / 180;

    const x1Outer = CENTER + OUTER_R * Math.cos(startRad);
    const y1Outer = CENTER + OUTER_R * Math.sin(startRad);
    const x2Outer = CENTER + OUTER_R * Math.cos(endRad);
    const y2Outer = CENTER + OUTER_R * Math.sin(endRad);

    const x1Inner = CENTER + INNER_R * Math.cos(endRad);
    const y1Inner = CENTER + INNER_R * Math.sin(endRad);
    const x2Inner = CENTER + INNER_R * Math.cos(startRad);
    const y2Inner = CENTER + INNER_R * Math.sin(startRad);

    const color = getColor(num);
    const fill =
      color === "green" ? "#00802b" : color === "red" ? "#c41e1e" : "#1a1a1a";

    const midRad = ((startDeg + endDeg) / 2) * (Math.PI / 180);
    const textX = CENTER + NUM_R * Math.cos(midRad);
    const textY = CENTER + NUM_R * Math.sin(midRad);
    // Rotate text so it reads outward from center
    const textRotation = (startDeg + endDeg) / 2 + 90;

    const path = [
      `M ${x1Outer} ${y1Outer}`,
      `A ${OUTER_R} ${OUTER_R} 0 0 1 ${x2Outer} ${y2Outer}`,
      `L ${x1Inner} ${y1Inner}`,
      `A ${INNER_R} ${INNER_R} 0 0 0 ${x2Inner} ${y2Inner}`,
      "Z",
    ].join(" ");

    return (
      <g key={num}>
        <path d={path} fill={fill} stroke="#2a2a2a" strokeWidth="0.5" />
        <text
          x={textX}
          y={textY}
          textAnchor="middle"
          dominantBaseline="central"
          fill="white"
          fontSize="10"
          fontWeight="bold"
          transform={`rotate(${textRotation}, ${textX}, ${textY})`}
        >
          {num}
        </text>
      </g>
    );
  });

  // Ball position: rendered at its angle relative to center
  // We place it at BALL_R from center, at angle ballAngle - wheelAngle
  // (because the ball SVG is inside the wheel div which already rotates).
  // Actually, let's render the ball outside the wheel div so its position
  // is in world-space.
  const ballRad = ((ballAngle - 90) * Math.PI) / 180;
  const ballX = CENTER + BALL_R * Math.cos(ballRad);
  const ballY = CENTER + BALL_R * Math.sin(ballRad);

  return (
    <div className="relative" style={{ width: WHEEL_SIZE, height: WHEEL_SIZE }}>
      {/* Outer decorative ring (static) */}
      <svg
        width={WHEEL_SIZE}
        height={WHEEL_SIZE}
        className="absolute inset-0 z-0"
        style={{ filter: "drop-shadow(0 0 20px rgba(212,175,55,0.15))" }}
      >
        <circle
          cx={CENTER}
          cy={CENTER}
          r={OUTER_R - 1}
          fill="none"
          stroke="#b8960c"
          strokeWidth="3"
        />
        <circle
          cx={CENTER}
          cy={CENTER}
          r={INNER_R}
          fill="none"
          stroke="#b8960c"
          strokeWidth="1.5"
        />
      </svg>

      {/* Spinning wheel (sectors + hub) */}
      <div
        className="absolute inset-0 z-10"
        style={{
          transform: `rotate(${wheelAngle}deg)`,
          transition: spinning
            ? "transform 5s cubic-bezier(0.17, 0.67, 0.12, 0.99)"
            : "none",
        }}
      >
        <svg width={WHEEL_SIZE} height={WHEEL_SIZE}>
          {sectors}
          {/* Center hub */}
          <circle cx={CENTER} cy={CENTER} r={INNER_R * 0.55} fill="#1a1018" />
          <circle
            cx={CENTER}
            cy={CENTER}
            r={INNER_R * 0.5}
            fill="url(#hubGradient)"
            stroke="#b8960c"
            strokeWidth="2"
          />
          <defs>
            <radialGradient id="hubGradient">
              <stop offset="0%" stopColor="#2a2020" />
              <stop offset="100%" stopColor="#0f0a0a" />
            </radialGradient>
          </defs>
          <text
            x={CENTER}
            y={CENTER}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#d4af37"
            fontSize="16"
            fontWeight="bold"
            fontFamily="serif"
          >
            X
          </text>
        </svg>
      </div>

      {/* Ball — world-space, animated independently */}
      <svg
        width={WHEEL_SIZE}
        height={WHEEL_SIZE}
        className="absolute inset-0 z-20 pointer-events-none"
      >
        <g
          style={{
            transformOrigin: `${CENTER}px ${CENTER}px`,
            transform: `rotate(${ballAngle}deg)`,
            transition: spinning
              ? "transform 5s cubic-bezier(0.17, 0.67, 0.05, 0.99)"
              : "none",
          }}
        >
          {/* Ball drawn at "top" of the circle, rotation moves it */}
          <circle
            cx={CENTER}
            cy={CENTER - BALL_R}
            r={6}
            fill="#e8e8e8"
            stroke="#bbb"
            strokeWidth="1"
            style={{
              filter: "drop-shadow(0 0 4px rgba(255,255,255,0.9))",
            }}
          />
        </g>
      </svg>
    </div>
  );
}
