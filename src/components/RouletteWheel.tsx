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
//
// How it works:
//   - The wheel is one <div> that CSS-rotates.
//   - The ball is drawn INSIDE the wheel SVG at the winning slot's position,
//     so it always stays perfectly aligned with that slot.
//   - We spin the wheel many full rotations plus an offset so the winning
//     slot ends up at the top (12 o'clock).
//   - Since the ball is part of the wheel, it spins with it and naturally
//     ends up at the top too.
// ---------------------------------------------------------------------------

export default function RouletteWheel({
  start,
  winningBet,
  onSpinningEnd,
}: RouletteWheelProps) {
  const [spinning, setSpinning] = useState(false);
  const [wheelAngle, setWheelAngle] = useState(0);
  const [ballSlotIdx, setBallSlotIdx] = useState(0); // which slot the ball sits on
  const prevStartRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const WHEEL_SIZE = 340;
  const CENTER = WHEEL_SIZE / 2;
  const OUTER_R = WHEEL_SIZE / 2;
  const INNER_R = OUTER_R * 0.62;
  const NUM_R = (OUTER_R + INNER_R) / 2;
  const BALL_R = OUTER_R * 0.85;

  const triggerSpin = useCallback(() => {
    if (spinning) return;
    setSpinning(true);

    const slotIdx = WHEEL_SEQUENCE.indexOf(winningBet);
    if (slotIdx === -1) return;

    // Place the ball on the winning slot (relative to the wheel)
    setBallSlotIdx(slotIdx);

    // We need to rotate the wheel so that slot `slotIdx` ends up at the top.
    // Slot i sits at angle (i * SLOT_ANGLE) on the unrotated wheel (slot 0 = top).
    // To bring slot i to the top, we need to rotate the wheel by -(i * SLOT_ANGLE),
    // i.e. counter-clockwise. But CSS rotate(positive) = clockwise visual rotation.
    // So we need: finalAngle mod 360 == 360 - (slotIdx * SLOT_ANGLE)
    //
    // Add multiple full rotations for the spin effect.
    const targetOffset = 360 - slotIdx * SLOT_ANGLE; // where the wheel must stop (mod 360)
    const fullSpins = 5 + Math.floor(Math.random() * 4); // 5-8 full rotations

    // Current angle mod 360
    const currentMod = ((wheelAngle % 360) + 360) % 360;
    // How much more we need to rotate from current position to reach targetOffset
    let delta = targetOffset - currentMod;
    if (delta < 0) delta += 360;

    const newWheelAngle = wheelAngle + fullSpins * 360 + delta;

    setWheelAngle(newWheelAngle);

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

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // -------------------------------------------------------------------------
  // Build SVG sectors
  // -------------------------------------------------------------------------

  const sectors = WHEEL_SEQUENCE.map((num, i) => {
    const slotCenter = i * SLOT_ANGLE;
    const halfSlot = SLOT_ANGLE / 2;
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

  // -------------------------------------------------------------------------
  // Ball position — relative to the wheel (drawn inside wheel SVG)
  // -------------------------------------------------------------------------

  const ballCenterDeg = ballSlotIdx * SLOT_ANGLE - 90; // -90 to convert from "top=0" to math coords
  const ballRad = (ballCenterDeg * Math.PI) / 180;
  const ballX = CENTER + BALL_R * Math.cos(ballRad);
  const ballY = CENTER + BALL_R * Math.sin(ballRad);

  return (
    <div className="relative" style={{ width: WHEEL_SIZE, height: WHEEL_SIZE }}>
      {/* Outer decorative ring (static, doesn't spin) */}
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

      {/* Spinning wheel — sectors + hub + ball all rotate together */}
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

          {/* Ball — sits on the winning slot, rotates with wheel */}
          <circle
            cx={ballX}
            cy={ballY}
            r={6}
            fill="#e8e8e8"
            stroke="#bbb"
            strokeWidth="1"
            style={{
              filter: "drop-shadow(0 0 4px rgba(255,255,255,0.9))",
            }}
          />

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
    </div>
  );
}
