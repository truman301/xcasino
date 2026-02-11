"use client";

import { useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from "react";
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

function getPocketColor(n: number): THREE.Color {
  if (n === 0) return new THREE.Color(0x0d7a36);
  if (RED_NUMBERS.has(n)) return new THREE.Color(0xb91c1c);
  return new THREE.Color(0x18182b);
}

// ---------------------------------------------------------------------------
// Public interface for the parent component to trigger spins
// ---------------------------------------------------------------------------

export interface RouletteWheel3DHandle {
  spin: (winningNumber: number, duration: number) => Promise<void>;
}

interface RouletteWheel3DProps {
  size?: number;
  result: number | null;
  spinning: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const RouletteWheel3D = forwardRef<RouletteWheel3DHandle, RouletteWheel3DProps>(
  function RouletteWheel3D({ size = 380 }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const wheelGroupRef = useRef<THREE.Group | null>(null);
    const ballRef = useRef<THREE.Mesh | null>(null);
    const animFrameRef = useRef<number>(0);
    const cumulativeRotation = useRef(0);

    // Ball animation state
    const ballAnimState = useRef({
      running: false,
      startTime: 0,
      duration: 0,
      totalRotation: 0,
      outerRadius: 0,
      innerRadius: 0,
    });

    // Wheel animation state
    const wheelAnimState = useRef({
      running: false,
      startTime: 0,
      duration: 0,
      startRotation: 0,
      targetRotation: 0,
    });

    // -----------------------------------------------------------------------
    // Build the scene
    // -----------------------------------------------------------------------

    const buildScene = useCallback(() => {
      if (!containerRef.current) return;

      // Renderer
      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
      });
      renderer.setSize(size, size);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.1;
      containerRef.current.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      // Scene
      const scene = new THREE.Scene();
      sceneRef.current = scene;

      // Camera — top-down slight angle for immersive look
      const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
      camera.position.set(0, 5.5, 2.8);
      camera.lookAt(0, 0, 0);
      cameraRef.current = camera;

      // Lighting
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
      scene.add(ambientLight);

      const mainLight = new THREE.DirectionalLight(0xfff8e8, 1.2);
      mainLight.position.set(2, 8, 3);
      mainLight.castShadow = true;
      mainLight.shadow.mapSize.width = 1024;
      mainLight.shadow.mapSize.height = 1024;
      mainLight.shadow.camera.near = 0.5;
      mainLight.shadow.camera.far = 20;
      mainLight.shadow.camera.left = -4;
      mainLight.shadow.camera.right = 4;
      mainLight.shadow.camera.top = 4;
      mainLight.shadow.camera.bottom = -4;
      scene.add(mainLight);

      const fillLight = new THREE.DirectionalLight(0xc4b08a, 0.3);
      fillLight.position.set(-3, 5, -2);
      scene.add(fillLight);

      const rimLight = new THREE.PointLight(0xd4af37, 0.6, 12);
      rimLight.position.set(0, 3, -3);
      scene.add(rimLight);

      // A second warm light from the front
      const frontWarm = new THREE.PointLight(0xffddaa, 0.4, 15);
      frontWarm.position.set(0, 4, 4);
      scene.add(frontWarm);

      // -----------------------------------------------------------------------
      // Build the wheel
      // -----------------------------------------------------------------------

      const wheelGroup = new THREE.Group();
      wheelGroupRef.current = wheelGroup;
      scene.add(wheelGroup);

      // ----- Outer rim (mahogany wood) -----
      const outerRimGeo = new THREE.CylinderGeometry(3.2, 3.2, 0.3, 64);
      const outerRimMat = new THREE.MeshStandardMaterial({
        color: 0x3d2418,
        roughness: 0.6,
        metalness: 0.1,
      });
      const outerRim = new THREE.Mesh(outerRimGeo, outerRimMat);
      outerRim.position.y = -0.05;
      outerRim.receiveShadow = true;
      wheelGroup.add(outerRim);

      // ----- Ball track (metallic ring) -----
      const trackOuterRadius = 3.0;
      const trackInnerRadius = 2.7;
      const trackShape = new THREE.Shape();
      trackShape.absarc(0, 0, trackOuterRadius, 0, Math.PI * 2, false);
      const trackHole = new THREE.Path();
      trackHole.absarc(0, 0, trackInnerRadius, 0, Math.PI * 2, true);
      trackShape.holes.push(trackHole);

      const trackGeo = new THREE.ExtrudeGeometry(trackShape, {
        depth: 0.12,
        bevelEnabled: false,
      });
      trackGeo.rotateX(-Math.PI / 2);
      const trackMat = new THREE.MeshStandardMaterial({
        color: 0xaaaaaa,
        roughness: 0.25,
        metalness: 0.85,
      });
      const track = new THREE.Mesh(trackGeo, trackMat);
      track.position.y = 0.06;
      track.receiveShadow = true;
      // Ball track is part of the outer frame (doesn't spin)
      scene.add(track);

      // Also add a copy to scene (static) — wait, the track SHOULD be static
      // We'll add the track to the scene directly, not the wheelGroup.
      // Actually let's re-add the outerRim to scene directly too since outer frame doesn't spin
      wheelGroup.remove(outerRim);
      scene.add(outerRim);

      // ----- Gold fret ring -----
      const fretOuterRadius = 2.72;
      const fretInnerRadius = 2.62;
      const fretShape = new THREE.Shape();
      fretShape.absarc(0, 0, fretOuterRadius, 0, Math.PI * 2, false);
      const fretHole = new THREE.Path();
      fretHole.absarc(0, 0, fretInnerRadius, 0, Math.PI * 2, true);
      fretShape.holes.push(fretHole);

      const fretGeo = new THREE.ExtrudeGeometry(fretShape, {
        depth: 0.16,
        bevelEnabled: false,
      });
      fretGeo.rotateX(-Math.PI / 2);
      const fretMat = new THREE.MeshStandardMaterial({
        color: 0xd4af37,
        roughness: 0.3,
        metalness: 0.8,
        emissive: 0x443300,
        emissiveIntensity: 0.1,
      });
      const fretRing = new THREE.Mesh(fretGeo, fretMat);
      fretRing.position.y = 0.02;
      wheelGroup.add(fretRing);

      // ----- Pockets (colored sectors) -----
      const pocketOuterRadius = 2.62;
      const pocketInnerRadius = 1.6;

      for (let i = 0; i < NUM_POCKETS; i++) {
        const num = WHEEL_ORDER[i];
        const startAngle = i * SECTOR_ANGLE;
        const endAngle = (i + 1) * SECTOR_ANGLE;

        // Sector
        const sectorShape = new THREE.Shape();
        sectorShape.moveTo(0, 0);
        sectorShape.absarc(
          0,
          0,
          pocketOuterRadius,
          startAngle,
          endAngle,
          false
        );
        sectorShape.lineTo(0, 0);

        const sectorGeo = new THREE.ExtrudeGeometry(sectorShape, {
          depth: 0.18,
          bevelEnabled: false,
        });
        sectorGeo.rotateX(-Math.PI / 2);

        const color = getPocketColor(num);
        const sectorMat = new THREE.MeshStandardMaterial({
          color: color,
          roughness: 0.7,
          metalness: 0.05,
        });

        const sector = new THREE.Mesh(sectorGeo, sectorMat);
        sector.position.y = -0.05;
        sector.receiveShadow = true;
        wheelGroup.add(sector);

        // Metal fret divider between pockets
        const fretDividerGeo = new THREE.BoxGeometry(0.02, 0.2, pocketOuterRadius - pocketInnerRadius);
        const fretDividerMat = new THREE.MeshStandardMaterial({
          color: 0xcccccc,
          roughness: 0.3,
          metalness: 0.9,
        });
        const fretDivider = new THREE.Mesh(fretDividerGeo, fretDividerMat);
        const fretAngle = startAngle;
        const fretMidRadius = (pocketOuterRadius + pocketInnerRadius) / 2;
        fretDivider.position.set(
          Math.cos(fretAngle) * fretMidRadius,
          0.02,
          Math.sin(fretAngle) * fretMidRadius
        );
        fretDivider.rotation.y = -fretAngle + Math.PI / 2;
        wheelGroup.add(fretDivider);

        // Number text — using canvas texture on a small plane
        const midAngle = startAngle + SECTOR_ANGLE / 2;
        const textRadius = pocketOuterRadius - 0.4;
        const canvas = document.createElement("canvas");
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext("2d")!;
        ctx.clearRect(0, 0, 64, 64);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 36px Arial, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.shadowColor = "rgba(0,0,0,0.8)";
        ctx.shadowBlur = 4;
        ctx.fillText(String(num), 32, 32);

        const numberTexture = new THREE.CanvasTexture(canvas);
        numberTexture.minFilter = THREE.LinearFilter;
        const numberMat = new THREE.MeshBasicMaterial({
          map: numberTexture,
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
        const numberGeo = new THREE.PlaneGeometry(0.32, 0.32);
        const numberMesh = new THREE.Mesh(numberGeo, numberMat);
        numberMesh.position.set(
          Math.cos(midAngle) * textRadius,
          0.15,
          Math.sin(midAngle) * textRadius
        );
        numberMesh.rotation.x = -Math.PI / 2;
        numberMesh.rotation.z = -midAngle - Math.PI / 2;
        wheelGroup.add(numberMesh);
      }

      // ----- Inner pocket floor (dark base) -----
      const innerFloorGeo = new THREE.CylinderGeometry(
        pocketInnerRadius,
        pocketInnerRadius,
        0.12,
        64
      );
      const innerFloorMat = new THREE.MeshStandardMaterial({
        color: 0x1a1a2e,
        roughness: 0.8,
        metalness: 0.1,
      });
      const innerFloor = new THREE.Mesh(innerFloorGeo, innerFloorMat);
      innerFloor.position.y = -0.05;
      wheelGroup.add(innerFloor);

      // ----- Center cone (gold turret) -----
      const coneGeo = new THREE.CylinderGeometry(0.35, 0.65, 0.7, 32);
      const coneMat = new THREE.MeshStandardMaterial({
        color: 0xd4af37,
        roughness: 0.25,
        metalness: 0.85,
        emissive: 0x332200,
        emissiveIntensity: 0.15,
      });
      const cone = new THREE.Mesh(coneGeo, coneMat);
      cone.position.y = 0.3;
      cone.castShadow = true;
      wheelGroup.add(cone);

      // Cone cap
      const capGeo = new THREE.SphereGeometry(0.36, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
      const capMat = new THREE.MeshStandardMaterial({
        color: 0xf0d060,
        roughness: 0.2,
        metalness: 0.9,
        emissive: 0x443300,
        emissiveIntensity: 0.1,
      });
      const cap = new THREE.Mesh(capGeo, capMat);
      cap.position.y = 0.65;
      cap.castShadow = true;
      wheelGroup.add(cap);

      // Center ring decorative
      const centerRingGeo = new THREE.TorusGeometry(0.65, 0.04, 8, 32);
      const centerRingMat = new THREE.MeshStandardMaterial({
        color: 0xb8960c,
        roughness: 0.3,
        metalness: 0.85,
      });
      const centerRing = new THREE.Mesh(centerRingGeo, centerRingMat);
      centerRing.rotation.x = Math.PI / 2;
      centerRing.position.y = 0.0;
      wheelGroup.add(centerRing);

      // ----- Diamond deflectors on ball track -----
      for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI * 2) / 8;
        const r = 2.85;
        const deflectorGeo = new THREE.OctahedronGeometry(0.08, 0);
        const deflectorMat = new THREE.MeshStandardMaterial({
          color: 0xd4af37,
          roughness: 0.3,
          metalness: 0.8,
        });
        const deflector = new THREE.Mesh(deflectorGeo, deflectorMat);
        deflector.position.set(
          Math.cos(angle) * r,
          0.14,
          Math.sin(angle) * r
        );
        deflector.rotation.y = angle;
        deflector.scale.set(1, 0.6, 1);
        scene.add(deflector); // static — part of outer frame
      }

      // ----- Gold marker pointer (at the "front" = negative z) -----
      const markerShape = new THREE.Shape();
      markerShape.moveTo(0, 0);
      markerShape.lineTo(-0.1, 0.25);
      markerShape.lineTo(0.1, 0.25);
      markerShape.closePath();
      const markerGeo = new THREE.ExtrudeGeometry(markerShape, {
        depth: 0.06,
        bevelEnabled: false,
      });
      const markerMat = new THREE.MeshStandardMaterial({
        color: 0xd4af37,
        roughness: 0.3,
        metalness: 0.8,
        emissive: 0x443300,
        emissiveIntensity: 0.2,
      });
      const marker = new THREE.Mesh(markerGeo, markerMat);
      marker.position.set(0, 0.15, -3.3);
      marker.rotation.x = -Math.PI / 2;
      scene.add(marker);

      // ----- Ball (shiny chrome sphere) -----
      const ballGeo = new THREE.SphereGeometry(0.1, 32, 32);
      const ballMat = new THREE.MeshStandardMaterial({
        color: 0xf8f8f8,
        roughness: 0.05,
        metalness: 0.95,
        envMapIntensity: 1.0,
      });
      const ball = new THREE.Mesh(ballGeo, ballMat);
      ball.castShadow = true;
      ball.position.set(0, 0.22, -2.85);
      scene.add(ball);
      ballRef.current = ball;

      // ----- Env map for reflections -----
      const cubeRenderTarget = new THREE.WebGLCubeRenderTarget(128);
      const cubeCamera = new THREE.CubeCamera(0.1, 10, cubeRenderTarget);
      cubeCamera.position.set(0, 1, 0);
      scene.add(cubeCamera);

      // Set the envMap on ball and metallic surfaces
      cubeCamera.update(renderer, scene);
      ballMat.envMap = cubeRenderTarget.texture;
      coneMat.envMap = cubeRenderTarget.texture;
      capMat.envMap = cubeRenderTarget.texture;
      trackMat.envMap = cubeRenderTarget.texture;

      return { renderer, scene, camera };
    }, [size]);

    // -----------------------------------------------------------------------
    // Animation loop
    // -----------------------------------------------------------------------

    const animate = useCallback(() => {
      const renderer = rendererRef.current;
      const scene = sceneRef.current;
      const camera = cameraRef.current;
      if (!renderer || !scene || !camera) return;

      const now = performance.now();

      // Wheel animation
      const ws = wheelAnimState.current;
      if (ws.running && wheelGroupRef.current) {
        const elapsed = now - ws.startTime;
        const progress = Math.min(elapsed / ws.duration, 1);
        // Cubic ease-out
        const eased = 1 - Math.pow(1 - progress, 3.5);
        const currentRotation =
          ws.startRotation + (ws.targetRotation - ws.startRotation) * eased;
        wheelGroupRef.current.rotation.y = currentRotation;
        if (progress >= 1) {
          ws.running = false;
          wheelGroupRef.current.rotation.y = ws.targetRotation;
        }
      }

      // Ball animation
      const bs = ballAnimState.current;
      if (bs.running && ballRef.current) {
        const elapsed = now - bs.startTime;
        const progress = Math.min(elapsed / bs.duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3.5);

        const currentAngle = bs.totalRotation * eased;

        // Spiral inward during last 65%
        let currentRadius = bs.outerRadius;
        const spiralStart = 0.35;
        if (progress > spiralStart) {
          const spiralProgress =
            (progress - spiralStart) / (1 - spiralStart);
          const spiralEased = spiralProgress * spiralProgress;
          currentRadius =
            bs.outerRadius -
            (bs.outerRadius - bs.innerRadius) * spiralEased;
        }

        // Small bounce in the last 8%
        if (progress > 0.92) {
          const bp = (progress - 0.92) / 0.08;
          const bounce = Math.sin(bp * Math.PI * 4) * 0.08 * (1 - bp);
          currentRadius += bounce;
        }

        // Ball height — rises slightly during fast orbit, settles into pocket
        let ballY = 0.22;
        if (progress < 0.35) {
          ballY = 0.22 + Math.sin(progress * Math.PI * 2) * 0.04;
        } else if (progress > 0.85) {
          const settleProgress = (progress - 0.85) / 0.15;
          ballY = 0.22 - settleProgress * 0.1;
        }

        ballRef.current.position.set(
          Math.sin(currentAngle) * currentRadius,
          ballY,
          -Math.cos(currentAngle) * currentRadius
        );

        if (progress >= 1) {
          bs.running = false;
          ballRef.current.position.set(
            Math.sin(bs.totalRotation) * bs.innerRadius,
            0.12,
            -Math.cos(bs.totalRotation) * bs.innerRadius
          );
        }
      }

      renderer.render(scene, camera);
      animFrameRef.current = requestAnimationFrame(animate);
    }, []);

    // -----------------------------------------------------------------------
    // Setup & teardown
    // -----------------------------------------------------------------------

    useEffect(() => {
      const built = buildScene();
      if (!built) return;

      animFrameRef.current = requestAnimationFrame(animate);

      return () => {
        cancelAnimationFrame(animFrameRef.current);
        built.renderer.dispose();
        if (containerRef.current && built.renderer.domElement.parentNode === containerRef.current) {
          containerRef.current.removeChild(built.renderer.domElement);
        }
      };
    }, [buildScene, animate]);

    // -----------------------------------------------------------------------
    // Imperative spin method
    // -----------------------------------------------------------------------

    useImperativeHandle(
      ref,
      () => ({
        spin: (winningNumber: number, duration: number): Promise<void> => {
          return new Promise((resolve) => {
            const winIndex = WHEEL_ORDER.indexOf(winningNumber);
            const winAngle = winIndex * SECTOR_ANGLE + SECTOR_ANGLE / 2;

            // Wheel: spin 3-5 extra full rotations + land on winning sector
            // Marker is at angle 0 (negative Z). Wheel rotation is around Y axis.
            // We need the winning sector to be at the marker position (angle 0 in world space)
            // Sector at index i starts at i * SECTOR_ANGLE from wheel's 0
            // We need to rotate the wheel so that the winning sector aligns with the marker
            const wheelExtraRotations =
              Math.PI * 2 * (3 + Math.floor(Math.random() * 3));
            const targetWheelRotation =
              cumulativeRotation.current - (wheelExtraRotations + winAngle);

            wheelAnimState.current = {
              running: true,
              startTime: performance.now(),
              duration: duration,
              startRotation: cumulativeRotation.current,
              targetRotation: targetWheelRotation,
            };

            // Ball: orbits in opposite direction, 5-8 times, ends at marker position (angle 0)
            const ballOrbits = 5 + Math.floor(Math.random() * 4);
            const totalBallRotation = Math.PI * 2 * ballOrbits;

            ballAnimState.current = {
              running: true,
              startTime: performance.now(),
              duration: duration,
              totalRotation: totalBallRotation,
              outerRadius: 2.85,
              innerRadius: 2.2,
            };

            // Wait for animation to complete
            setTimeout(() => {
              cumulativeRotation.current = targetWheelRotation;
              resolve();
            }, duration + 50);
          });
        },
      }),
      []
    );

    // -----------------------------------------------------------------------
    // Render
    // -----------------------------------------------------------------------

    return (
      <div
        ref={containerRef}
        style={{
          width: size,
          height: size,
          position: "relative",
          borderRadius: "50%",
          overflow: "hidden",
        }}
      />
    );
  }
);

export default RouletteWheel3D;
