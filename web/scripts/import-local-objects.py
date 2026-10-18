#!/usr/bin/env python3
"""Fetch bounded public catalog snapshots. Run from any directory; no runtime API keys."""
import datetime, hashlib, json, pathlib, urllib.parse, urllib.request, time
OUT=pathlib.Path(__file__).resolve().parents[1]/'src/ui/components/explore/data'
sources=[]
CACHE=pathlib.Path(__file__).resolve().parent/'.catalog-cache'
CACHE.mkdir(exist_ok=True)
def get(url):
    cache=CACHE/(hashlib.sha256(url.encode()).hexdigest()+'.json')
    if cache.exists() and time.time()-cache.stat().st_mtime<7200:
        raw=cache.read_bytes()
    else:
        with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'LocalSpaceExplorer/1.0'}),timeout=60) as response:
            raw=response.read()
        json.loads(raw)
        cache.write_bytes(raw)
    sources.append({'url':url,'sha256':hashlib.sha256(raw).hexdigest(),'retrievedAt':datetime.datetime.fromtimestamp(cache.stat().st_mtime,datetime.timezone.utc).isoformat()})
    return json.loads(raw)
def gp(**params):
    return get('https://celestrak.org/NORAD/elements/gp.php?'+urllib.parse.urlencode({**params,'FORMAT':'JSON'}))
def query(kind,limit):
    data=get('https://ssd-api.jpl.nasa.gov/sbdb_query.api?'+urllib.parse.urlencode({'fields':'spkid,full_name,pdes,a,e,i,om,w,ma,epoch,diameter,per','sb-kind':kind,'sb-ns':'n','sort':'spkid','limit':limit,'full-prec':'true'}))
    rows=[]
    for row in data['data']:
        r=dict(zip(data['fields'],row))
        for field in ['a','e','i','om','w','ma','epoch','diameter','per']:
            r[field]=float(r[field]) if r[field] is not None else None
        if r['a'] and r['a']>0 and 0<=r['e']<1:
            r['spkid']=str(r['spkid'])
            r['pdes']=str(r['pdes'])
            r.update(id='sb-'+r['spkid'],kind='asteroid' if kind=='a' else 'comet',name=r['full_name'].strip())
            rows.append(r)
    return rows
if __name__=='__main__':
    satellites=[]
    for catnr in [25544,20580]:
        satellites.extend(gp(CATNR=catnr))
    mirror=get('https://tle.ivanstanojevic.me/api/tle/?search=STARLINK&page_size=48')
    starlink=[]
    for row in mirror['member']:
        l1,l2=row['line1'],row['line2']
        yy=int(l1[18:20]); year=(2000 if yy<57 else 1900)+yy
        epoch=datetime.datetime(year,1,1,tzinfo=datetime.timezone.utc)+datetime.timedelta(days=float(l1[20:32])-1)
        starlink.append({'OBJECT_NAME':row['name'],'NORAD_CAT_ID':row['satelliteId'],'EPOCH':epoch.isoformat(),'MEAN_MOTION':float(l2[52:63]),'ECCENTRICITY':float('0.'+l2[26:33]),'INCLINATION':float(l2[8:16]),'RA_OF_ASC_NODE':float(l2[17:25]),'ARG_OF_PERICENTER':float(l2[34:42]),'MEAN_ANOMALY':float(l2[43:51])})
    cutoff=datetime.datetime.now(datetime.timezone.utc)-datetime.timedelta(days=30)
    sample=[r for r in starlink if datetime.datetime.fromisoformat(r['EPOCH'])>=cutoff]
    satellites+=sample
    small=query('a',40)+query('c',16)
    for designation in ['1P','2P','67P','101955','162173']:
        data=get('https://ssd-api.jpl.nasa.gov/sbdb.api?'+urllib.parse.urlencode({'sstr':designation,'phys-par':'1'}))
        values={r['name']:float(r['value']) for r in data['orbit']['elements'] if r.get('value') is not None}
        diameter=next((float(r['value']) for r in data.get('phys_par',[]) if r['name']=='diameter'),None)
        obj=data['object']
        row={**{k:values[k] for k in ['a','e','i','om','w','ma']},'spkid':str(obj['spkid']),'full_name':obj['fullname'],'name':obj['fullname'],'pdes':obj['des'],'epoch':float(data['orbit']['epoch']),'diameter':diameter,'per':values.get('per'),'id':'sb-'+str(obj['spkid']),'kind':'comet' if designation.endswith('P') else 'asteroid'}
        if not any(r['id']==row['id'] for r in small):small.append(row)
    payload={'retrievedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sources':sources,'starlinkAvailable':mirror.get('totalItems',len(starlink)),'satellites':satellites,'smallBodies':small,'note':'Bounded catalog snapshots. Mean-element Kepler illustrations at each record epoch; not live tracking or precise ephemerides. Artificial satellite altitude exaggerated in scene.'}
    output=OUT/'local-objects.json'
    output.write_text(json.dumps(payload,indent=2)+'\n')
    print(json.dumps({'satellites':len(satellites),'starlinkSample':len(sample),'starlinkAvailable':mirror.get('totalItems',len(starlink)),'smallBodies':len(small),'file':str(output)},indent=2))
