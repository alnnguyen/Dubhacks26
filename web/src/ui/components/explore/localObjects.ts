import snapshot from './data/local-objects.json';
import { bodyWorldPosition, SOLAR_BODIES } from './bodies';
import type { BodyScience } from './bodiesScience';
import type { ExploreDestination } from './destinations';

export const LOCAL_OBJECT_MANIFEST=snapshot;
export interface OrbitElements { a:number; e:number; i:number; om:number; w:number; ma:number }
export interface LocalObject {
  id:string; name:string; kind:'satellite'|'asteroid'|'comet'; position:[number,number,number]; radius:number;
  elements:OrbitElements; epoch:string; facts:{label:string;value:string}[]; source:string; sourceUrl:string;
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
const earth=bodyWorldPosition(SOLAR_BODIES.find(b=>b.id==='earth')!);
const fmt=(n:number)=>n.toLocaleString('en-US',{maximumFractionDigits:3});
export const LOCAL_OBJECTS:LocalObject[]=[
  ...snapshot.satellites.map(s=> {
    const elements={a:Math.cbrt(398600.4418/Math.pow(s.MEAN_MOTION*2*Math.PI/86400,2)),e:s.ECCENTRICITY,i:s.INCLINATION,om:s.RA_OF_ASC_NODE,w:s.ARG_OF_PERICENTER,ma:s.MEAN_ANOMALY};
    const p=orbitalPosition(elements), r=Math.hypot(...p), display=3.2+Math.max(.05,(r-6371)/6371*3.2)*5;
    const starlink=s.OBJECT_NAME.startsWith('STARLINK');
    return {id:`sat-${s.NORAD_CAT_ID}`,name:s.NORAD_CAT_ID===25544?'ISS':s.NORAD_CAT_ID===20580?'Hubble Space Telescope':s.OBJECT_NAME,kind:'satellite' as const,
      position:p.map((v,i)=>earth[i]+v/r*display) as [number,number,number],radius:.18,elements,epoch:s.EPOCH,
      source:starlink?'TLE API / CelesTrak · NASA Open APIs-listed community mirror':'CelesTrak GP orbital-element snapshot',
      sourceUrl:starlink?'https://tle.ivanstanojevic.me/':'https://celestrak.org/NORAD/documentation/gp-data-formats.php',
      facts:[{label:'Catalog name',value:s.OBJECT_NAME},{label:'NORAD catalog ID',value:String(s.NORAD_CAT_ID)},{label:'Element epoch UTC',value:s.EPOCH},{label:'Inclination',value:`${fmt(s.INCLINATION)}°`},
        {label:'Mean orbital period',value:`${fmt(1440/s.MEAN_MOTION)} min`},{label:'Approximate perigee / apogee altitude',value:`${fmt(elements.a*(1-elements.e)-6371)} / ${fmt(elements.a*(1+elements.e)-6371)} km`},
        {label:'Eccentricity',value:String(s.ECCENTRICITY)},{label:'Data status',value:starlink?'Community-mirrored snapshot; not live fleet status':'Snapshot; not live tracking'},
        {label:'Display model',value:'Mean-element two-body approximation at epoch; altitude above Earth ×5, craft oversized; equatorial frame.'}],
    };
  }),
  ...snapshot.smallBodies.map(s=>({id:s.id,name:s.name,kind:s.kind as 'asteroid'|'comet',position:smallPosition(s),radius:s.kind==='comet'?.65:.5,elements:s,epoch:`JD ${s.epoch} TDB`,source:'NASA/JPL Small-Body Database',sourceUrl:`https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=${encodeURIComponent(s.pdes)}`,
    facts:[{label:'JPL SPK-ID',value:s.spkid},{label:'Orbit epoch',value:`JD ${s.epoch} TDB`},{label:'Semimajor axis',value:`${fmt(s.a)} AU`},{label:'Eccentricity',value:String(s.e)},{label:'Inclination',value:`${fmt(s.i)}°`},
      {label:'Perihelion / aphelion',value:`${fmt(s.a*(1-s.e))} / ${fmt(s.a*(1+s.e))} AU`},{label:'Orbital period',value:s.per?`${fmt(s.per/365.25)} years`:'Unknown'},
      {label:'Diameter',value:s.diameter?`${fmt(s.diameter)} km`:'Not reported in this snapshot'},
      {label:'Display model',value:'Two-body position at each record epoch in the ecliptic frame; radial distances compressed. Surface, size and comet tail illustrative.'}],
  })),
];
export const LOCAL_OBJECT_INDEX=new Map(LOCAL_OBJECTS.map(o=>[o.id,o]));
export const LOCAL_OBJECT_DESTINATIONS:ExploreDestination[]=LOCAL_OBJECTS.map(o=> {
  const delta=o.kind==='satellite' ? o.position.map((v,i)=>v-earth[i]) : [0,3,12];
  const length=Math.hypot(...delta), scale=o.kind==='satellite'?12/length:1;
  return {id:`visit-${o.id}`,bodyId:o.id,label:o.name,category:o.kind==='satellite'?'Satellites':o.kind==='comet'?'Comets':'Asteroids',environment:'solar',
    spawn:o.position.map((v,i)=>v+delta[i]*scale) as [number,number,number],yaw:0,
    briefing:`${o.kind==='satellite'&&o.name.startsWith('STARLINK')?'Starlink TLE snapshot':o.source} · epoch ${o.epoch} · illustrated snapshot`};
});
export function localObjectScience(id:string):BodyScience|null {
  const o=LOCAL_OBJECT_INDEX.get(id);if(!o)return null;
  return {id,name:o.name,kind:o.kind,gravityMps2:null,escapeKmS:null,dayHours:null,meanTempC:null,source:o.source,sourceUrl:o.sourceUrl,realCatalog:true,snapshot:snapshot.retrievedAt.slice(0,10),facts:o.facts,
    blurb:o.kind==='satellite'?'Explore a cataloged spacecraft around Earth. This is a frozen illustration at its element epoch, not its position now. ISS and satellite geometry is schematic. The Starlink selection is a bounded snapshot sample, not the full current constellation.':o.kind==='comet'?'A cataloged comet on an elongated orbit. The tail points away from the Sun in this illustration; its brightness and extent are artistic, not an activity forecast.':'A cataloged small body. Its orbital elements and available diameter come from NASA/JPL; the visible rocky surface is an oversized illustration.'};
}
export function objectOrbit(o:LocalObject):[number,number,number][] {
  return Array.from({length:129},(_,i)=> {
    const elements={...o.elements,ma:i/128*360};
    if(o.kind!=='satellite')return smallPosition(elements);
    const p=orbitalPosition(elements),r=Math.hypot(...p),display=3.2+Math.max(.05,(r-6371)/6371*3.2)*5;
    return p.map((v,j)=>earth[j]+v/r*display) as [number,number,number];
  });
}
