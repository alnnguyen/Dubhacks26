import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { ExploreDestination } from './destinations';
import { CATALOG_STARS, CATALOG_GALAXIES, CATALOG_HOSTS, STAR_INDEX, GALAXY_INDEX, starPosition, galaxyPosition, hostLayout } from './catalog';

type PointRow = { id: string; position: [number, number, number]; color: string };
const spectralColor = (type: string | null) => type?.startsWith('M') ? '#ffad78' : type?.startsWith('K') ? '#ffd1a2' : type?.startsWith('O') || type?.startsWith('B') ? '#a4c9ff' : '#f5f3e7';
export function CatalogPoints({ rows, onLearn, size = 3 }: { rows: PointRow[]; onLearn: (id: string) => void; size?: number }) {
  const pointTexture = usePointTexture();
  const geometry = useMemo(() => {
    const positions = new Float32Array(rows.length * 3), colors = new Float32Array(rows.length * 3);
    rows.forEach((r, i) => { positions.set(r.position, i*3); new THREE.Color(r.color).toArray(colors,i*3); });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.BufferAttribute(positions,3));
    g.setAttribute('color',new THREE.BufferAttribute(colors,3)); g.computeBoundingSphere(); return g;
  }, [rows]);
  useEffect(() => () => geometry.dispose(),[geometry]);
  return <points geometry={geometry} onClick={e => { if (e.delta <= 5 && e.index !== undefined && rows[e.index]) { e.stopPropagation(); onLearn(rows[e.index].id); } }}>
    <pointsMaterial map={pointTexture} transparent alphaTest={0.05} vertexColors size={size} sizeAttenuation={false} toneMapped={false} />
  </points>;
}
function Label({ name, position, onClick }: { name: string; position: [number,number,number]; onClick: () => void }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d')!;
    ctx.font = '24px ui-monospace, monospace';
    canvas.width = Math.ceil(ctx.measureText(name).width) + 24; canvas.height = 42;
    ctx.fillStyle = '#04121bdd'; ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.font = '24px ui-monospace, monospace'; ctx.fillStyle = '#c9eeff'; ctx.textBaseline = 'middle'; ctx.fillText(name,12,21);
    const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; return t;
  },[name]);
  useEffect(() => () => texture.dispose(),[texture]);
  return <sprite position={position} scale={[texture.image.width/950,42/950,1]} onClick={e => { if(e.delta>5)return;e.stopPropagation();onClick(); }}>
    <spriteMaterial map={texture} sizeAttenuation={false} depthTest={false} transparent toneMapped={false} />
  </sprite>;
}
export function usePointTexture() {
  const texture=useMemo(() => {
    const canvas=document.createElement('canvas');canvas.width=canvas.height=32;
    const ctx=canvas.getContext('2d')!; const gradient=ctx.createRadialGradient(16,16,0,16,16,16);
    gradient.addColorStop(0,'white');gradient.addColorStop(.3,'#ffffffdd');gradient.addColorStop(1,'#ffffff00');
    ctx.fillStyle=gradient;ctx.fillRect(0,0,32,32);return new THREE.CanvasTexture(canvas);
  },[]);
  useEffect(() => () => texture.dispose(),[texture]);return texture;
}

function TargetStar({ id, position, name, color, onLearn }: { id: string; position: [number,number,number]; name: string; color: string; onLearn: (id:string) => void }) {
  return <group position={position}>
    <mesh onClick={e => { if (e.delta > 5) return; e.stopPropagation(); onLearn(id); }}>
      <sphereGeometry args={[0.9,24,16]} /><meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
    <mesh scale={1.7}><sphereGeometry args={[0.9,16,12]} /><meshBasicMaterial color={color} transparent opacity={0.1} depthWrite={false} /></mesh>
    <Label name={name} position={[0,2,0]} onClick={() => onLearn(id)} />
  </group>;
}
/** This glyph illustrates morphology; source coordinates/distances belong to the catalog layer. */
function GalaxyGlyph({ id, name, position, elliptical, onLearn }: { id: string; name: string; position: [number,number,number]; elliptical: boolean; onLearn: (id:string) => void }) {
  const pointTexture = usePointTexture();
  const geometry = useMemo(() => {
    const pos = new Float32Array(2200*3);
    let seed = 725;
    const rnd = () => ((seed = seed * 16807 % 2147483647)/2147483647);
    for (let i=0;i<2200;i++) {
      const r = Math.sqrt(rnd())*10, theta = r*0.85+(i%2)*Math.PI+(rnd()-.5)*.8;
      pos.set(elliptical ? [(rnd()-.5)*r, (rnd()-.5)*r*.65,(rnd()-.5)*r*.8] : [Math.cos(theta)*r,(rnd()-.5)*1.1,Math.sin(theta)*r*.65],i*3);
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));return g;
  },[elliptical]);
  useEffect(() => () => geometry.dispose(),[geometry]);
  return <group position={position} rotation={[0.7,0.2,0.3]}>
    <points geometry={geometry}><pointsMaterial map={pointTexture} alphaTest={0.05} color={elliptical ? '#ffe3ba' : '#b9ceff'} size={2} sizeAttenuation={false} transparent opacity={.8} toneMapped={false} depthWrite={false} /></points>
    <mesh onClick={e => { if(e.delta>5)return;e.stopPropagation();onLearn(id); }}><sphereGeometry args={[10,16,12]} /><meshBasicMaterial transparent opacity={0} colorWrite={false} depthWrite={false} /></mesh>
    <mesh><sphereGeometry args={[.65,16,12]} /><meshBasicMaterial color="#fff1d4" toneMapped={false} /></mesh>
    <Label name={name} position={[0,12,0]} onClick={() => onLearn(id)} />
  </group>;
}
export function CatalogScene({ destination, onLearn }: { destination: ExploreDestination; onLearn: (id:string) => void }) {
  const env = destination.environment;
  const stars = useMemo(() => CATALOG_STARS.map(s => ({ id:s.id, position:starPosition(s), color:spectralColor(s.spectralType) })),[]);
  const hosts = useMemo(() => CATALOG_HOSTS.map(p => ({ id:p.id, position:starPosition(p), color:'#ffad69' })),[]);
  const galaxies = useMemo(() => CATALOG_GALAXIES.map(g => ({ id:g.id, position:galaxyPosition(g), color:g.morphology?.startsWith('E') ? '#ffe0b3' : '#accdff' })),[]);
  const selectedStar = destination.bodyId ? STAR_INDEX.get(destination.bodyId) : null;
  const selectedGalaxy = destination.bodyId ? GALAXY_INDEX.get(destination.bodyId) : null;
  const layout = useMemo(() => hostLayout(destination.host ?? ''),[destination.host]);
  const labels = useMemo(() => CATALOG_STARS.filter(s => s.named).slice(0,8),[]);
  if (env === 'stars') return <group name="measured-stellar-neighborhood">
    <CatalogPoints rows={stars} onLearn={onLearn} /><CatalogPoints rows={hosts} onLearn={onLearn} size={3.5} />
    <TargetStar id="sun" name="Sun / Sol" position={[0,0,0]} color="#fff1c2" onLearn={onLearn} />
    {labels.filter(s => s.id !== selectedStar?.id).map(s => <Label key={s.id} name={s.name} position={starPosition(s)} onClick={() => onLearn(s.id)} />)}
    {selectedStar && <TargetStar id={selectedStar.id} name={selectedStar.name} position={starPosition(selectedStar)} color={spectralColor(selectedStar.spectralType)} onLearn={onLearn} />}
  </group>;
  if (env === 'galaxies') return <group name="published-galaxy-map">
    <CatalogPoints rows={galaxies} onLearn={onLearn} size={4} />
    <TargetStar id="milky-way" name="Milky Way / origin" position={[0,0,0]} color="#6fe5d0" onLearn={onLearn} />
    {selectedGalaxy && <GalaxyGlyph id={selectedGalaxy.id} name={selectedGalaxy.alias ?? selectedGalaxy.name} position={galaxyPosition(selectedGalaxy)} elliptical={selectedGalaxy.morphology?.startsWith('E') ?? false} onLearn={onLearn} />}
    {CATALOG_GALAXIES.filter(g => g.alias && g.id!==selectedGalaxy?.id).map(g => <Label key={g.id} name={g.alias!} position={galaxyPosition(g)} onClick={() => onLearn(g.id)} />)}
  </group>;
  if (env !== 'exoplanets') return null;
  return <group name="catalog-exoplanet-system">
    <ambientLight intensity={0.6} />
    <pointLight position={[0,8,0]} intensity={180} distance={400} decay={1} />
    <mesh><sphereGeometry args={[4,32,24]} /><meshBasicMaterial color="#ffc692" toneMapped={false} /></mesh>
    <Label name={destination.host ?? 'Host star'} position={[0,6,0]} onClick={() => onLearn(`host:${destination.host}`)} />
    {layout.map(({planet, position, radius, orbit},i) => <group key={planet.id}>
      <mesh rotation={[-Math.PI/2,0,0]}><ringGeometry args={[orbit-.03,orbit+.03,96]} /><meshBasicMaterial color="#36586b" side={THREE.DoubleSide} transparent opacity={.45} /></mesh>
      <mesh position={position} onClick={e => { if(e.delta>5)return;e.stopPropagation();onLearn(planet.id); }}>
        <sphereGeometry args={[radius,32,24]} /><meshStandardMaterial color={['#9fa7ba','#c08058','#6d9ab0','#c7aa79'][i%4]} roughness={.8} />
      </mesh>
      <Label name={planet.name} position={[position[0],radius+2,position[2]]} onClick={() => onLearn(planet.id)} />
    </group>)}
  </group>;
}
