#!/usr/bin/env python3
"""Build offline exploration snapshots from downloaded public catalog files (stdlib only).
Usage: python3 web/scripts/import-universe.py --stars PATH --planets PATH --galaxies PATH
Network acquisition is deliberately separate; source URLs/query/hashes are recorded below.
"""
import argparse, csv, hashlib, json, math, re
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

HYG='https://raw.githubusercontent.com/astronexus/HYG-Database/main/hyg/CURRENT/hygdata_v41.csv'
EXO='https://exoplanetarchive.ipac.caltech.edu/TAP/sync'
GAL='https://ned.ipac.caltech.edu/level5/GALEX_Atlas/Gildepaz2.html'
QUERY='select pl_name,hostname,ra,dec,sy_dist,sy_disterr1,sy_disterr2,pl_rade,pl_radelim,pl_bmasse,pl_bmasselim,pl_bmassprov,pl_orbper,pl_orbsmax,pl_eqt,discoverymethod,disc_year,st_teff,st_rad from pscomppars where sy_dist > 0 and sy_dist < 1000 order by sy_dist,hostname,pl_name'
class Tables(HTMLParser):
    def __init__(self): super().__init__(); self.rows=[]; self.row=None; self.cell=None
    def handle_starttag(self, tag, attrs):
        if tag=='tr': self.row=[]
        if tag in ('td','th'): self.cell=[]
    def handle_data(self, text):
        if self.cell is not None: self.cell.append(text)
    def handle_endtag(self, tag):
        if tag in ('td','th') and self.cell is not None:
            if self.row is not None: self.row.append(' '.join(''.join(self.cell).split()))
            self.cell=None
        if tag=='tr' and self.row is not None: self.rows.append(self.row); self.row=None

def number(v):
    try:
        f=float(v)
        return f if math.isfinite(f) else None
    except (ValueError, TypeError): return None

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--stars',required=True); ap.add_argument('--planets',required=True); ap.add_argument('--galaxies',required=True); args=ap.parse_args()
    stars=[]
    for r in csv.DictReader(Path(args.stars).open()):
        d=number(r['dist']); ra=number(r['ra']); dec=number(r['dec']); mag=number(r['mag'])
        if d is None or not 0<d<100000 or ra is None or dec is None: continue
        if not (d<=100 or (r['proper'] and d<=3000)): continue
        stars.append(dict(id='hyg-'+r['id'],name=r['proper'] or ('HIP '+r['hip'] if r['hip'] else 'HYG '+r['id']),
          named=bool(r['proper']),ra=round(ra*15,8),dec=dec,distancePc=d,magnitude=mag,
          spectralType=r['spect'] or None,hip=r['hip'] or None))
    stars.sort(key=lambda r:(not r['named'],r['distancePc'],r['id']))
    planets=[]
    for r in json.loads(Path(args.planets).read_text()):
        if not r['pl_name'] or not r['hostname'] or not (number(r['sy_dist']) and number(r['ra']) is not None and number(r['dec']) is not None): continue
        planets.append(dict(id='exo-'+re.sub('[^a-z0-9]+','-',r['pl_name'].lower()).strip('-'),name=r['pl_name'],host=r['hostname'],
          ra=r['ra'],dec=r['dec'],distancePc=r['sy_dist'],distanceErrorPlusPc=r['sy_disterr1'],distanceErrorMinusPc=r['sy_disterr2'],
          radiusEarth=r['pl_rade'],radiusLimit=r['pl_radelim'],massEarth=r['pl_bmasse'],massLimit=r['pl_bmasselim'],massType=r['pl_bmassprov'],
          periodDays=r['pl_orbper'],orbitAu=r['pl_orbsmax'],equilibriumK=r['pl_eqt'],discovery=r['discoverymethod'],year=r['disc_year'],starTemperatureK=r['st_teff'],starRadiusSolar=r['st_rad']))
    table=Tables(); table.feed(Path(args.galaxies).read_text()); galaxies=[]
    aliases={'MESSIER 031':'Andromeda · M31','MESSIER 033':'Triangulum · M33','MESSIER 081':'Bode’s Galaxy · M81','MESSIER 082':'Cigar Galaxy · M82','MESSIER 087':'Virgo A · M87','MESSIER 051a':'Whirlpool · M51','MESSIER 101':'Pinwheel · M101','NGC 0224':'Andromeda · M31','NGC 0598':'Triangulum · M33','NGC 3031':'Bode’s Galaxy · M81','NGC 3034':'Cigar Galaxy · M82','NGC 5194':'Whirlpool · M51','NGC 4486':'Virgo A · M87','NGC 5457':'Pinwheel · M101','NGC 4594':'Sombrero · M104'}
    for r in table.rows:
        if len(r)!=13: continue
        try:
            h,m,s=map(float,r[1].split()); ds,dm,dsec=map(float,r[2].split()); dist=float(r[6]); ref=int(r[8])
            ra=(h+m/60+s/3600)*15
            dec=(-1 if r[2].startswith('-') else 1)*(abs(ds)+dm/60+dsec/3600)
        except ValueError: continue
        if not dist>0 or not 0<=ra<360 or not -90<=dec<=90: continue
        galaxies.append(dict(id='gal-'+re.sub('[^a-z0-9]+','-',r[0].lower()).strip('-'),name=r[0],alias=aliases.get(r[0]),ra=round(ra,8),dec=round(dec,8),
          distanceMpc=dist,distanceReference=ref,distanceMethod='Virgo-infall corrected velocity; H0=70 km/s/Mpc' if ref==1 else 'Literature distance; table reference '+str(ref),morphology=r[10] or None,majorArcmin=number(r[3]),minorArcmin=number(r[4])))
    assert len(stars)>20000 and len(planets)>1000 and len(galaxies)==1034, (len(stars),len(planets),len(galaxies))
    for records in (stars,planets,galaxies): assert len({r['id'] for r in records})==len(records),'Duplicate catalog IDs'
    out=Path(__file__).resolve().parents[1]/'src/ui/components/explore/data'
    out.mkdir(parents=True,exist_ok=True)
    retrieved=datetime.now(timezone.utc).isoformat()
    sources=[dict(id='hyg',title='HYG v4.1 · David Nash / Astronexus',url=HYG,documentation='https://github.com/astronexus/HYG-Database',license='CC BY-SA 4.0',selection='Positive distance <=100 pc, plus named stars <=3000 pc; excludes 100000 pc unknown-distance sentinel',path=args.stars),
      dict(id='exoplanets',title='NASA Exoplanet Archive · PSCompPars',url=EXO,documentation='https://exoplanetarchive.ipac.caltech.edu/docs/API_PS_columns.html',license='Archive acknowledgement required; publication references apply',selection=QUERY,path=args.planets),
      dict(id='galaxies',title='Gil de Paz et al. GALEX Atlas · NASA/IPAC NED',url=GAL,documentation=GAL,license='Published numerical table; cite Gil de Paz et al. and NED',selection='All 1034 Table 1 galaxies with positive published distances; archival atlas, not current NED-LVS',path=args.galaxies)]
    for src,records,filename in zip(sources,(stars,planets,galaxies),('stars.json','exoplanets.json','galaxies.json')):
        source_path=Path(src.pop('path')); raw=source_path.read_bytes(); src['inputSha256']=hashlib.sha256(raw).hexdigest(); src['retrievedAt']=datetime.fromtimestamp(source_path.stat().st_mtime,timezone.utc).isoformat();src['count']=len(records)
        content=json.dumps(records,separators=(',',':'),ensure_ascii=False,allow_nan=False)
        (out/filename).write_text(content+'\n');src['outputSha256']=hashlib.sha256((content+'\n').encode()).hexdigest()
    (out/'manifest.json').write_text(json.dumps(dict(schemaVersion=1,sources=sources,hostCount=len({r['host'] for r in planets})),indent=2)+'\n')
    print(json.dumps({src['id']:src['count'] for src in sources}));print('Unique exoplanet hosts:',len({r['host'] for r in planets}))
if __name__=='__main__': main()
