"use client";

import { useRef, useMemo, forwardRef, useImperativeHandle, useCallback } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, ContactShadows } from "@react-three/drei";
import * as THREE from "three";

// ---------------------------------------------------------------------------
// European wheel order & helpers
// ---------------------------------------------------------------------------

const WHEEL_ORDER = [
  0, 26, 3, 35, 12, 28, 7, 29, 18, 22, 9, 31, 14, 20, 1, 33, 16, 24, 5, 10,
  23, 8, 30, 11, 36, 13, 27, 6, 34, 17, 25, 2, 21, 4, 19, 15, 32,
];
const NUM_POCKETS = 37;
const SECTOR_ANGLE = (Math.PI * 2) / NUM_POCKETS;

const RED_NUMBERS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

function getPocketColor(n: number): string {
  if (n === 0) return "#0d7a36";
  if (RED_NUMBERS.has(n)) return "#c62828";
  return "#1a1a2e";
}

// ---------------------------------------------------------------------------
// Shared animation state (mutable refs to avoid re-renders)
// ---------------------------------------------------------------------------

interface SpinState {
  spinning: boolean;
  startTime: number;
  duration: number;
  wheelStartRot: number;
  wheelTargetRot: number;
  ballTotalRot: number;
  ballOuterR: number;
  ballInnerR: number;
  onComplete: (() => void) | null;
}

const defaultSpinState: SpinState = {
  spinning: false,
  startTime: 0,
  duration: 0,
  wheelStartRot: 0,
  wheelTargetRot: 0,
  ballTotalRot: 0,
  ballOuterR: 2.85,
  ballInnerR: 2.15,
  onComplete: null,
};

// ---------------------------------------------------------------------------
// The 3D wheel mesh group — rendered inside Canvas
// ---------------------------------------------------------------------------

function WheelScene({ spinStateRef, cumulativeRotRef }: {
  spinStateRef: React.MutableRefObject<SpinState>;
  cumulativeRotRef: React.MutableRefObject<number>;
}) {
  const wheelGroupRef = useRef<THREE.Group>(null);
  const ballRef = useRef<THREE.Mesh>(null);

  // Build conic sectors as individual meshes
  const sectors = useMemo(() => {
    const items: { num: number; startAngle: number; endAngle: number; color: string }[] = [];
    for (let i = 0; i < NUM_POCKETS; i++) {
      items.push({
        num: WHEEL_ORDER[i],
        startAngle: i * SECTOR_ANGLE,
        endAngle: (i + 1) * SECTOR_ANGLE,
        color: getPocketColor(WHEEL_ORDER[i]),
      });
    }
    return items;
  }, []);

  // Number textures
  const numberTextures = useMemo(() => {
    const textures: Map<number, THREE.CanvasTexture> = new Map();
    for (const num of WHEEL_ORDER) {
      const canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, 64, 64);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 38px Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "rgba(0,0,0,0.9)";
      ctx.shadowBlur = 4;
      ctx.fillText(String(num), 32, 32);
      const tex = new THREE.CanvasTexture(canvas);
      tex.minFilter = THREE.LinearFilter;
      textures.set(num, tex);
    }
    return textures;
  }, []);

  // Animation loop
  useFrame(() => {
    const s = spinStateRef.current;
    if (!s.spinning) return;

    const now = performance.now();
    const elapsed = now - s.startTime;
    const progress = Math.min(elapsed / s.duration, 1);

    // Cubic ease-out
    const eased = 1 - Math.pow(1 - progress, 3.5);

    // Wheel rotation
    if (wheelGroupRef.current) {
      const rot = s.wheelStartRot + (s.wheelTargetRot - s.wheelStartRot) * eased;
      wheelGroupRef.current.rotation.y = rot;
    }

    // Ball animation
    if (ballRef.current) {
      const currentAngle = s.ballTotalRot * eased;

      let currentRadius = s.ballOuterR;
      const spiralStart = 0.35;
      if (progress > spiralStart) {
        const sp = (progress - spiralStart) / (1 - spiralStart);
        currentRadius = s.ballOuterR - (s.ballOuterR - s.ballInnerR) * (sp * sp);
      }

      // Bounce
      if (progress > 0.92) {
        const bp = (progress - 0.92) / 0.08;
        currentRadius += Math.sin(bp * Math.PI * 4) * 0.06 * (1 - bp);
      }

      // Height
      let ballY = 0.22;
      if (progress < 0.35) {
        ballY = 0.22 + Math.sin(progress * Math.PI * 2) * 0.03;
      } else if (progress > 0.85) {
        const settleP = (progress - 0.85) / 0.15;
        ballY = 0.22 - settleP * 0.08;
      }

      ballRef.current.position.set(
        Math.sin(currentAngle) * currentRadius,
        ballY,
        -Math.cos(currentAngle) * currentRadius
      );
    }

    if (progress >= 1) {
      s.spinning = false;
      cumulativeRotRef.current = s.wheelTargetRot;
      if (s.onComplete) s.onComplete();
    }
  });

  const outerRimR = 3.3;
  const trackOuterR = 3.1;
  const trackInnerR = 2.8;
  const fretOuterR = 2.82;
  const fretInnerR = 2.72;
  const pocketOuterR = 2.72;
  const pocketInnerR = 1.6;
  const numberR = pocketOuterR - 0.38;

  return (
    <>
      {/* Environment for realistic reflections — no visible background */}
      <Environment preset="city" background={false} />
      <ContactShadows position={[0, -0.3, 0]} opacity={0.5} blur={2} far={4} />

      {/* Lighting */}
      <ambientLight intensity={0.3} />
      <directionalLight position={[3, 8, 4]} intensity={1.2} color="#fff8e0" castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-2, 5, -3]} intensity={0.25} color="#c4a060" />
      <pointLight position={[0, 4, 0]} intensity={0.5} color="#d4af37" distance={10} />
      <pointLight position={[0, 3, 3]} intensity={0.3} color="#ffe4b0" distance={12} />

      {/* === STATIC FRAME (doesn't spin) === */}

      {/* Outer wooden rim */}
      <mesh position={[0, -0.08, 0]} receiveShadow>
        <cylinderGeometry args={[outerRimR, outerRimR, 0.35, 64]} />
        <meshStandardMaterial color="#3d2418" roughness={0.55} metalness={0.05} />
      </mesh>

      {/* Ball track ring */}
      <mesh position={[0, 0.05, 0]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[trackInnerR, trackOuterR, 64]} />
        <meshStandardMaterial color="#b0b0b0" roughness={0.15} metalness={0.9} side={THREE.DoubleSide} />
      </mesh>
      {/* Ball track depth */}
      <mesh position={[0, -0.02, 0]} receiveShadow>
        <cylinderGeometry args={[trackOuterR, trackOuterR, 0.14, 64, 1, true]} />
        <meshStandardMaterial color="#909090" roughness={0.2} metalness={0.85} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, -0.02, 0]} receiveShadow>
        <cylinderGeometry args={[trackInnerR, trackInnerR, 0.14, 64, 1, true]} />
        <meshStandardMaterial color="#888" roughness={0.2} metalness={0.85} side={THREE.DoubleSide} />
      </mesh>

      {/* Diamond deflectors */}
      {Array.from({ length: 8 }, (_, i) => {
        const angle = (i * Math.PI * 2) / 8;
        const r = 2.95;
        return (
          <mesh key={`defl-${i}`} position={[Math.cos(angle) * r, 0.12, Math.sin(angle) * r]}
            rotation={[0, -angle, 0]} scale={[1, 0.5, 1]}>
            <octahedronGeometry args={[0.08]} />
            <meshStandardMaterial color="#d4af37" roughness={0.25} metalness={0.85} />
          </mesh>
        );
      })}

      {/* Gold marker at front */}
      <mesh position={[0, 0.15, -outerRimR + 0.05]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.12, 0.24, 4]} />
        <meshStandardMaterial color="#d4af37" roughness={0.3} metalness={0.8} emissive="#332200" emissiveIntensity={0.15} />
      </mesh>

      {/* === SPINNING WHEEL GROUP === */}
      <group ref={wheelGroupRef}>
        {/* Gold fret ring */}
        <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[fretInnerR, fretOuterR, 64]} />
          <meshStandardMaterial color="#d4af37" roughness={0.25} metalness={0.85} emissive="#332200" emissiveIntensity={0.1} side={THREE.DoubleSide} />
        </mesh>

        {/* Pocket sectors */}
        {sectors.map(({ num, startAngle, endAngle, color }) => {
          const shape = new THREE.Shape();
          shape.moveTo(0, 0);
          shape.absarc(0, 0, pocketOuterR, startAngle, endAngle, false);
          shape.lineTo(0, 0);
          return (
            <mesh key={`sector-${num}`} position={[0, -0.06, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
              <extrudeGeometry args={[shape, { depth: 0.18, bevelEnabled: false }]} />
              <meshStandardMaterial color={color} roughness={0.65} metalness={0.05} />
            </mesh>
          );
        })}

        {/* Fret dividers between pockets */}
        {Array.from({ length: NUM_POCKETS }, (_, i) => {
          const angle = i * SECTOR_ANGLE;
          const midR = (pocketOuterR + pocketInnerR) / 2;
          return (
            <mesh key={`fret-${i}`}
              position={[Math.cos(angle) * midR, 0.02, Math.sin(angle) * midR]}
              rotation={[0, -angle + Math.PI / 2, 0]}>
              <boxGeometry args={[0.018, 0.2, pocketOuterR - pocketInnerR]} />
              <meshStandardMaterial color="#c0c0c0" roughness={0.3} metalness={0.9} />
            </mesh>
          );
        })}

        {/* Number labels */}
        {sectors.map(({ num, startAngle }) => {
          const midAngle = startAngle + SECTOR_ANGLE / 2;
          const tex = numberTextures.get(num);
          return (
            <mesh key={`num-${num}`}
              position={[Math.cos(midAngle) * numberR, 0.14, Math.sin(midAngle) * numberR]}
              rotation={[-Math.PI / 2, 0, -midAngle - Math.PI / 2]}>
              <planeGeometry args={[0.3, 0.3]} />
              <meshBasicMaterial map={tex} transparent depthWrite={false} side={THREE.DoubleSide} />
            </mesh>
          );
        })}

        {/* Inner floor */}
        <mesh position={[0, -0.06, 0]} receiveShadow>
          <cylinderGeometry args={[pocketInnerR, pocketInnerR, 0.12, 64]} />
          <meshStandardMaterial color="#1a1a2e" roughness={0.8} metalness={0.1} />
        </mesh>

        {/* Center cone */}
        <mesh position={[0, 0.3, 0]} castShadow>
          <cylinderGeometry args={[0.32, 0.6, 0.65, 32]} />
          <meshStandardMaterial color="#d4af37" roughness={0.2} metalness={0.88} emissive="#221100" emissiveIntensity={0.1} />
        </mesh>

        {/* Cone cap */}
        <mesh position={[0, 0.64, 0]} castShadow>
          <sphereGeometry args={[0.33, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#f0d060" roughness={0.15} metalness={0.92} emissive="#332200" emissiveIntensity={0.08} />
        </mesh>

        {/* Center ring */}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
          <torusGeometry args={[0.6, 0.035, 8, 32]} />
          <meshStandardMaterial color="#b8960c" roughness={0.3} metalness={0.85} />
        </mesh>
      </group>

      {/* === BALL (independent of wheel) === */}
      <mesh ref={ballRef} position={[0, 0.22, -2.85]} castShadow>
        <sphereGeometry args={[0.09, 32, 32]} />
        <meshStandardMaterial color="#f0f0f0" roughness={0.03} metalness={0.97} envMapIntensity={1.2} />
      </mesh>
    </>
  );
}

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface RouletteSceneHandle {
  spin: (winningNumber: number, duration: number) => Promise<void>;
}

interface RouletteSceneProps {
  size?: number;
}

const RouletteScene = forwardRef<RouletteSceneHandle, RouletteSceneProps>(
  function RouletteScene({ size = 420 }, ref) {
    const spinStateRef = useRef<SpinState>({ ...defaultSpinState });
    const cumulativeRotRef = useRef(0);

    useImperativeHandle(ref, () => ({
      spin: (winningNumber: number, duration: number): Promise<void> => {
        return new Promise((resolve) => {
          const winIndex = WHEEL_ORDER.indexOf(winningNumber);
          const winAngle = winIndex * SECTOR_ANGLE + SECTOR_ANGLE / 2;
          const extraRot = Math.PI * 2 * (3 + Math.floor(Math.random() * 3));
          const targetRot = cumulativeRotRef.current - (extraRot + winAngle);

          const ballOrbits = 5 + Math.floor(Math.random() * 4);

          spinStateRef.current = {
            spinning: true,
            startTime: performance.now(),
            duration,
            wheelStartRot: cumulativeRotRef.current,
            wheelTargetRot: targetRot,
            ballTotalRot: Math.PI * 2 * ballOrbits,
            ballOuterR: 2.85,
            ballInnerR: 2.15,
            onComplete: resolve,
          };
        });
      },
    }), []);

    return (
      <div style={{ width: size, height: size }}>
        <Canvas
          camera={{ position: [0, 5.5, 3.0], fov: 38 }}
          shadows
          gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1 }}
          dpr={[1, 2]}
          onCreated={({ scene }) => { scene.background = new THREE.Color(0x08080c); }}
        >
          <WheelScene spinStateRef={spinStateRef} cumulativeRotRef={cumulativeRotRef} />
        </Canvas>
      </div>
    );
  }
);

export default RouletteScene;
