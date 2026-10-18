import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import * as THREE from 'three';
import { PLATFORM, render } from './neptuneConfig';

export const NEPTUNE_PLATFORM_RADIUS = PLATFORM.radius;
/** Presentation spawn transforms mirror the server's initial 2.6 m separation (slot 1 at +z in three space). */
export const NEPTUNE_SPAWNS = [
  { position: [0, 0, 1.3], rotation: [0, 0, 0] },
  { position: [0, 0, -1.3], rotation: [0, Math.PI, 0] },
] as const;

/**
 * Walkable floor height, shaped like the Mars terrain sampler. The platform
 * top is flat at y = 0; outside it there is only atmosphere.
 */
export function platformHeightAt(x: number, z: number): number | null {
  return Math.hypot(x, z) <= PLATFORM.radius ? 0 : null;
}

/**
 * Shared by every Neptune shader: 1 = the whole sky is the arrival cloud
 * color, 0 = clear. Only the arrival sequence moves it; it resets on unmount.
 */
export const arrivalVeil = { value: 0 };

/** Whole-sky brightness (sky, cloud decks and puffs) and the current lightning flash. */
export const SKY_DIM = 0.78;
const skyDim = { value: SKY_DIM };
const lightning = { flash: { value: 0 }, pos: { value: new THREE.Vector3(600, -30, -700) } };

const color = (hex: string) => new THREE.Color(hex);
const SUN_DIR = new THREE.Vector3(...render.sunDirection).normalize();

const NOISE = /* glsl */ `
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float n=0.,a=.5;for(int i=0;i<5;i++){n+=noise(p)*a;p=p*2.03+11.7;a*=.5;}return n;}
`;

/** Vertical gradient sampled from the cinematic's final cloud frame. */
const VEIL = /* glsl */ `
uniform float uVeil;uniform vec3 uVeilLow;uniform vec3 uVeilMid;uniform vec3 uVeilTop;
uniform float uDim;uniform float uFlash;uniform vec3 uFlashPos;const vec3 FLASH=vec3(.78,.88,1.);
vec3 veilColor(float h){return h<0.?mix(uVeilMid,uVeilLow,clamp(-h*3.,0.,1.)):mix(uVeilMid,uVeilTop,clamp(h*2.,0.,1.));}
`;

function veilUniforms() {
  return {
    uVeil: arrivalVeil,
    uDim: skyDim,
    uFlash: lightning.flash,
    uFlashPos: lightning.pos,
    uVeilLow: { value: color(render.arrivalFog.low) },
    uVeilMid: { value: color(render.arrivalFog.mid) },
    uVeilTop: { value: color(render.arrivalFog.top) },
  };
}

const skyVertex = /* glsl */ `varying vec3 vWorld;
void main(){vWorld=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const skyFragment = /* glsl */ `varying vec3 vWorld;
uniform vec3 uZenith;uniform vec3 uHorizon;uniform vec3 uSun;uniform vec3 uSunDir;uniform float uUseVeil;
${VEIL}
void main(){
 vec3 d=normalize(vWorld-cameraPosition);float h=d.y;
 vec3 c=mix(uHorizon,uZenith,pow(clamp(h,0.,1.),.55));
 c=mix(c,uHorizon*.55,clamp(-h*4.,0.,1.));
 float s=max(dot(d,uSunDir),0.);
 // ~1/900 of Earth's sunlight: a small, cool disk with a faint scattering halo.
 c+=uSun*(pow(s,2400.)*2.2+pow(s,90.)*.18+pow(s,8.)*.05);
 c*=uDim;
 vec3 fd=normalize(uFlashPos-cameraPosition);float fa=max(dot(d,fd),0.);
 c+=FLASH*uFlash*(pow(fa,14.)*3.2+pow(fa,3.)*.45);
 c=mix(c,veilColor(h),uVeil*uUseVeil);
 gl_FragColor=vec4(c,1.);
}`;

export function NeptuneSky({ veiled = true }: { veiled?: boolean }) {
  const uniforms = useMemo(
    () => ({
      uZenith: { value: color(render.sky.zenith) },
      uHorizon: { value: color(render.sky.horizon) },
      uSun: { value: color(render.sky.sun) },
      uSunDir: { value: SUN_DIR.clone() },
      uUseVeil: { value: veiled ? 1 : 0 },
      ...veilUniforms(),
    }),
    [veiled],
  );
  return (
    <mesh renderOrder={-10}>
      <sphereGeometry args={[2200, 32, 20]} />
      <shaderMaterial vertexShader={skyVertex} fragmentShader={skyFragment} uniforms={uniforms} side={THREE.BackSide} depthWrite={false} fog={false} />
    </mesh>
  );
}

const deckVertex = /* glsl */ `varying vec3 vWorld;
void main(){vec4 p=modelMatrix*vec4(position,1.);vWorld=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}`;
// Layer 0: opaque deep deck in zonal bands. Layer 1: broken mid clouds plus a
// dark storm vortex with bright companion clouds. Layer 2: thin methane cirrus streaks.
const deckFragment = /* glsl */ `varying vec3 vWorld;
uniform float uTime;uniform float uLayer;uniform float uDrift;
uniform vec3 uDeep;uniform vec3 uMid;uniform vec3 uCirrus;uniform vec3 uHorizon;uniform vec2 uStorm;
${NOISE}${VEIL}
void main(){
 vec2 p=vWorld.xz;
 float dist=length(p-cameraPosition.xz);
 vec2 q=p*.006+vec2(uTime*uDrift*.01,uLayer*17.);
 float band=sin(p.y*.0045+fbm(q*.35)*3.);
 vec3 c;float a;
 if(uLayer<.5){
  float n=fbm(q+fbm(q*.5)*1.6);
  c=mix(uDeep,uMid,smoothstep(.25,.8,n)*.8+band*.12);
  a=1.;
 } else if(uLayer<1.5){
  vec2 s=(p-uStorm)/vec2(260.,150.);
  float r=length(s);
  float ang=(1.-smoothstep(0.,1.4,r))*2.6;
  vec2 sw=mat2(cos(ang),-sin(ang),sin(ang),cos(ang))*(p-uStorm);
  vec2 qq=mix(q,(uStorm+sw)*.006+vec2(uTime*uDrift*.01,17.),1.-smoothstep(.9,1.6,r));
  float n=fbm(qq+fbm(qq*.6)*1.2);
  float body=smoothstep(.42,.72,n+band*.06);
  float lit=clamp((fbm(qq+vec2(-.05,.06))-n)*7.+.55,0.,1.);
  c=mix(uMid*.8,mix(uMid,uCirrus,.55),lit);
  a=body*.9;
  // Dark vortex: the deeper deck shows through, like the 1989 Great Dark Spot.
  float core=1.-smoothstep(.55,1.05,r);
  c=mix(c,uDeep*.55,core);a=max(a,core*.95);
  // Bright methane companion clouds on its southern edge.
  float comp=smoothstep(.25,0.,abs(r-1.08))*smoothstep(-.2,.6,s.y)*smoothstep(.45,.75,fbm(qq*3.));
  c=mix(c,uCirrus,comp);a=max(a,comp);
 } else {
  vec2 st=vec2(p.x*.0025+uTime*uDrift*.012,p.y*.03);
  float n=fbm(st+fbm(st*vec2(.6,2.))*.8);
  a=smoothstep(.6,.82,n)*.55;
  c=uCirrus;
 }
 float far=smoothstep(250.,2000.,dist);
 c=mix(c,uHorizon,far);
 if(uLayer>.5)a*=1.-far*.7;
 c*=uDim;
 c+=FLASH*uFlash*exp(-distance(p,uFlashPos.xz)/480.)*(uLayer>.5?2.6:1.2);
 c=mix(c,veilColor(-.1),uVeil);
 gl_FragColor=vec4(c,a);
}`;

const puffVertex = /* glsl */ `varying vec2 vUv;varying float vDist;varying float vSeed;varying vec3 vWP;
void main(){vUv=uv;vec4 center=modelViewMatrix*instanceMatrix*vec4(0.,0.,0.,1.);
 vec2 size=vec2(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz));
 vSeed=fract(instanceMatrix[3].x*.013+instanceMatrix[3].z*.007);vWP=(modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.)).xyz;
 center.xy+=position.xy*size;vDist=-center.z;gl_Position=projectionMatrix*center;}`;
const puffFragment = /* glsl */ `varying vec2 vUv;varying float vDist;varying float vSeed;varying vec3 vWP;
uniform vec3 uShade;uniform vec3 uLit;uniform vec3 uHorizon;uniform float uOpacity;uniform float uNear;
${NOISE}${VEIL}
void main(){
 vec2 p=(vUv-.5)*2.;
 float n=fbm(vUv*4.+vSeed*20.);
 float shape=smoothstep(1.,.25,length(p*vec2(1.,1.25))+(n-.5)*.7);
 vec3 c=mix(uShade,uLit,smoothstep(-.2,1.,vUv.y+n*.4-.2));
 c=mix(c,uHorizon,smoothstep(300.,1800.,vDist)*.85);
 c*=uDim;
 c+=FLASH*uFlash*exp(-distance(vWP.xz,uFlashPos.xz)/420.)*2.8;
 c=mix(c,veilColor(0.),uVeil);
 // Fade puffs the camera is about to pass through.
 float a=shape*uOpacity*smoothstep(uNear,uNear*3.,vDist);
 gl_FragColor=vec4(c,a);
}`;

export interface PuffSpec { position: [number, number, number]; size: [number, number] }

/** Billboard cloud formations. One draw call for all of them. */
export function CloudPuffs({ puffs, opacity = 0.75, near = 4, lit = render.deck.cirrus, shade = render.deck.mid }: {
  puffs: PuffSpec[]; opacity?: number; near?: number; lit?: string; shade?: string;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const uniforms = useMemo(
    () => ({
      uShade: { value: color(shade) },
      uLit: { value: color(lit) },
      uHorizon: { value: color(render.sky.horizon) },
      uOpacity: { value: opacity },
      uNear: { value: near },
      ...veilUniforms(),
    }),
    [lit, shade, opacity, near],
  );
  useEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const dummy = new THREE.Object3D();
    puffs.forEach((puff, i) => {
      dummy.position.set(...puff.position);
      dummy.scale.set(puff.size[0], puff.size[1], 1);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  }, [puffs]);
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, puffs.length]} frustumCulled={false} renderOrder={-1}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial vertexShader={puffVertex} fragmentShader={puffFragment} uniforms={uniforms} transparent depthWrite={false} fog={false} />
    </instancedMesh>
  );
}

/** Distant towering formations around the horizon, deterministic so every client sees the same sky. */
const HORIZON_PUFFS: PuffSpec[] = Array.from({ length: 150 }, (_, i) => {
  const angle = i * 2.39996;
  const radius = 260 + (i % 17) * 70;
  const tall = i % 5 === 0;
  return {
    position: [Math.cos(angle) * radius, -24 + (i % 7) * 3 + (tall ? 30 : 0), Math.sin(angle) * radius],
    size: [90 + (i % 6) * 30, tall ? 110 + (i % 4) * 25 : 40 + (i % 5) * 12],
  };
});

function Cloudscape({ reducedMotion }: { reducedMotion: boolean }) {
  const mats = useRef<(THREE.ShaderMaterial | null)[]>([]);
  const layers = useMemo(
    () =>
      [0, 1, 2].map((layer) => ({
        layer,
        y: [-70, -38, -12][layer],
        uniforms: {
          uTime: { value: 0 },
          uLayer: { value: layer },
          uDrift: { value: render.windDrift[2 - layer] },
          uDeep: { value: color(render.deck.deep) },
          uMid: { value: color(render.deck.mid) },
          uCirrus: { value: color(render.deck.cirrus) },
          uHorizon: { value: color(render.sky.horizon) },
          uStorm: { value: new THREE.Vector2(-420, -900) },
          ...veilUniforms(),
        },
      })),
    [],
  );
  useFrame(({ clock }) => {
    for (const mat of mats.current) if (mat) mat.uniforms.uTime.value = reducedMotion ? 0 : clock.elapsedTime;
  });
  return (
    <>
      {layers.map(({ layer, y, uniforms }) => (
        <mesh key={layer} rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]} renderOrder={-5 + layer}>
          <planeGeometry args={[6000, 6000]} />
          <shaderMaterial
            ref={(m) => { mats.current[layer] = m; }}
            vertexShader={deckVertex}
            fragmentShader={deckFragment}
            uniforms={uniforms}
            transparent={layer > 0}
            depthWrite={false}
            fog={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
      <CloudPuffs puffs={HORIZON_PUFFS} opacity={0.8} near={40} />
    </>
  );
}

/** Polar panel layout drawn once into canvases: albedo, roughness and cyan light lines. */
function makeFloorTextures() {
  const size = 2048;
  const c = size / 2;
  const m = c / PLATFORM.radius;
  const make = () => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    return [canvas, canvas.getContext('2d')!] as const;
  };
  const [albedo, a] = make();
  const [rough, r] = make();
  const [glow, g] = make();
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  a.fillStyle = '#2a3542'; a.fillRect(0, 0, size, size);
  r.fillStyle = '#8c8c8c'; r.fillRect(0, 0, size, size);
  g.fillStyle = '#000'; g.fillRect(0, 0, size, size);

  const rings = [0, 0.9, 1.6, 2.7, 3.9, 5.0, 5.4, 6.7, 8.0, 9.3, 10.4, PLATFORM.radius];
  for (let i = 0; i < rings.length - 1; i++) {
    const inner = rings[i] * m, outer = rings[i + 1] * m;
    const mid = (rings[i] + rings[i + 1]) / 2;
    const count = i === 0 ? 1 : Math.max(6, Math.round((Math.PI * 2 * mid) / 1.7));
    const hazard = i === 5;
    for (let k = 0; k < count; k++) {
      const s = (k / count) * Math.PI * 2, e = ((k + 1) / count) * Math.PI * 2;
      const tone = 40 + (i % 2) * 10 + rand() * 12;
      a.fillStyle = hazard ? (k % 2 ? '#141c25' : '#3a4958') : `rgb(${tone * 0.82},${tone * 0.98},${tone * 1.2})`;
      a.beginPath(); a.arc(c, c, outer, s, e); a.arc(c, c, inner, e, s, true); a.closePath(); a.fill();
      const rv = Math.round(165 + rand() * 55);
      r.fillStyle = `rgb(${rv},${rv},${rv})`;
      r.beginPath(); r.arc(c, c, outer, s, e); r.arc(c, c, inner, e, s, true); r.closePath(); r.fill();
      if (i > 0) {
        // Radial seam with bolts either side.
        for (const ctx of [a, r]) {
          ctx.strokeStyle = ctx === a ? '#0a1017' : '#d0d0d0';
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(c + Math.cos(s) * inner, c + Math.sin(s) * inner); ctx.lineTo(c + Math.cos(s) * outer, c + Math.sin(s) * outer); ctx.stroke();
        }
        a.fillStyle = '#7d90a2';
        for (const t of [0.2, 0.8]) {
          const rr = inner + (outer - inner) * t;
          for (const off of [0.02, -0.02]) a.fillRect(c + Math.cos(s + off) * rr - 2, c + Math.sin(s + off) * rr - 2, 4, 4);
        }
      }
    }
    for (const ctx of [a, r]) {
      ctx.strokeStyle = ctx === a ? '#090e14' : '#d8d8d8';
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(c, c, outer, 0, Math.PI * 2); ctx.stroke();
    }
  }
  // Wear: faint scuffs, denser toward the center where fighters stand.
  for (let i = 0; i < 9000; i++) {
    const rr = Math.sqrt(rand()) * PLATFORM.radius * m, t = rand() * Math.PI * 2;
    a.fillStyle = `rgba(${rand() > 0.5 ? '160,180,200' : '5,10,16'},${0.03 + rand() * 0.05})`;
    a.fillRect(c + Math.cos(t) * rr, c + Math.sin(t) * rr, 1 + rand() * 4, 1 + rand() * 2);
  }
  // Restrained cyan lines: the combat boundary, its range ticks, the core and the outer edge.
  const line = (radius: number, width: number, alpha: number) => {
    g.strokeStyle = `rgba(110,240,255,${alpha})`; g.lineWidth = width * m;
    g.beginPath(); g.arc(c, c, radius * m, 0, Math.PI * 2); g.stroke();
  };
  line(PLATFORM.combatRadius, 0.07, 1);
  line(0.9, 0.035, 0.8);
  line(10.4, 0.05, 0.7);
  g.strokeStyle = 'rgba(110,240,255,0.9)'; g.lineWidth = 0.05 * m;
  for (let k = 0; k < 24; k++) {
    const t = (k / 24) * Math.PI * 2;
    g.beginPath(); g.moveTo(c + Math.cos(t) * 5.25 * m, c + Math.sin(t) * 5.25 * m); g.lineTo(c + Math.cos(t) * 5.5 * m, c + Math.sin(t) * 5.5 * m); g.stroke();
  }
  // Central emblem.
  g.fillStyle = 'rgba(110,240,255,0.55)';
  for (let k = 0; k < 3; k++) {
    const t = (k / 3) * Math.PI * 2 - Math.PI / 2;
    g.beginPath();
    g.moveTo(c + Math.cos(t) * 0.75 * m, c + Math.sin(t) * 0.75 * m);
    g.lineTo(c + Math.cos(t + 0.35) * 0.35 * m, c + Math.sin(t + 0.35) * 0.35 * m);
    g.lineTo(c + Math.cos(t - 0.35) * 0.35 * m, c + Math.sin(t - 0.35) * 0.35 * m);
    g.fill();
  }

  const tex = (canvas: HTMLCanvasElement, srgb: boolean) => {
    const t = new THREE.CanvasTexture(canvas);
    t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  return { map: tex(albedo, true), roughnessMap: tex(rough, false), emissiveMap: tex(glow, true) };
}

/** Disc profile from the floor edge down to the underside core, revolved once. */
const HULL_PROFILE: [number, number][] = [
  [0, -6.4], [1.1, -6.2], [2.0, -5.3], [2.6, -3.6], [4.6, -3.1], [5.3, -2.1],
  [7.6, -1.8], [8.4, -1.25], [10.5, -0.95], [11.25, -0.55], [11.25, -0.12], [11.0, 0],
];

function Platform() {
  const floor = useMemo(makeFloorTextures, []);
  const hull = useMemo(() => new THREE.LatheGeometry(HULL_PROFILE.map(([x, y]) => new THREE.Vector2(x, y)), 96), []);
  const steel = useMemo(() => new THREE.MeshStandardMaterial({ color: '#2b3b4c', metalness: 0.8, roughness: 0.38 }), []);
  const darkSteel = useMemo(() => new THREE.MeshStandardMaterial({ color: '#1c2a38', metalness: 0.75, roughness: 0.42 }), []);
  const trim = useMemo(() => new THREE.MeshStandardMaterial({ color: '#5d7082', metalness: 0.85, roughness: 0.36, envMapIntensity: 0.6 }), []);
  const cyan = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(0.35, 1.6, 2.0), toneMapped: false }), []);
  const rimPlates = useRef<THREE.InstancedMesh>(null);
  const pylons = useRef<THREE.InstancedMesh>(null);
  const pylonLights = useRef<THREE.InstancedMesh>(null);
  const ribs = useRef<THREE.InstancedMesh>(null);
  const thrusters = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    const d = new THREE.Object3D();
    const place = (mesh: THREE.InstancedMesh | null, i: number, a: number, radius: number, y: number, scale: [number, number, number], tilt = 0) => {
      if (!mesh) return;
      d.position.set(Math.sin(a) * radius, y, Math.cos(a) * radius);
      // Local +z points outward from the center; tilt pitches the outer end up.
      d.rotation.set(tilt, a, 0, 'YXZ');
      d.scale.set(...scale);
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
    };
    for (let i = 0; i < 40; i++) place(rimPlates.current, i, (i / 40) * Math.PI * 2, 10.85, 0.09, [1.5, 0.18, 0.5]);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      place(pylons.current, i, a, 10.9, 0.35, [0.5, 0.7, 0.5]);
      place(pylonLights.current, i, a, 10.62, 0.42, [0.32, 0.05, 0.03]);
    }
    for (let i = 0; i < 12; i++) place(ribs.current, i, (i / 12) * Math.PI * 2, 6.75, -2.35, [0.35, 0.5, 7.9], -0.31);
    for (let i = 0; i < 4; i++) place(thrusters.current, i, (i / 4) * Math.PI * 2 + Math.PI / 4, 6.2, -2.6, [1, 1, 1]);
    for (const mesh of [rimPlates.current, pylons.current, pylonLights.current, ribs.current, thrusters.current]) if (mesh) mesh.instanceMatrix.needsUpdate = true;
  }, []);

  useEffect(() => () => {
    Object.values(floor).forEach((t) => t.dispose());
    hull.dispose();
    [steel, darkSteel, trim, cyan].forEach((m) => m.dispose());
  }, [floor, hull, steel, darkSteel, trim, cyan]);

  return (
    <group>
      <mesh name="neptune-floor" rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[PLATFORM.radius, 128]} />
        <meshStandardMaterial
          map={floor.map}
          roughnessMap={floor.roughnessMap}
          emissiveMap={floor.emissiveMap}
          emissive="#5fe6ff"
          emissiveIntensity={1.1}
          metalness={0.6}
          roughness={1}
          envMapIntensity={0.25}
        />
      </mesh>
      <mesh geometry={hull} material={steel} castShadow receiveShadow />
      {/* Glow line and trim around the hull's outer face. */}
      <mesh position={[0, -0.34, 0]} rotation={[-Math.PI / 2, 0, 0]} material={cyan}>
        <torusGeometry args={[11.27, 0.025, 6, 160]} />
      </mesh>
      <mesh position={[0, -1.0, 0]} rotation={[-Math.PI / 2, 0, 0]} material={trim}>
        <torusGeometry args={[10.45, 0.06, 6, 128]} />
      </mesh>
      {/* Raised combat boundary: a low trim ring beside the painted line. */}
      <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]} material={trim} receiveShadow>
        <ringGeometry args={[PLATFORM.combatRadius + 0.06, PLATFORM.combatRadius + 0.14, 128]} />
      </mesh>
      <instancedMesh ref={rimPlates} args={[undefined, undefined, 40]} material={trim} castShadow receiveShadow>
        <boxGeometry />
      </instancedMesh>
      <instancedMesh ref={pylons} args={[undefined, undefined, 8]} material={darkSteel} castShadow>
        <boxGeometry />
      </instancedMesh>
      <instancedMesh ref={pylonLights} args={[undefined, undefined, 8]} material={cyan}>
        <boxGeometry />
      </instancedMesh>
      <instancedMesh ref={ribs} args={[undefined, undefined, 12]} material={darkSteel}>
        <boxGeometry />
      </instancedMesh>
      <instancedMesh ref={thrusters} args={[undefined, undefined, 4]} material={darkSteel}>
        <cylinderGeometry args={[0.7, 0.45, 1.2, 16]} />
      </instancedMesh>
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        return (
          <mesh key={i} position={[Math.sin(a) * 6.2, -3.25, Math.cos(a) * 6.2]} rotation={[Math.PI / 2, 0, 0]} material={cyan}>
            <circleGeometry args={[0.38, 20]} />
          </mesh>
        );
      })}
      <mesh position={[0, -6.45, 0]} rotation={[Math.PI / 2, 0, 0]} material={cyan}>
        <circleGeometry args={[0.6, 24]} />
      </mesh>
    </group>
  );
}

/**
 * Distant lightning inside the storm clouds: every 1.5–4 s a quick double
 * flicker somewhere on the horizon lights the clouds around it, with a faint
 * matching flash of light on the platform.
 */
function Lightning({ reducedMotion }: { reducedMotion: boolean }) {
  const light = useRef<THREE.DirectionalLight>(null);
  const next = useRef(1.2);
  const start = useRef(-10);
  useEffect(() => () => { lightning.flash.value = 0; }, []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (t >= next.current) {
      start.current = t;
      next.current = t + 1.5 + Math.random() * 2.5;
      // Ahead of or behind the duel (along z), where both players' cameras look.
      const side = Math.random() < 0.5 ? -1 : 1;
      lightning.pos.value.set((Math.random() - 0.5) * 1100, 20 + Math.random() * 70, side * (450 + Math.random() * 450));
      light.current?.position.copy(lightning.pos.value).normalize().multiplyScalar(40);
    }
    const age = t - start.current;
    // Two quick strokes, then a fading afterglow.
    const flash = age < 0 ? 0 : age < 0.08 ? 1 : age < 0.14 ? 0.25 : age < 0.22 ? 0.85 : Math.max(0, 0.5 * Math.exp(-(age - 0.22) * 9));
    lightning.flash.value = reducedMotion ? flash * 0.35 : flash;
    if (light.current) light.current.intensity = lightning.flash.value * 2.5;
  });
  return <directionalLight ref={light} color="#cfe6ff" intensity={0} />;
}

export function NeptuneEnvironment({ reducedMotion = false }: { reducedMotion?: boolean }) {
  useEffect(() => () => { arrivalVeil.value = 0; }, []);
  const sun = SUN_DIR.clone().multiplyScalar(40);
  return (
    <>
      <color attach="background" args={[render.sky.horizon]} />
      <fog attach="fog" args={[render.fog.color, render.fog.near, render.fog.far]} />
      <NeptuneSky />
      <hemisphereLight args={[render.ambient.sky, render.ambient.ground, render.ambient.intensity]} />
      <directionalLight
        position={[sun.x, sun.y, sun.z]}
        intensity={render.sun.intensity}
        color={render.sun.color}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-13}
        shadow-camera-right={13}
        shadow-camera-top={13}
        shadow-camera-bottom={-13}
        shadow-camera-far={120}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      />
      <Environment frames={1} resolution={128} environmentIntensity={0.8}>
        <NeptuneSky veiled={false} />
      </Environment>
      <Cloudscape reducedMotion={reducedMotion} />
      <Lightning reducedMotion={reducedMotion} />
      <Platform />
    </>
  );
}
