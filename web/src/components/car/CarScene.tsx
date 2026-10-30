import { ContactShadows, Environment, Lightformer, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

type P = { primary: string; secondary: string; number: number | null; active: boolean };

function numberTexture(n: number | null, fg: string, bg: string) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 128;
  const x = c.getContext("2d")!;
  x.fillStyle = bg;
  x.fillRect(0, 0, 256, 128);
  x.fillStyle = fg;
  x.font = "600 96px Switzer, sans-serif";
  x.textAlign = "center";
  x.textBaseline = "middle";
  x.fillText(n != null ? String(n) : "", 128, 70);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function Wheel({
  position,
  secondary,
  width = 0.38,
  r = 0.36,
}: {
  position: [number, number, number];
  secondary: string;
  width?: number;
  r?: number;
}) {
  return (
    <group position={position} rotation={[Math.PI / 2, 0, 0]}>
      <mesh castShadow>
        <cylinderGeometry args={[r, r, width, 32]} />
        <meshStandardMaterial color="#141414" roughness={0.85} />
      </mesh>
      {[1, -1].map((s) => (
        <mesh key={s} position={[0, (s * width) / 2 + s * 0.002, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[r * 0.72, 0.025, 8, 40]} />
          <meshStandardMaterial color={secondary} />
        </mesh>
      ))}
      <mesh>
        <cylinderGeometry args={[r * 0.45, r * 0.45, width + 0.01, 20]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.7} roughness={0.35} />
      </mesh>
    </group>
  );
}

function Car({ primary, secondary, number, active }: P) {
  const g = useRef<THREE.Group>(null);
  useFrame((_, d) => {
    if (g.current && active) g.current.rotation.y += Math.min(d, 0.05) * 0.35;
  });
  const paint = useMemo(
    () => new THREE.MeshPhysicalMaterial({ color: primary, roughness: 0.38, metalness: 0.15, clearcoat: 0.6, clearcoatRoughness: 0.35 }),
    [primary],
  );
  const accent = useMemo(() => new THREE.MeshPhysicalMaterial({ color: secondary, roughness: 0.4, clearcoat: 0.5 }), [secondary]);
  const carbon = useMemo(() => new THREE.MeshStandardMaterial({ color: "#161616", roughness: 0.6 }), []);
  const numTex = useMemo(() => numberTexture(number, secondary, primary), [number, primary, secondary]);

  // Tapered monocoque from an extruded side profile.
  const body = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-2.4, 0.18);
    s.lineTo(-0.9, 0.22);
    s.lineTo(-0.2, 0.42);
    s.lineTo(0.9, 0.5);
    s.lineTo(1.6, 0.38);
    s.lineTo(1.9, 0.12);
    s.lineTo(-2.4, 0.08);
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.36, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 3 });
    geo.translate(0, 0, -0.18);
    return geo;
  }, []);

  return (
    <group ref={g} position={[0, 0.02, 0]}>
      <mesh geometry={body} material={paint} castShadow />
      {/* nose tip */}
      <mesh position={[-2.5, 0.14, 0]} rotation={[0, 0, Math.PI / 2]} material={paint}>
        <coneGeometry args={[0.12, 0.3, 16]} />
      </mesh>
      {/* accent stripe */}
      <mesh position={[-0.6, 0.33, 0]} material={accent}>
        <boxGeometry args={[2.6, 0.02, 0.1]} />
      </mesh>
      {/* nose number */}
      <mesh position={[-1.5, 0.29, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
        <planeGeometry args={[0.36, 0.18]} />
        <meshStandardMaterial map={numTex} />
      </mesh>
      {/* sidepods */}
      {[1, -1].map((s) => (
        <mesh key={s} position={[0.35, 0.26, s * 0.42]} material={paint} castShadow>
          <boxGeometry args={[1.4, 0.28, 0.36]} />
        </mesh>
      ))}
      {/* engine cover fin with number */}
      <mesh position={[1.2, 0.6, 0]} material={paint}>
        <boxGeometry args={[0.9, 0.22, 0.03]} />
      </mesh>
      {[1, -1].map((s) => (
        <mesh key={s} position={[1.2, 0.6, s * 0.017]} rotation={[0, s > 0 ? 0 : Math.PI, 0]}>
          <planeGeometry args={[0.34, 0.17]} />
          <meshStandardMaterial map={numTex} />
        </mesh>
      ))}
      {/* airbox */}
      <mesh position={[0.15, 0.62, 0]} material={carbon}>
        <boxGeometry args={[0.3, 0.16, 0.2]} />
      </mesh>
      {/* halo */}
      <mesh position={[-0.15, 0.62, 0]} rotation={[Math.PI / 2, 0, 0]} material={carbon}>
        <torusGeometry args={[0.28, 0.03, 8, 24, Math.PI]} />
      </mesh>
      <mesh position={[-0.44, 0.52, 0]} rotation={[0, 0, 0.5]} material={carbon}>
        <cylinderGeometry args={[0.03, 0.03, 0.26, 8]} />
      </mesh>
      {/* front wing + endplates */}
      <mesh position={[-2.45, 0.06, 0]} material={accent}>
        <boxGeometry args={[0.45, 0.03, 1.7]} />
      </mesh>
      <mesh position={[-2.38, 0.11, 0]} material={paint}>
        <boxGeometry args={[0.3, 0.025, 1.6]} />
      </mesh>
      {[1, -1].map((s) => (
        <mesh key={s} position={[-2.42, 0.12, s * 0.86]} material={carbon}>
          <boxGeometry args={[0.5, 0.16, 0.02]} />
        </mesh>
      ))}
      {/* rear wing, endplates, beam wing */}
      <mesh position={[2.0, 0.86, 0]} material={paint}>
        <boxGeometry args={[0.38, 0.04, 1.1]} />
      </mesh>
      <mesh position={[2.05, 0.94, 0]} material={accent}>
        <boxGeometry args={[0.22, 0.03, 1.1]} />
      </mesh>
      {[1, -1].map((s) => (
        <mesh key={s} position={[2.0, 0.6, s * 0.56]} material={paint}>
          <boxGeometry args={[0.5, 0.62, 0.025]} />
        </mesh>
      ))}
      <mesh position={[2.0, 0.36, 0]} material={carbon}>
        <boxGeometry args={[0.24, 0.03, 0.9]} />
      </mesh>
      {/* suspension arms */}
      {[
        [-1.75, 1],
        [-1.75, -1],
        [1.45, 1],
        [1.45, -1],
      ].map(([x, s], i) => (
        <mesh key={i} position={[x, 0.3, s * 0.42]} rotation={[Math.PI / 2, 0, 0]} material={carbon}>
          <cylinderGeometry args={[0.02, 0.02, 0.62, 6]} />
        </mesh>
      ))}
      <Wheel position={[-1.75, 0.34, 0.78]} secondary={secondary} width={0.32} r={0.34} />
      <Wheel position={[-1.75, 0.34, -0.78]} secondary={secondary} width={0.32} r={0.34} />
      <Wheel position={[1.45, 0.36, 0.8]} secondary={secondary} width={0.42} r={0.36} />
      <Wheel position={[1.45, 0.36, -0.8]} secondary={secondary} width={0.42} r={0.36} />
    </group>
  );
}

export default function CarScene(props: P) {
  return (
    <Canvas frameloop={props.active ? "always" : "never"} dpr={[1, 1.75]} camera={{ position: [4.2, 2, 4.6], fov: 32 }} gl={{ antialias: true }}>
      <ambientLight intensity={0.35} />
      <directionalLight position={[4, 6, 3]} intensity={1.6} />
      <directionalLight position={[-5, 3, -4]} intensity={1.1} color="#dfe8ff" />
      <Environment resolution={64}>
        <Lightformer intensity={2} position={[0, 5, 0]} scale={[10, 10, 1]} rotation-x={Math.PI / 2} />
        <Lightformer intensity={1} position={[-5, 1, -1]} rotation-y={Math.PI / 2} scale={[20, 1, 1]} />
        <Lightformer intensity={1} position={[5, 1, 1]} rotation-y={-Math.PI / 2} scale={[20, 1, 1]} />
      </Environment>
      <Car {...props} />
      <ContactShadows position={[0, 0, 0]} opacity={0.55} scale={8} blur={2.2} far={2} />
      <OrbitControls enableZoom={false} enablePan={false} minPolarAngle={Math.PI / 4} maxPolarAngle={Math.PI / 2.15} target={[0, 0.35, 0]} />
    </Canvas>
  );
}
