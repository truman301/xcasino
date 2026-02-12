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

const SLOT_ANGLE = 360 / WHEEL_SEQUENCE.length; // ~9.47° per slot

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
  const [wheelRotation, setWheelRotation] = useState(0);
  const [ballRotation, setBallRotation] = useState(0);
  const prevStartRef = useRef(false);
  const wheelRef = useRef<HTMLDivElement>(null);

  const WHEEL_SIZE = 340;
  const CENTER = WHEEL_SIZE / 2;
  const OUTER_R = WHEEL_SIZE / 2;
  const INNER_R = OUTER_R * 0.62;
  const NUM_R = (OUTER_R + INNER_R) / 2;
  const BALL_R = OUTER_R * 0.82;

  // Detect start rising edge
  const triggerSpin = useCallback(() => {
    if (spinning) return;
    setSpinning(true);

    // Find slot index
    const slotIdx = WHEEL_SEQUENCE.indexOf(winningBet);
    if (slotIdx === -1) return;

    // We need to rotate the wheel so that the winning slot ends up at the top (12 o'clock).
    // The slot's angle on the wheel = slotIdx * SLOT_ANGLE from the 0th slot.
    // We spin multiple full rotations + the offset to bring that slot to top.
    const spins = 5 + Math.random() * 3; // 5-8 full rotations
    const targetAngle = slotIdx * SLOT_ANGLE;
    // Wheel rotates, ball stays at top, so rotate wheel so slot is at top
    // That means rotate by -(targetAngle) + full spins
    const totalWheelRotation = wheelRotation + 360 * spins + (360 - targetAngle);

    // Ball spins opposite direction
    const ballSpins = 7 + Math.random() * 3;
    const totalBallRotation = ballRotation - 360 * ballSpins;

    setWheelRotation(totalWheelRotation);
    setBallRotation(totalBallRotation);

    // End after animation
    setTimeout(() => {
      setSpinning(false);
      onSpinningEnd?.();
    }, 5000);
  }, [spinning, winningBet, wheelRotation, ballRotation, onSpinningEnd]);

  useEffect(() => {
    if (start && !prevStartRef.current) {
      triggerSpin();
    }
    prevStartRef.current = start;
  }, [start, triggerSpin]);

  // -------------------------------------------------------------------------
  // Build SVG sectors
  // -------------------------------------------------------------------------

  const sectors = WHEEL_SEQUENCE.map((num, i) => {
    const startAngle = (i * SLOT_ANGLE - 90 - SLOT_ANGLE / 2) * (Math.PI / 180);
    const endAngle = startAngle + SLOT_ANGLE * (Math.PI / 180);

    const x1Outer = CENTER + OUTER_R * Math.cos(startAngle);
    const y1Outer = CENTER + OUTER_R * Math.sin(startAngle);
    const x2Outer = CENTER + OUTER_R * Math.cos(endAngle);
    const y2Outer = CENTER + OUTER_R * Math.sin(endAngle);

    const x1Inner = CENTER + INNER_R * Math.cos(endAngle);
    const y1Inner = CENTER + INNER_R * Math.sin(endAngle);
    const x2Inner = CENTER + INNER_R * Math.cos(startAngle);
    const y2Inner = CENTER + INNER_R * Math.sin(startAngle);

    const color = getColor(num);
    const fill =
      color === "green" ? "#00802b" : color === "red" ? "#c41e1e" : "#1a1a1a";

    const midAngle = (startAngle + endAngle) / 2;
    const textX = CENTER + NUM_R * Math.cos(midAngle);
    const textY = CENTER + NUM_R * Math.sin(midAngle);
    const textRotation = (midAngle * 180) / Math.PI + 90;

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

  // Ball position (at top, i.e. 12 o'clock)
  const ballAngle = -90 * (Math.PI / 180);
  const ballX = CENTER + BALL_R * Math.cos(ballAngle);
  const ballY = CENTER + BALL_R * Math.sin(ballAngle);

  return (
    <div className="relative" style={{ width: WHEEL_SIZE, height: WHEEL_SIZE }}>
      {/* Outer decorative ring */}
      <svg
        width={WHEEL_SIZE}
        height={WHEEL_SIZE}
        className="absolute inset-0"
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

      {/* Spinning wheel */}
      <div
        ref={wheelRef}
        className="absolute inset-0"
        style={{
          transform: `rotate(${wheelRotation}deg)`,
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

      {/* Ball (spins independently) */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          transform: `rotate(${ballRotation}deg)`,
          transition: spinning
            ? "transform 5s cubic-bezier(0.17, 0.67, 0.05, 0.99)"
            : "none",
        }}
      >
        <svg width={WHEEL_SIZE} height={WHEEL_SIZE}>
          <circle
            cx={ballX}
            cy={ballY}
            r={5}
            fill="#f0f0f0"
            stroke="#ccc"
            strokeWidth="1"
            style={{
              filter: "drop-shadow(0 0 3px rgba(255,255,255,0.8))",
            }}
          />
        </svg>
      </div>

      {/* Pointer / marker at top */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-20">
        <div
          className="w-0 h-0"
          style={{
            borderLeft: "8px solid transparent",
            borderRight: "8px solid transparent",
            borderTop: "14px solid #d4af37",
            filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))",
          }}
        />
      </div>
    </div>
  );
}
