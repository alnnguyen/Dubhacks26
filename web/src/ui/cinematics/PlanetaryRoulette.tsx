import { useCallback, useEffect, useMemo, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import type { CinematicPhase, PlanetId } from './sequence';

interface PlanetDefinition {
  id: PlanetId;
  radius: number;
  orbit: number;
  speed: number;
  rotationSpeed: number;
  axialTilt: number;
  color: string;
  glow: string;
  seed: number;
}

const PLANETS: PlanetDefinition[] = [
  { id: 'mercury', radius: 0.026, orbit: 0.12, speed: 0.34, rotationSpeed: 0.18, axialTilt: 0.03, color: '#aaa49a', glow: '#9da9b2', seed: 2 },
  { id: 'venus', radius: 0.039, orbit: 0.19, speed: 0.28, rotationSpeed: -0.08, axialTilt: 0.04, color: '#d9a66e', glow: '#ffc47c', seed: 5 },
  { id: 'earth', radius: 0.046, orbit: 0.26, speed: 0.23, rotationSpeed: 0.3, axialTilt: 0.41, color: '#5ca7df', glow: '#61caff', seed: 9 },
  { id: 'mars', radius: 0.039, orbit: 0.33, speed: 0.19, rotationSpeed: 0.27, axialTilt: 0.44, color: '#ce6343', glow: '#ff7546', seed: 13 },
  { id: 'jupiter', radius: 0.078, orbit: 0.40, speed: 0.145, rotationSpeed: 0.72, axialTilt: 0.05, color: '#d9aa7b', glow: '#ffc18a', seed: 17 },
  { id: 'saturn', radius: 0.068, orbit: 0.47, speed: 0.12, rotationSpeed: 0.64, axialTilt: 0.46, color: '#d4bd8e', glow: '#f8daa0', seed: 23 },
  { id: 'uranus', radius: 0.052, orbit: 0.54, speed: 0.095, rotationSpeed: -0.35, axialTilt: 1.7, color: '#82cbd1', glow: '#8cf0f1', seed: 29 },
  { id: 'neptune', radius: 0.052, orbit: 0.61, speed: 0.075, rotationSpeed: 0.52, axialTilt: 0.49, color: '#4778c8', glow: '#659cff', seed: 31 },
];

const PLANET_TEXTURE_URLS: Partial<Record<PlanetId, string>> = {
  mercury: '/textures/planets/2k_mercury.jpg',
  venus: '/textures/planets/2k_venus_atmosphere.jpg',
  earth: '/textures/earth/earth_day_2k.jpg',
  mars: '/textures/planets/2k_mars.jpg',
  jupiter: '/textures/planets/2k_jupiter.jpg',
  saturn: '/textures/planets/2k_saturn.jpg',
  // Contrast-boosted with wind streaks so the bands read at roulette size (see ATTRIBUTION.md).
  neptune: '/textures/planets/2k_neptune_roulette.jpg',
};
const SUN_TEXTURE_URL = '/textures/planets/2k_sun.jpg';

const decodedTextures = new Map<string, THREE.Texture>();
const EARTH_LAYERS = ['/textures/earth/earth_night_2k.jpg', '/textures/earth/earth_clouds_2k.jpg'];
const planetTextures = new Map<string, Promise<THREE.Texture>>();
function loadPlanetTexture(url: string) {
  let pending = planetTextures.get(url);
  if (!pending) {
    pending = new THREE.TextureLoader().loadAsync(url).then((texture) => {
      decodedTextures.set(url, texture);
      return texture;
    });
    planetTextures.set(url, pending);
  }
  return pending;
}

/** Decode the maps before starting the timed roulette; failed maps use plain materials. */
export function preloadPlanetaryTextures() {
  return Promise.allSettled([...Object.values(PLANET_TEXTURE_URLS), SUN_TEXTURE_URL, ...EARTH_LAYERS].map(loadPlanetTexture));
}

const PHASES_THAT_FREEZE_ORBITS = new Set<CinematicPhase>(['locked', 'zooming', 'flash', 'video']);
const PLANET_WHITE = new THREE.Color('#ffffff');
const PLANET_DIM = new THREE.Color('#46515a');
const MARKER_CYAN = new THREE.Color('#5edcff');
const MARKER_SELECTED = new THREE.Color('#ecfbff');
const MARKER_LOCKED = new THREE.Color('#ff9b55');

function createPlanetTexture(planet: PlanetDefinition) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not create the planetary texture canvas.');

  const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, new THREE.Color(planet.color).multiplyScalar(1.24).getStyle());
  gradient.addColorStop(0.52, planet.color);
  gradient.addColorStop(1, new THREE.Color(planet.color).multiplyScalar(0.54).getStyle());
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  if (planet.id === 'earth') {
    context.fillStyle = '#4d9963';
    const continents = [
      [[0.08, 0.31], [0.19, 0.23], [0.27, 0.28], [0.25, 0.42], [0.19, 0.51], [0.14, 0.72], [0.10, 0.58]],
      [[0.31, 0.18], [0.46, 0.2], [0.5, 0.31], [0.45, 0.39], [0.4, 0.51], [0.33, 0.43]],
      [[0.55, 0.28], [0.66, 0.23], [0.78, 0.29], [0.85, 0.36], [0.81, 0.47], [0.72, 0.49], [0.68, 0.63], [0.58, 0.54]],
      [[0.75, 0.62], [0.82, 0.6], [0.86, 0.7], [0.8, 0.78], [0.75, 0.71]],
    ];
    continents.forEach((shape) => {
      context.beginPath();
      shape.forEach(([x, y], index) => {
        const px = x * canvas.width;
        const py = y * canvas.height;
        if (index === 0) context.moveTo(px, py);
        else context.lineTo(px, py);
      });
      context.closePath();
      context.fill();
    });
    context.strokeStyle = 'rgba(232, 248, 255, 0.45)';
    context.lineWidth = 4;
    for (let i = 0; i < 9; i++) {
      const y = 0.12 + i * 0.085;
      context.beginPath();
      context.moveTo(0, y * canvas.height);
      context.bezierCurveTo(140, (y - 0.04) * canvas.height, 300, (y + 0.04) * canvas.height, 512, y * canvas.height);
      context.stroke();
    }
  } else if (planet.id === 'jupiter' || planet.id === 'saturn') {
    const bands = planet.id === 'jupiter'
      ? ['#b98563', '#e3c59c', '#a86f52', '#e9d1aa', '#c38e6b', '#f0d8b1']
      : ['#b59d78', '#e0cca3', '#bba47f', '#e8d8b7', '#c4ad87'];
    bands.forEach((color, index) => {
      const y = (index / bands.length) * canvas.height;
      const height = canvas.height / bands.length;
      context.fillStyle = color;
      context.fillRect(0, y + Math.sin(index * 3.1) * 8, canvas.width, height + 2);
      context.fillStyle = 'rgba(71, 48, 38, 0.16)';
      context.fillRect(0, y + height * 0.83, canvas.width, 3);
    });
    if (planet.id === 'jupiter') {
      context.fillStyle = 'rgba(157, 77, 49, 0.8)';
      context.beginPath();
      context.ellipse(canvas.width * 0.69, canvas.height * 0.63, 28, 13, -0.12, 0, Math.PI * 2);
      context.fill();
    }
  } else {
    context.strokeStyle = 'rgba(28, 20, 16, 0.28)';
    context.fillStyle = 'rgba(248, 224, 194, 0.2)';
    for (let i = 0; i < 24; i++) {
      const x = ((Math.sin((i + 1) * planet.seed * 1.7) + 1) / 2) * canvas.width;
      const y = ((Math.sin((i + 1) * (planet.seed + 3) * 2.1) + 1) / 2) * canvas.height;
      const radius = 2 + ((i * planet.seed) % 7);
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
      context.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.anisotropy = 2;
  return texture;
}

function prepareColorTexture(texture: THREE.Texture) {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 2;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

function preparedTexture(url: string) {
  const source = decodedTextures.get(url);
  return source ? prepareColorTexture(source.clone()) : null;
}

function Sun() {
  const texture = useMemo(() => preparedTexture(SUN_TEXTURE_URL), []);
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#ffffff',
        map: texture,
        toneMapped: false,
      }),
    [],
  );

  useEffect(() => () => { texture?.dispose(); material.dispose(); }, [material, texture]);

  return (
    <mesh material={material}>
      <sphereGeometry args={[0.052, 48, 32]} />
    </mesh>
  );
}

function EarthLayers({ geometry, sunDirection }: { geometry: THREE.SphereGeometry; sunDirection: THREE.Vector3 }) {
  const nightMap = useMemo(() => preparedTexture(EARTH_LAYERS[0]), []);
  const cloudMap = useMemo(() => preparedTexture(EARTH_LAYERS[1]), []);
  useEffect(() => () => { nightMap?.dispose(); cloudMap?.dispose(); }, [nightMap, cloudMap]);

  const cityMaterial = useMemo(() => {
    if (!nightMap) return null;
    const material = new THREE.MeshBasicMaterial({
      map: nightMap,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uEarthSunDirection = { value: sunDirection };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vEarthWorldNormal;')
        .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvEarthWorldNormal = normalize(mat3(modelMatrix) * objectNormal);');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec3 uEarthSunDirection;\nvarying vec3 vEarthWorldNormal;')
        .replace(
          '#include <map_fragment>',
          '#include <map_fragment>\nfloat earthNight = 1.0 - smoothstep(-0.08, 0.18, dot(normalize(vEarthWorldNormal), normalize(uEarthSunDirection)));\ndiffuseColor.a *= earthNight;',
        );
    };
    material.customProgramCacheKey = () => 'earth-city-lights-night-hemisphere';
    return material;
  }, [nightMap, sunDirection]);
  const cloudMaterial = useMemo(
    () =>
      cloudMap
        ? new THREE.MeshStandardMaterial({
            map: cloudMap,
            alphaMap: cloudMap,
            color: '#ffffff',
            transparent: true,
            opacity: 0.3,
            roughness: 1,
            metalness: 0,
            depthWrite: false,
          })
        : null,
    [cloudMap],
  );
  const atmosphereMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#589be8',
        side: THREE.BackSide,
        transparent: true,
        opacity: 0.16,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  );

  useEffect(
    () => () => {
      cityMaterial?.dispose();
      cloudMaterial?.dispose();
      atmosphereMaterial.dispose();
    },
    [atmosphereMaterial, cityMaterial, cloudMaterial],
  );

  return (
    <>
      {cityMaterial && <mesh geometry={geometry} scale={1.004} material={cityMaterial} />}
      {cloudMaterial && <mesh geometry={geometry} scale={1.014} material={cloudMaterial} />}
      <mesh geometry={geometry} scale={1.065} material={atmosphereMaterial} />
    </>
  );
}

function createSaturnRingTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not create Saturn ring texture canvas.');
  context.translate(canvas.width / 2, canvas.height / 2);
  for (let radius = 155; radius < 255; radius++) {
    const band = 0.5 + 0.24 * Math.sin(radius * 0.27) + 0.13 * Math.sin(radius * 0.73);
    const alpha = radius > 205 && radius < 216 ? 0.025 : Math.max(0.035, band);
    context.beginPath();
    context.arc(0, 0, radius, 0, Math.PI * 2);
    context.strokeStyle = `rgba(203, 185, 150, ${alpha})`;
    context.lineWidth = 1;
    context.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  return texture;
}

function SaturnRings() {
  const texture = useMemo(createSaturnRingTexture, []);
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: texture,
        color: '#dfd0af',
        transparent: true,
        opacity: 0.88,
        side: THREE.DoubleSide,
        depthWrite: false,
        toneMapped: false,
      }),
    [texture],
  );

  useEffect(
    () => () => {
      material.dispose();
      texture.dispose();
    },
    [material, texture],
  );

  return (
    <mesh rotation={[0.66, 0.18, -0.32]} renderOrder={1} material={material}>
      <ringGeometry args={[1.28, 2.12, 128]} />
    </mesh>
  );
}

function MarsAtmosphere({
  geometry,
  phase,
  reducedMotion,
  color,
}: {
  geometry: THREE.SphereGeometry;
  phase: CinematicPhase;
  reducedMotion: boolean;
  color: string;
}) {
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color,
        side: THREE.BackSide,
        transparent: true,
        opacity: 0.055,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    [color],
  );

  useEffect(() => () => material.dispose(), [material]);
  useFrame((_, dt) => {
    const focused = phase === 'locked' || phase === 'zooming' || phase === 'flash';
    const target = phase === 'zooming' ? 0.24 : focused ? 0.18 : 0.055;
    material.opacity = reducedMotion ? target : THREE.MathUtils.damp(material.opacity, target, 7, Math.min(dt, 0.05));
  });

  return <mesh geometry={geometry} scale={1.105} material={material} />;
}

function Planet({
  definition,
  geometry,
  selected,
  phase,
  marsTarget,
  registerPlanet,
  reducedMotion,
}: {
  definition: PlanetDefinition;
  geometry: THREE.SphereGeometry;
  selected: boolean;
  phase: CinematicPhase;
  marsTarget?: RefObject<THREE.Group | null>;
  registerPlanet: (id: PlanetId, node: THREE.Group | null) => void;
  reducedMotion: boolean;
}) {
  const body = useRef<THREE.Group>(null);
  const surface = useRef<THREE.Group>(null);
  const angle = useRef((definition.seed / 31) * Math.PI * 2);
  const focus = useRef(0);
  const zoom = useRef(0);
  const appearance = useRef(-1);
  const priorPhase = useRef(phase);
  const earthSunDirection = useRef(new THREE.Vector3(1, 0, 0));
  const sunPosition = useMemo(() => new THREE.Vector3(), []);
  const planetPosition = useMemo(() => new THREE.Vector3(), []);
  const attachBody = useCallback(
    (node: THREE.Group | null) => {
      body.current = node;
      registerPlanet(definition.id, node);
      if (marsTarget) marsTarget.current = node;
    },
    [definition.id, marsTarget, registerPlanet],
  );
  const textureUrl = PLANET_TEXTURE_URLS[definition.id];
  const texture = useMemo(
    () => (textureUrl ? preparedTexture(textureUrl) : createPlanetTexture(definition)),
    [definition, textureUrl],
  );
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: texture,
        color: '#ffffff',
        roughness: definition.id === 'earth' ? 0.72 : definition.id === 'venus' ? 0.94 : 0.88,
        metalness: 0,
        emissive: definition.glow,
        emissiveIntensity: 0,
      }),
    [definition.glow, definition.id, texture],
  );
  const markerMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#5edcff',
        transparent: true,
        opacity: 0.38,
        side: THREE.DoubleSide,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  );
  useEffect(
    () => () => {
      texture?.dispose();
      material.dispose();
      markerMaterial.dispose();
    },
    [markerMaterial, material, texture],
  );

  useFrame((_, dtRaw) => {
    const dt = phase === 'idle' ? 0 : Math.min(dtRaw, 0.05);
    if (phase === 'idle') { focus.current = 0; zoom.current = 0; }
    if (priorPhase.current !== phase) {
      if (phase === 'locked') focus.current = 0;
      if (phase === 'zooming') zoom.current = 0;
      priorPhase.current = phase;
    }
    if (!reducedMotion && !PHASES_THAT_FREEZE_ORBITS.has(phase)) angle.current += dt * definition.speed;
    if (selected && phase === 'locked') focus.current = Math.min(1, focus.current + dt / 0.8);
    if (selected && (phase === 'zooming' || phase === 'flash')) {
      zoom.current = Math.min(1, zoom.current + dt / (phase === 'zooming' ? 0.38 : 0.12));
    }
    const approach = Math.max(focus.current, zoom.current);
    const finalSelection = phase === 'locked' || phase === 'zooming' || phase === 'flash' || phase === 'video';

    if (body.current) {
      const orbitX = Math.cos(angle.current) * definition.orbit;
      const orbitY = Math.sin(angle.current) * definition.orbit * 0.72;
      const orbitZ = Math.sin(angle.current * 0.5 + definition.seed) * definition.orbit * 0.14;
      body.current.position.set(orbitX * (1 - approach), orbitY * (1 - approach), orbitZ * (1 - approach) + approach * 0.52);
      body.current.scale.setScalar(definition.radius * (1 + focus.current * 2 + zoom.current * 15));
      body.current.visible = !(zoom.current > 0.1 && !selected);
    }
    if (surface.current && !reducedMotion) surface.current.rotation.y += dt * definition.rotationSpeed;
    if (definition.id === 'earth' && body.current?.parent) {
      body.current.parent.getWorldPosition(sunPosition);
      body.current.getWorldPosition(planetPosition);
      earthSunDirection.current.subVectors(sunPosition, planetPosition).normalize();
    }
    if (body.current) body.current.rotation.z = definition.axialTilt;
    const nextAppearance = finalSelection ? (selected ? 2 : 3) : selected ? 1 : 0;
    if (appearance.current !== nextAppearance) {
      markerMaterial.color.copy(
        nextAppearance === 2 ? (definition.id==='neptune' ? MARKER_CYAN : MARKER_LOCKED) : nextAppearance === 1 ? MARKER_SELECTED : MARKER_CYAN,
      );
      material.color.copy(nextAppearance === 3 ? PLANET_DIM : PLANET_WHITE);
      appearance.current = nextAppearance;
    }
    markerMaterial.opacity = selected ? 0.95 : finalSelection ? 0.1 : 0.18;
    material.emissiveIntensity = selected ? 0.28 + focus.current * 0.06 + zoom.current * 0.12 : 0;
  }, -1);

  return (
    <group ref={attachBody} position={[definition.orbit, 0, 0]} scale={definition.radius}>
      <group ref={surface}>
        <mesh geometry={geometry} material={material} />
        {definition.id === 'earth' && <EarthLayers geometry={geometry} sunDirection={earthSunDirection.current} />}
        {(definition.id === 'mars' || definition.id === 'neptune') && (
          <MarsAtmosphere geometry={geometry} phase={phase} reducedMotion={reducedMotion} color={definition.glow} />
        )}
      </group>
      <mesh rotation={[0.1, 0.16, -0.3]}>
        <ringGeometry args={[1.38, 1.46, 40]} />
        <primitive object={markerMaterial} attach="material" />
      </mesh>
      {definition.id === 'saturn' && <SaturnRings />}
    </group>
  );
}

function OrbitPath({
  planet,
  phase,
  reducedMotion,
  orbitMaterial,
  trailMaterial,
}: {
  planet: PlanetDefinition;
  phase: CinematicPhase;
  reducedMotion: boolean;
  orbitMaterial: THREE.MeshBasicMaterial;
  trailMaterial: THREE.MeshBasicMaterial;
}) {
  const path = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (!path.current || reducedMotion) return;
    const speed = phase === 'roulette' ? 2.2 : phase === 'activating' ? 1.4 : 0.14;
    if (phase !== 'idle') path.current.rotation.z += Math.min(dt, 0.05) * speed;
  });

  return (
    <group
      ref={path}
      position={[0, 0, -0.035 - (planet.seed % 4) * 0.008]}
      rotation={[(planet.seed % 3) * 0.035, (planet.seed % 4) * 0.025, (planet.seed % 5) * 0.025]}
    >
      <mesh>
        <ringGeometry args={[planet.orbit - 0.0015, planet.orbit + 0.0015, 96]} />
        <primitive object={orbitMaterial} attach="material" />
      </mesh>
      <mesh>
        <torusGeometry args={[planet.orbit, 0.002, 4, 32, Math.PI * 0.34]} />
        <primitive object={trailMaterial} attach="material" />
      </mesh>
    </group>
  );
}

function NavigationStars({ geometry }: { geometry: THREE.BufferGeometry }) {
  return (
    <points geometry={geometry}>
      <pointsMaterial size={0.008} color="#9eeaff" transparent opacity={0.72} sizeAttenuation depthWrite={false} />
    </points>
  );
}

export function PlanetaryRoulette({
  phase,
  selectedPlanet,
  marsTarget,
  reducedMotion,
  onPrepared,
}: {
  onPrepared?: (ready: boolean) => void;
  phase: CinematicPhase;
  selectedPlanet: PlanetId;
  marsTarget: RefObject<THREE.Group | null>;
  reducedMotion: boolean;
}) {
  const { gl, camera, scene } = useThree();
  const system = useRef<THREE.Group>(null);
  useEffect(() => {
    const group = system.current;
    if (!group) return;
    let cancelled = false;
    onPrepared?.(false);
    // Upload maps and compile the actual roulette materials before revealing it.
    group.traverse((object) => {
      const material = (object as THREE.Mesh).material;
      for (const entry of Array.isArray(material) ? material : material ? [material] : []) {
        for (const value of Object.values(entry)) if (value instanceof THREE.Texture) gl.initTexture(value);
      }
    });
    const wasVisible = group.visible;
    group.visible = true;
    const compiled = gl.compileAsync(scene, camera);
    group.visible = wasVisible;
    void compiled.then(() => {
      if (cancelled) return;
      // A real offscreen draw uploads geometry too, without flashing the planets onscreen.
      const target = new THREE.WebGLRenderTarget(64, 64);
      const previousTarget = gl.getRenderTarget();
      const visible = group.visible;
      const previewCamera = camera.clone();
      previewCamera.position.set(0, 1.66, -1.2);
      previewCamera.lookAt(0, 1.74, -2.3);
      try {
        group.visible = true;
        gl.setRenderTarget(target);
        gl.render(scene, previewCamera);
      } finally {
        gl.setRenderTarget(previousTarget);
        group.visible = visible;
        target.dispose();
      }
      onPrepared?.(true);
    }).catch((error) => {
      console.error('Roulette shader preparation failed', error);
      if (!cancelled) onPrepared?.(true); // Keep skip/playback available on unsupported GPUs.
    });
    return () => { cancelled = true; };
  }, [gl, camera, scene, onPrepared]);
  const reticle = useRef<THREE.Group>(null);
  const sunLight = useRef<THREE.PointLight>(null);
  const systemScale = useRef(0.04);
  const planetRefs = useRef(new Map<PlanetId, THREE.Group>());
  const geometry = useMemo(() => new THREE.SphereGeometry(1, 48, 32), []);
  const stars = useMemo(() => {
    const positions = new Float32Array(210);
    for (let i = 0; i < positions.length / 3; i++) {
      const a = i * 2.399;
      const r = 0.82 + ((i * 37) % 100) / 100 * 0.2;
      positions.set([Math.cos(a) * r, Math.sin(a) * r, -0.12 - ((i * 19) % 13) * 0.012], i * 3);
    }
    const result = new THREE.BufferGeometry();
    result.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return result;
  }, []);

  useEffect(
    () => () => {
      geometry.dispose();
      stars.dispose();
    },
    [geometry, stars],
  );

  const orbitMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#50cfe9',
        transparent: true,
        opacity: 0.2,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [],
  );
  const trailMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#8beaff',
        transparent: true,
        opacity: 0.68,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [],
  );
  const reticleMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#8beaff',
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [],
  );
  const registerPlanet = useCallback((id: PlanetId, node: THREE.Group | null) => {
    if (node) planetRefs.current.set(id, node);
    else planetRefs.current.delete(id);
  }, []);

  useEffect(
    () => () => {
      orbitMaterial.dispose();
      trailMaterial.dispose();
      reticleMaterial.dispose();
    },
    [orbitMaterial, reticleMaterial, trailMaterial],
  );

  useFrame((_, dtRaw) => {
    const dt = phase === 'idle' ? 0 : Math.min(dtRaw, 0.05);
    if (phase === 'idle') systemScale.current = 0.04;
    systemScale.current = reducedMotion ? 1.12 : THREE.MathUtils.damp(systemScale.current, 1.12, phase === 'activating' ? 7 : 3.2, dt);
    if (system.current) system.current.scale.setScalar(systemScale.current);
    if (system.current && !reducedMotion && phase !== 'zooming' && phase !== 'flash') {
      system.current.rotation.z = Math.sin(performance.now() * 0.00015) * 0.035;
    }
    const selected = planetRefs.current.get(selectedPlanet);
    if (selected && reticle.current) {
      // Follow the chosen planet directly: easing across short stops never reached it.
      reticle.current.position.copy(selected.position);
      reticle.current.position.z += selected.scale.x * 1.1;
      reticle.current.scale.setScalar(selected.scale.x * 1.65 / 0.072);
      reticle.current.rotation.z = !reducedMotion && phase === 'roulette' ? performance.now() * 0.003 : 0;
      reticle.current.visible = phase !== 'activating';
    }
    reticleMaterial.color.copy(
      phase === 'locked' || phase === 'zooming' || phase === 'flash' ? MARKER_LOCKED : MARKER_CYAN,
    );
    reticleMaterial.opacity = phase === 'locked' && !reducedMotion ? 0.85 + Math.sin(performance.now() * 0.01) * 0.12 : 0.82;
    orbitMaterial.opacity = phase === 'roulette' ? 0.28 : phase === 'activating' ? 0.2 : 0.13;
    const pulse = phase === 'activating' ? Math.sin(performance.now() * 0.012) * 0.18 : 0;
    if (sunLight.current) sunLight.current.intensity = 2.8 + pulse;
  }, -0.5);

  return (
    <group ref={system} visible={phase !== 'idle' && phase !== 'video'} position={[0, 1.74, -2.3]}>
      <ambientLight color="#9aaabd" intensity={0.14} />
      <pointLight ref={sunLight} color="#fff1d2" intensity={2.8} distance={2.4} decay={2} />
      <NavigationStars geometry={stars} />
      <Sun />
      {PLANETS.map((planet) => (
        <OrbitPath
          key={`${planet.id}-orbit`}
          planet={planet}
          phase={phase}
          reducedMotion={reducedMotion}
          orbitMaterial={orbitMaterial}
          trailMaterial={trailMaterial}
        />
      ))}
      <group ref={reticle} visible={false}>
        <mesh material={reticleMaterial}>
          <ringGeometry args={[0.072, 0.076, 48]} />
        </mesh>
        <mesh position={[0, 0.105, 0]} material={reticleMaterial}>
          <boxGeometry args={[0.003, 0.045, 0.003]} />
        </mesh>
        <mesh position={[0, -0.105, 0]} material={reticleMaterial}>
          <boxGeometry args={[0.003, 0.045, 0.003]} />
        </mesh>
        <mesh position={[0.105, 0, 0]} material={reticleMaterial}>
          <boxGeometry args={[0.045, 0.003, 0.003]} />
        </mesh>
        <mesh position={[-0.105, 0, 0]} material={reticleMaterial}>
          <boxGeometry args={[0.045, 0.003, 0.003]} />
        </mesh>
      </group>
      {PLANETS.map((planet) => (
        <Planet
          key={planet.id}
          definition={planet}
          geometry={geometry}
          selected={planet.id === selectedPlanet}
          phase={phase}
          marsTarget={planet.id === selectedPlanet ? marsTarget : undefined}
          registerPlanet={registerPlanet}
          reducedMotion={reducedMotion}
        />
      ))}
      <mesh rotation={[0, 0, Math.PI / 4]} position={[0, 0, -0.06]}>
        <ringGeometry args={[0.89, 0.895, 96]} />
        <meshBasicMaterial color="#ff9b55" transparent opacity={phase === 'locked' ? 0.58 : 0.18} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}
