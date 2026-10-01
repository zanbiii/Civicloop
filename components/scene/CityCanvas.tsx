'use client';

import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Edges, Grid } from '@react-three/drei';
import * as THREE from 'three';

export type SceneVariant = 'hero' | 'banner';

interface Palette {
  bg: string;
  gridLine: string;
  gridSection: string;
  block: string;
  edge: string;
  park: string;
  signal: string;
  ring: string;
  critical: string;
  resolved: string;
  labelBg: string;
  labelInk: string;
}

const LIGHT: Palette = {
  bg: '#ece8dc',
  gridLine: '#cdc6b1',
  gridSection: '#a59e88',
  block: '#f8f6ef',
  edge: '#16150f',
  park: '#b4cbaa',
  signal: '#ff5a1f',
  ring: '#16150f',
  critical: '#d9382b',
  resolved: '#2f9a63',
  labelBg: '#f8f6ef',
  labelInk: '#16150f',
};

/* Neon night city: dark glass blocks with cyan wireframe edges under a violet loop ring. */
const DARK: Palette = {
  bg: '#03040b',
  gridLine: '#13204a',
  gridSection: '#2a3f8f',
  block: '#0b1030',
  edge: '#39e6ff',
  park: '#0d3a3a',
  signal: '#39e6ff',
  ring: '#8b5cf6',
  critical: '#ff3d8a',
  resolved: '#34f5a4',
  labelBg: '#070a1c',
  labelInk: '#bff6ff',
};

const GRID_SIZE = 9;
const CELL = 1.65;
const AGENTS = ['Eye', 'Dedup', 'Route', 'SLA', 'Proof'] as const;

/** Small deterministic PRNG so the skyline is identical on every load. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Block {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  delay: number;
  park: boolean;
}

function buildCity(): Block[] {
  const rng = mulberry32(2718);
  const c = (GRID_SIZE - 1) / 2;
  const blocks: Block[] = [];
  for (let i = 0; i < GRID_SIZE; i += 1) {
    for (let j = 0; j < GRID_SIZE; j += 1) {
      const dist = Math.hypot(i - c, j - c);
      const park = dist > 1.6 && rng() < 0.11;
      const core = Math.max(0, 4.4 - dist);
      const h = park ? 0.08 : 0.35 + rng() * 0.9 + core * 0.5 * rng();
      blocks.push({
        x: (i - c) * CELL,
        z: (j - c) * CELL,
        w: park ? 1.25 : 0.95 + rng() * 0.35,
        d: park ? 1.25 : 0.95 + rng() * 0.35,
        h,
        delay: dist * 0.07 + rng() * 0.2,
        park,
      });
    }
  }
  return blocks;
}

const easeOutBack = (t: number) => {
  const s = 1.55;
  const u = t - 1;
  return 1 + (s + 1) * u * u * u + s * u * u;
};

function Building({ block, palette, reduce }: { block: Block; palette: Palette; reduce: boolean }) {
  const group = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const lift = useRef(0);

  useFrame((state, delta) => {
    const node = group.current;
    if (!node) return;
    const k = reduce ? 1 : Math.min(1, Math.max(0, (state.clock.elapsedTime - 0.15 - block.delay) / 0.95));
    const target = hovered && !block.park ? 0.22 : 0;
    lift.current += (target - lift.current) * Math.min(1, delta * 10);
    node.scale.y = Math.max(0.001, easeOutBack(k));
    node.position.y = lift.current;
  });

  return (
    <group ref={group} position={[block.x, 0, block.z]}>
      <mesh
        position={[0, block.h / 2, 0]}
        castShadow
        receiveShadow
        onPointerOver={(event) => {
          event.stopPropagation();
          setHovered(true);
          document.body.style.cursor = block.park ? 'auto' : 'pointer';
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = 'auto';
        }}
      >
        <boxGeometry args={[block.w, block.h, block.d]} />
        <meshStandardMaterial
          color={block.park ? palette.park : hovered ? palette.signal : palette.block}
          roughness={0.95}
          metalness={0}
        />
        {!block.park && <Edges threshold={15} color={hovered ? palette.signal : palette.edge} />}
      </mesh>
    </group>
  );
}

interface PinSpec {
  block: Block;
  color: string;
  /** The "loop" pin walks critical → in progress → resolved to show a ticket closing. */
  loop: boolean;
  phase: number;
}

function Pin({ spec, palette, reduce }: { spec: PinSpec; palette: Palette; reduce: boolean }) {
  const group = useRef<THREE.Group>(null);
  const bodyMat = useRef<THREE.MeshStandardMaterial>(null);
  const coneMat = useRef<THREE.MeshStandardMaterial>(null);
  const ring = useRef<THREE.Mesh>(null);
  const ringMat = useRef<THREE.MeshBasicMaterial>(null);
  const tmp = useMemo(() => new THREE.Color(), []);
  const fixed = useMemo(() => new THREE.Color(spec.color), [spec.color]);
  const from = useMemo(() => new THREE.Color(palette.critical), [palette.critical]);
  const mid = useMemo(() => new THREE.Color(palette.signal), [palette.signal]);
  const to = useMemo(() => new THREE.Color(palette.resolved), [palette.resolved]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const appear = reduce ? 1 : Math.min(1, Math.max(0, (t - 1.6 - spec.phase * 0.25) / 0.7));
    const node = group.current;
    if (node) {
      node.scale.setScalar(Math.max(0.001, easeOutBack(appear)));
      node.position.y = spec.block.h + 0.2 + (reduce ? 0 : Math.sin(t * 2 + spec.phase * 3) * 0.06);
    }
    if (spec.loop) {
      const cycle = (t / 7) % 1;
      if (cycle < 0.4) tmp.copy(from);
      else if (cycle < 0.7) tmp.copy(from).lerp(mid, (cycle - 0.4) / 0.3);
      else tmp.copy(mid).lerp(to, Math.min(1, (cycle - 0.7) / 0.15));
    } else {
      tmp.copy(fixed);
    }
    bodyMat.current?.color.copy(tmp);
    coneMat.current?.color.copy(tmp);
    ringMat.current?.color.copy(tmp);
    const pulse = reduce ? 0.4 : (t * 0.7 + spec.phase) % 1;
    if (ring.current) ring.current.scale.setScalar(1 + pulse * 2.4);
    if (ringMat.current) ringMat.current.opacity = (1 - pulse) * 0.7;
  });

  return (
    <group position={[spec.block.x, 0, spec.block.z]}>
      <group ref={group}>
        <mesh position={[0, 0.27, 0]} rotation={[Math.PI, 0, 0]} castShadow>
          <coneGeometry args={[0.15, 0.5, 20]} />
          <meshStandardMaterial ref={coneMat} roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.56, 0]} castShadow>
          <sphereGeometry args={[0.2, 24, 24]} />
          <meshStandardMaterial ref={bodyMat} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.56, 0.17]}>
          <sphereGeometry args={[0.07, 12, 12]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      </group>
      <mesh ref={ring} position={[0, spec.block.h + 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.28, 0.34, 40]} />
        <meshBasicMaterial ref={ringMat} transparent depthWrite={false} />
      </mesh>
    </group>
  );
}

/** Flat text tag drawn to a canvas texture, so labels live inside the WebGL scene. */
function Label({ text, palette }: { text: string; palette: Palette }) {
  const { texture, aspect } = useMemo(() => {
    const scale = 2;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const font = `700 ${11 * scale}px ui-monospace, Menlo, Consolas, monospace`;
    if (!ctx) return { texture: null, aspect: 1 };
    ctx.font = font;
    const width = Math.ceil(ctx.measureText(text).width + 18 * scale);
    const height = 24 * scale;
    canvas.width = width;
    canvas.height = height;
    ctx.font = font;
    ctx.fillStyle = palette.labelBg;
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = palette.edge;
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, width - 3, height - 3);
    ctx.fillStyle = palette.labelInk;
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 9 * scale, height / 2 + 1);
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    return { texture: map, aspect: width / height };
  }, [text, palette]);

  if (!texture) return null;
  return (
    <sprite position={[0, 0.8, 0]} scale={[0.62 * aspect, 0.62, 1]}>
      <spriteMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
    </sprite>
  );
}

function LoopRing({ palette, reduce, labels }: { palette: Palette; reduce: boolean; labels: boolean }) {
  const spin = useRef<THREE.Group>(null);
  const packet = useRef<THREE.Mesh>(null);
  const RADIUS = 7.4;

  useFrame((state, delta) => {
    if (!reduce && spin.current) spin.current.rotation.y += delta * 0.11;
    if (packet.current) {
      const a = reduce ? 0 : state.clock.elapsedTime * 0.85;
      packet.current.position.set(Math.cos(a) * RADIUS, 0, Math.sin(a) * RADIUS);
    }
  });

  return (
    <group position={[0, 4.4, 0]}>
      <group ref={spin}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[RADIUS, 0.028, 8, 160]} />
          <meshBasicMaterial color={palette.ring} />
        </mesh>
        <mesh ref={packet}>
          <sphereGeometry args={[0.16, 16, 16]} />
          <meshBasicMaterial color={palette.signal} />
        </mesh>
        {AGENTS.map((name, index) => {
          const angle = (index / AGENTS.length) * Math.PI * 2;
          return (
            <group key={name} position={[Math.cos(angle) * RADIUS, 0, Math.sin(angle) * RADIUS]}>
              <mesh castShadow>
                <boxGeometry args={[0.32, 0.32, 0.32]} />
                <meshStandardMaterial color={palette.signal} roughness={0.6} />
                <Edges color={palette.edge} />
              </mesh>
              {labels && <Label text={`${String(index + 1).padStart(2, '0')} ${name.toUpperCase()}`} palette={palette} />}
            </group>
          );
        })}
      </group>
    </group>
  );
}

function CameraRig({ variant, reduce, children }: { variant: SceneVariant; reduce: boolean; children: ReactNode }) {
  const city = useRef<THREE.Group>(null);
  const target = useMemo(() => new THREE.Vector3(), []);
  const size = useThree((state) => state.size);
  // The field of view is vertical, so a narrow canvas crops the loop ring; back the camera off to keep it in frame.
  const fit = Math.max(1, 1.05 / Math.max(0.1, size.width / Math.max(1, size.height)));
  const look = useMemo(() => new THREE.Vector3(0, 0.6, 0), []);

  useFrame((state, delta) => {
    const { camera, pointer } = state;
    const scrollP =
      variant === 'hero' && !reduce ? Math.min(1, Math.max(0, window.scrollY / (window.innerHeight * 0.9))) : 0;
    const settle = reduce ? 1 : Math.min(1, state.clock.elapsedTime / 2.4);
    const eased = 1 - Math.pow(1 - settle, 3);
    const base = variant === 'hero' ? { r: 38, h: 23 } : { r: 27, h: 15 };
    const radius = (base.r - eased * 9 - scrollP * 9) * fit;
    const height = (base.h - eased * 5.5 - scrollP * 6) * fit + (reduce ? 0 : pointer.y * 1.4);
    const angle = Math.PI / 4 + (reduce ? 0 : pointer.x * 0.28) + scrollP * 0.8 + (1 - eased) * 0.7;
    target.set(Math.sin(angle) * radius, height, Math.cos(angle) * radius);
    camera.position.lerp(target, 1 - Math.exp(-5 * delta));
    look.set(0, 0.6 - scrollP * 0.6, 0);
    camera.lookAt(look);
    if (city.current && !reduce) city.current.rotation.y += delta * 0.018;
  });

  return <group ref={city}>{children}</group>;
}

function World({ variant, palette, reduce }: { variant: SceneVariant; palette: Palette; reduce: boolean }) {
  const blocks = useMemo(() => buildCity(), []);
  const pins = useMemo<PinSpec[]>(() => {
    const rng = mulberry32(99);
    const candidates = blocks.filter((block) => !block.park && block.h > 0.7);
    const picked: Block[] = [];
    while (picked.length < 7 && candidates.length > 0) {
      const index = Math.floor(rng() * candidates.length);
      picked.push(candidates.splice(index, 1)[0]);
    }
    const colors = [palette.critical, palette.critical, palette.signal, '#f2b01e', palette.signal, palette.resolved, '#f2b01e'];
    return picked.map((block, index) => ({
      block,
      color: colors[index] ?? palette.signal,
      loop: index === 0,
      phase: index * 0.37,
    }));
  }, [blocks, palette]);

  return (
    <>
      <fog attach="fog" args={[palette.bg, 30, 64]} />
      <ambientLight intensity={1.05} />
      <directionalLight
        position={[9, 14, 6]}
        intensity={2.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
        shadow-bias={-0.0004}
      />

      <CameraRig variant={variant} reduce={reduce}>
        {blocks.map((block) => (
          <Building key={`${block.x}:${block.z}`} block={block} palette={palette} reduce={reduce} />
        ))}
        {pins.map((spec) => (
          <Pin key={`${spec.block.x}:${spec.block.z}`} spec={spec} palette={palette} reduce={reduce} />
        ))}
      </CameraRig>

      <LoopRing palette={palette} reduce={reduce} labels={variant === 'hero'} />

      <Grid
        args={[60, 60]}
        position={[0, -0.002, 0]}
        cellSize={0.55}
        cellThickness={0.6}
        cellColor={palette.gridLine}
        sectionSize={CELL}
        sectionThickness={1.1}
        sectionColor={palette.gridSection}
        fadeDistance={58}
        fadeStrength={1.4}
        infiniteGrid
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <shadowMaterial opacity={0.16} />
      </mesh>
    </>
  );
}

export default function CityCanvas({
  variant,
  dark,
  active,
  reduce,
}: {
  variant: SceneVariant;
  dark: boolean;
  active: boolean;
  reduce: boolean;
}) {
  const palette = dark ? DARK : LIGHT;
  return (
    <Canvas
      shadows="percentage"
      dpr={[1, 1.75]}
      frameloop={reduce ? 'demand' : active ? 'always' : 'never'}
      camera={{ position: [24, 16, 24], fov: variant === 'hero' ? 30 : 26, near: 0.1, far: 140 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
    >
      <World variant={variant} palette={palette} reduce={reduce} />
    </Canvas>
  );
}
