#!/usr/bin/env python3
"""Validate committed snapshot bytes independently of the frontend bundle."""
import hashlib,json,math
from pathlib import Path
root=Path(__file__).resolve().parents[1]/'src/ui/components/explore/data'
manifest=json.loads((root/'manifest.json').read_text())
for source,name in zip(manifest['sources'],['stars.json','exoplanets.json','galaxies.json']):
    raw=(root/name).read_bytes(); rows=json.loads(raw)
    assert hashlib.sha256(raw).hexdigest()==source['outputSha256'],name+' digest mismatch'
    assert len(rows)==source['count'] and len({r['id'] for r in rows})==len(rows),name+' count/ID mismatch'
    for row in rows:
        assert math.isfinite(row['ra']) and 0<=row['ra']<360
        assert math.isfinite(row['dec']) and -90<=row['dec']<=90
        distance=row.get('distancePc',row.get('distanceMpc'))
        assert math.isfinite(distance) and distance>0
    print(name,len(rows),'records; SHA-256 and coordinates verified')
planets=json.loads((root/'exoplanets.json').read_text())
assert len({p['host'] for p in planets})==manifest['hostCount']
print('Exoplanet host count verified:',manifest['hostCount'])
