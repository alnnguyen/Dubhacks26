import snapshot from './data/local-objects.json';
import spacex from './data/spacex.json';
import { bodyWorldPosition, SOLAR_BODIES } from './bodies';
import type { BodyScience } from './bodiesScience';
import type { ExploreDestination } from './destinations';

export const LOCAL_OBJECT_MANIFEST=snapshot;
export interface OrbitElements { a:number; e:number; i:number; om:number; w:number; ma:number }
export interface LocalObject {
  id:string; name:string; kind:'satellite'|'asteroid'|'comet'|'probe'; position:[number,number,number]; radius:number;
  elements:OrbitElements; epoch:string; facts:{label:string;value:string}[]; source:string; sourceUrl:string;
  /** Docked craft (e.g. Dragon at the ISS) ride on their host's position. */
  dockedTo?:string;
  /** SpaceX launch context for craft that SpaceX flew (owner may differ). */
  launch?:{vehicle:string;date?:string;operator:string};
}
const rad=Math.PI/180;
/** Elliptic two-body illustration at the supplied mean anomaly, not SGP4/Horizons. */
export function orbitalPosition(o:OrbitElements):[number,number,number] {
  const mean=((o.ma*rad)%(2*Math.PI)+2*Math.PI)%(2*Math.PI);
  let E=o.e>.8 ? Math.PI : mean;
  for(let n=0;n<30;n++) { const change=(E-o.e*Math.sin(E)-mean)/(1-o.e*Math.cos(E)); E-=change;if(Math.abs(change)<1e-12)break; }
  const x=o.a*(Math.cos(E)-o.e), y=o.a*Math.sqrt(1-o.e*o.e)*Math.sin(E);
  const c=Math.cos(o.w*rad), s=Math.sin(o.w*rad), ci=Math.cos(o.i*rad), si=Math.sin(o.i*rad), co=Math.cos(o.om*rad), so=Math.sin(o.om*rad);
  const px=x*c-y*s, py=x*s+y*c;
  // Ecliptic/equatorial reference plane maps to scene XZ, north to +Y.
  return [co*px-so*py*ci,py*si,-so*px-co*py*ci];
}
/** Same designed radial compression used by the authored planetary layout. */
export function compressedAu(au:number) {
  const anchors=[[0,0],[.387,28],[.723,42],[1,100],[1.524,140],[5.203,220],[9.537,310],[19.191,410],[30.069,510]];
  for(let i=1;i<anchors.length;i++) if(au<=anchors[i][0]) { const [a,x]=anchors[i-1],[b,y]=anchors[i];return x+(y-x)*(au-a)/(b-a); }
  return 510+100*Math.log1p((au-30.069)/10);
}
function smallPosition(o:OrbitElements):[number,number,number] {
  const p=orbitalPosition(o), r=Math.hypot(...p), scale=compressedAu(r)/r;
  return p.map(v=>v*scale) as [number,number,number];
}
/** CelesTrak records for SpaceX-flown Earth orbiters (docked Dragons, TESS) and their launch context. */
const SPACEX_EARTH=spacex.earthOrbit;
const SPACEX_EXTRA=new Map<number,{dockedTo?:string;launch?:{vehicle:string;date?:string;operator:string}}>(spacex.earthOrbit.map(s=>[s.NORAD_CAT_ID,
  s.role==='dragon'?{dockedTo:spacex.dockedAtIss.includes(s.NORAD_CAT_ID)?'sat-25544':undefined,launch:{vehicle:'Falcon 9',date:s.LAUNCH_DATE ?? undefined,operator:s.OBJECT_NAME.startsWith('CREW')?'NASA / SpaceX crew mission':'NASA / SpaceX cargo resupply'}}
  :{launch:{vehicle:(s as {launchVehicle?:string}).launchVehicle ?? 'Falcon 9',date:s.LAUNCH_DATE ?? undefined,operator:(s as {operator?:string}).operator ?? 'NASA'}}]));
const earth=bodyWorldPosition(SOLAR_BODIES.find(b=>b.id==='earth')!);
/** Earth-centered display radius: low orbits ×5 altitude (unchanged); high orbits (TESS) log-compressed out toward the Moon's display distance. */
export function displayRadius(rKm:number) {
  const low=(r:number)=>3.2+Math.max(.05,(r-6371)/6371*3.2)*5;
  if(rKm<=7000)return low(rKm);
  return low(7000)+1.3*Math.log(rKm/7000)/Math.log(384400/7000);
}
const fmt=(n:number)=>n.toLocaleString('en-US',{maximumFractionDigits:3});
export const LOCAL_OBJECTS:LocalObject[]=[
  ...[...snapshot.satellites,...SPACEX_EARTH].map(s=> {
    const elements={a:Math.cbrt(398600.4418/Math.pow(s.MEAN_MOTION*2*Math.PI/86400,2)),e:s.ECCENTRICITY,i:s.INCLINATION,om:s.RA_OF_ASC_NODE,w:s.ARG_OF_PERICENTER,ma:s.MEAN_ANOMALY};
    const p=orbitalPosition(elements), r=Math.hypot(...p), display=displayRadius(r);
    const starlink=s.OBJECT_NAME.startsWith('STARLINK');
    const extra=SPACEX_EXTRA.get(s.NORAD_CAT_ID);
    return {id:`sat-${s.NORAD_CAT_ID}`,name:s.NORAD_CAT_ID===25544?'ISS':s.NORAD_CAT_ID===20580?'Hubble Space Telescope':s.OBJECT_NAME,kind:'satellite' as const,...extra,
      position:p.map((v,i)=>earth[i]+v/r*display) as [number,number,number],radius:.18,elements,epoch:s.EPOCH,
      source:starlink?'TLE API / CelesTrak · NASA Open APIs-listed community mirror':'CelesTrak GP orbital-element snapshot',
      sourceUrl:starlink?'https://tle.ivanstanojevic.me/':'https://celestrak.org/NORAD/documentation/gp-data-formats.php',
      facts:[{label:'Catalog name',value:s.OBJECT_NAME},{label:'NORAD catalog ID',value:String(s.NORAD_CAT_ID)},{label:'Element epoch UTC',value:s.EPOCH},{label:'Inclination',value:`${fmt(s.INCLINATION)}°`},
        {label:'Mean orbital period',value:`${fmt(1440/s.MEAN_MOTION)} min`},{label:'Approximate perigee / apogee altitude',value:`${fmt(elements.a*(1-elements.e)-6371)} / ${fmt(elements.a*(1+elements.e)-6371)} km`},
        {label:'Eccentricity',value:String(s.ECCENTRICITY)},{label:'Data status',value:starlink?'Community-mirrored snapshot; not live fleet status':'Snapshot; not live tracking'},
        ...(extra?.dockedTo?[{label:'Status',value:'Docked at the ISS (orbital elements match the station)'}]:[]),
        ...(extra?.launch?[{label:'Launched on',value:`SpaceX ${extra.launch.vehicle}${extra.launch.date?` · ${extra.launch.date}`:''}`},{label:'Operator',value:extra.launch.operator}]:[]),
        {label:'Display model',value:'Mean-element two-body propagation from epoch (time-lapse); altitude above Earth ×5 (high orbits log-compressed), craft oversized; equatorial frame.'}],
    };
  }),
  ...spacex.heliocentric.map(h=>({id:h.id,name:h.name,kind:'probe' as const,position:smallPosition(h),radius:.6,elements:h,epoch:`JD ${h.epochJD} TDB`,
    launch:{vehicle:h.launchVehicle,date:h.launchDate,operator:h.operator},
    source:'NASA/JPL Horizons osculating elements',sourceUrl:`https://ssd.jpl.nasa.gov/horizons/app.html#/?sstr=${encodeURIComponent(h.spkid)}`,
    facts:[{label:'Horizons ID',value:h.spkid},{label:'Launched on',value:`SpaceX ${h.launchVehicle} · ${h.launchDate}`},{label:'Operator',value:h.operator},
      {label:'Elements epoch',value:`JD ${h.epochJD} TDB`},{label:'Semimajor axis',value:`${fmt(h.a)} AU`},{label:'Perihelion',value:`${fmt(h.perihelionAu)} AU`},
      {label:'Aphelion',value:`${fmt(h.a*(1+h.e))} AU`},{label:'Orbital period',value:`${fmt(h.periodDays/365.25)} years (${fmt(h.periodDays)} days)`},
      {label:'Eccentricity',value:fmt(h.e)},{label:'Inclination',value:`${fmt(h.i)}°`},
      {label:'Display model',value:'Heliocentric osculating orbit at the element epoch, ecliptic frame; radial distances compressed like the planets; craft oversized.'}]})),
  ...snapshot.smallBodies.map(s=>({id:s.id,name:s.name,kind:s.kind as 'asteroid'|'comet',position:smallPosition(s),radius:s.kind==='comet'?.65:.5,elements:s,epoch:`JD ${s.epoch} TDB`,source:'NASA/JPL Small-Body Database',sourceUrl:`https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=${encodeURIComponent(s.pdes)}`,
    facts:[{label:'JPL SPK-ID',value:s.spkid},{label:'Orbit epoch',value:`JD ${s.epoch} TDB`},{label:'Semimajor axis',value:`${fmt(s.a)} AU`},{label:'Eccentricity',value:String(s.e)},{label:'Inclination',value:`${fmt(s.i)}°`},
      {label:'Perihelion / aphelion',value:`${fmt(s.a*(1-s.e))} / ${fmt(s.a*(1+s.e))} AU`},{label:'Orbital period',value:s.per?`${fmt(s.per/365.25)} years`:'Unknown'},
      {label:'Diameter',value:s.diameter?`${fmt(s.diameter)} km`:'Not reported in this snapshot'},
      {label:'Display model',value:'Two-body position at each record epoch in the ecliptic frame; radial distances compressed. Surface, size and comet tail illustrative.'}],
  })),
];
export const LOCAL_OBJECT_INDEX=new Map(LOCAL_OBJECTS.map(o=>[o.id,o]));
export const LOCAL_OBJECT_DESTINATIONS:ExploreDestination[]=LOCAL_OBJECTS.map(o=> {
  // Spacecraft get a close look; asteroids and comets keep the wider approach.
  const delta=o.kind==='satellite' ? o.position.map((v,i)=>v-earth[i]) : o.kind==='probe' ? [0,1,3.2] : [0,3,12];
  const length=Math.hypot(...delta), scale=o.kind==='satellite'?7/length:1;
  // Spacecraft: a close three-quarter view from above and slightly ahead, with Earth behind.
  const side=o.kind==='satellite'?[0,1.6,1.4]:[0,0,0];
  return {id:`visit-${o.id}`,bodyId:o.id,label:o.name,category:o.kind==='satellite'?'Satellites':o.kind==='probe'?'Spacecraft':o.kind==='comet'?'Comets':'Asteroids',environment:'solar',
    spawn:o.position.map((v,i)=>v+delta[i]*scale+side[i]) as [number,number,number],yaw:0,
    briefing:o.launch?`Launched on SpaceX ${o.launch.vehicle} · ${o.launch.operator} · ${o.dockedTo?'docked at the ISS':`epoch ${o.epoch}`}`:`${o.kind==='satellite'&&o.name.startsWith('STARLINK')?'Starlink TLE snapshot':o.source} · epoch ${o.epoch} · illustrated snapshot`};
});
export function localObjectScience(id:string):BodyScience|null {
  const o=LOCAL_OBJECT_INDEX.get(id);if(!o)return null;
  return {id,name:o.name,kind:o.kind,gravityMps2:null,escapeKmS:null,dayHours:null,meanTempC:null,source:o.source,sourceUrl:o.sourceUrl,realCatalog:true,snapshot:snapshot.retrievedAt.slice(0,10),facts:o.facts,
    blurb:o.id==='sx-roadster'?'Elon Musk\'s Tesla Roadster, with a spacesuited mannequin called Starman in the driver\'s seat, launched as the dummy payload on the first Falcon Heavy flight in February 2018. It has been coasting around the Sun ever since, crossing the orbits of Earth and Mars. Position from NASA/JPL Horizons; the model is schematic.'
      :o.kind==='probe'?`A ${o.launch?.operator} spacecraft launched on a SpaceX ${o.launch?.vehicle}, shown on its heliocentric cruise orbit from NASA/JPL Horizons. Osculating elements at the snapshot epoch — its trajectory changes with gravity assists and thrusting. The model is schematic.`
      :o.dockedTo?'A SpaceX Dragon currently docked at the International Space Station — its orbital elements match the station\'s. Dragon is the only operational US spacecraft that carries crew and cargo to the ISS and back. Shown on the station; the model is schematic.'
      :o.launch?`${o.launch.operator}'s ${o.name}, launched on a SpaceX ${o.launch.vehicle}. CelesTrak orbital-element snapshot; its high, elongated orbit is log-compressed in this view. Not live tracking.`
      :o.kind==='satellite'?(o.name.startsWith('STARLINK')?'A SpaceX Starlink broadband satellite from a dated orbital-element snapshot. The time-lapse moves it along that orbit with a two-body model — not live tracking. Schematic v1.0 model (one solar array); this is an 18-satellite sample of early, now-lowering v1.0 satellites, not the current constellation.':'A cataloged spacecraft from a dated orbital-element snapshot. The time-lapse moves it along that orbit with a two-body model — not live tracking. The model is schematic, built from the vehicle\'s published layout.'):o.kind==='comet'?'A cataloged comet on an elongated orbit. The tail points away from the Sun in this illustration; its brightness and extent are artistic, not an activity forecast.':'A cataloged small body. Its orbital elements and available diameter come from NASA/JPL; the visible rocky surface is an oversized illustration.'};
}
export function objectOrbit(o:LocalObject):[number,number,number][] {
  return Array.from({length:129},(_,i)=> {
    const elements={...o.elements,ma:i/128*360};
    if(o.kind!=='satellite')return smallPosition(elements);
    const p=orbitalPosition(elements),r=Math.hypot(...p),display=displayRadius(r);
    return p.map((v,j)=>earth[j]+v/r*display) as [number,number,number];
  });
}

const MU_EARTH = 398600.4418;
/** Orbital period in seconds from the semimajor axis (km). */
export function orbitalPeriodSeconds(o: LocalObject) {
  return 2 * Math.PI * Math.sqrt(Math.pow(o.elements.a, 3) / MU_EARTH);
}
/** Display position of a satellite `t` seconds after its element epoch (same two-body illustration). */
export function satellitePositionAt(o: LocalObject, t: number): [number, number, number] {
  if (o.dockedTo) return satellitePositionAt(LOCAL_OBJECT_INDEX.get(o.dockedTo)!, t);
  if (o.kind !== 'satellite' || t === 0) return o.position;
  const elements = { ...o.elements, ma: o.elements.ma + (360 * t) / orbitalPeriodSeconds(o) };
  const p = orbitalPosition(elements), r = Math.hypot(...p), display = displayRadius(r);
  return p.map((v, i) => earth[i] + v / r * display) as [number, number, number];
}
export const SATELLITES = LOCAL_OBJECTS.filter((o) => o.kind === 'satellite');
export const STARLINKS = SATELLITES.filter((o) => o.name.startsWith('STARLINK'));
/** Live display positions, written once per frame by the scene while the time-lapse runs. */
export const LIVE_POSITIONS = new Map<string, [number, number, number]>();
export function livePosition(id: string): [number, number, number] | undefined {
  return LIVE_POSITIONS.get(id) ?? LOCAL_OBJECT_INDEX.get(id)?.position;
}
/** Drawn as 3D models: ISS, Hubble and every third Starlink (all records stay searchable and visitable). */
export const MODEL_SATELLITES = SATELLITES.filter((o) => !o.dockedTo && (!o.name.startsWith('STARLINK') || STARLINKS.indexOf(o) % 3 === 0));
export const DOCKED_AT_ISS = SATELLITES.filter((o) => o.dockedTo === 'sat-25544');
export const PROBES = LOCAL_OBJECTS.filter((o) => o.kind === 'probe');
