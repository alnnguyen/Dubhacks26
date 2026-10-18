#!/usr/bin/env python3
"""Import a dated SpaceX snapshot for exploration: docked Dragons, TESS, heliocentric
spacecraft (Tesla Roadster, Europa Clipper, Psyche, Hera) and Launch Library 2 fleet records.

Run from the repository root:  python3 web/scripts/import-spacex.py
Needs network access. Every successful response is cached in web/scripts/.catalog-cache/spacex/
so reruns don't hit providers again (CelesTrak updates every ~2 h; Launch Library's free tier
allows ~15 requests/hour). The shipped snapshot is only written when every source succeeds.
No API keys; nothing here is called at runtime.
"""
import hashlib
import json
import re
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CACHE = ROOT / '.catalog-cache' / 'spacex'
OUT = ROOT.parent / 'src' / 'ui' / 'components' / 'explore' / 'data' / 'spacex.json'
AU_KM = 149597870.7
TODAY = datetime.now(timezone.utc).date()
LL2 = 'https://ll.thespacedevs.com/2.2.0'
LL2_DEV = 'https://lldev.thespacedevs.com/2.2.0'
sources = []


def fetch(url, name, fallback=None):
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / f'{name}.json'
    if path.exists():
        body = path.read_bytes()
        cached = json.loads(path.with_suffix('.meta').read_text())
        sources.append(cached)
        return json.loads(body)
    used = url
    try:
        body = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'korbit-hackathon-importer'}), timeout=40).read()
    except Exception as error:  # rate limit or outage: try the stated fallback once
        if not fallback:
            raise
        print(f'  {name}: {error} -> trying fallback {fallback}', file=sys.stderr)
        used = fallback
        body = urllib.request.urlopen(urllib.request.Request(fallback, headers={'User-Agent': 'korbit-hackathon-importer'}), timeout=40).read()
    meta = {'name': name, 'url': used, 'sha256': hashlib.sha256(body).hexdigest(), 'retrievedAt': datetime.now(timezone.utc).isoformat()}
    path.write_bytes(body)
    path.with_suffix('.meta').write_text(json.dumps(meta))
    sources.append(meta)
    return json.loads(body)


def gp(norad):
    return fetch(f'https://celestrak.org/NORAD/elements/gp.php?CATNR={norad}&FORMAT=JSON', f'gp-{norad}')[0]


def horizons_elements(command, name):
    """Osculating heliocentric ecliptic elements at today's date (Sun-centered, ICRF/ecliptic J2000)."""
    params = {
        'format': 'json', 'COMMAND': f"'{command}'", 'OBJ_DATA': "'YES'", 'MAKE_EPHEM': "'YES'", 'EPHEM_TYPE': "'ELEMENTS'",
        'CENTER': "'500@10'", 'START_TIME': f"'{TODAY}'", 'STOP_TIME': f"'{TODAY.replace(day=min(TODAY.day + 1, 28))}'", 'STEP_SIZE': "'1d'",
    }
    result = fetch('https://ssd.jpl.nasa.gov/api/horizons.api?' + urllib.parse.urlencode(params), f'horizons-{name}')['result']
    block = re.search(r'\$\$SOE(.*?)\$\$EOE', result, re.S).group(1)
    first = block.strip().split('\n\n')[0] if '\n\n' in block.strip() else block
    value = lambda key: float(re.search(rf'\b{key}\s*=\s*([-+0-9.E]+)', first).group(1))
    epoch = float(re.search(r'([0-9]+\.[0-9]+)\s*=\s*A\.D\.', first).group(1))
    header = re.search(r'Revised:.*?\n(.*?)\*{10}', result, re.S)
    return {
        'epochJD': epoch, 'a': value('A') / AU_KM, 'e': value('EC'), 'i': value('IN'), 'om': value('OM'), 'w': value('W'),
        'ma': value('MA'), 'perihelionAu': value('QR') / AU_KM, 'periodDays': value('PR') / 86400,
        'horizonsNote': ' '.join(header.group(1).split())[:600] if header else '',
    }


def main():
    print('CelesTrak orbital elements...')
    dragons = [gp(100882), gp(101031)]
    tess = gp(43435)
    satcat = {r['NORAD_CAT_ID']: r for r in fetch('https://celestrak.org/satcat/records.php?NAME=DRAGON&FORMAT=JSON', 'satcat-dragon')
              + fetch('https://celestrak.org/satcat/records.php?CATNR=43435&FORMAT=JSON', 'satcat-43435')}
    for record in dragons + [tess]:
        record['LAUNCH_DATE'] = satcat.get(record['NORAD_CAT_ID'], {}).get('LAUNCH_DATE')
    iss = gp(25544)
    docked = [d['NORAD_CAT_ID'] for d in dragons if abs(d['MEAN_MOTION'] - iss['MEAN_MOTION']) < 1e-3 and abs(d['INCLINATION'] - iss['INCLINATION']) < .05]

    print('JPL Horizons heliocentric spacecraft...')
    heliocentric = []
    for spk, ident, name, vehicle, launch, operator in [
        ('-143205', 'roadster', "Tesla Roadster ('Starman')", 'Falcon Heavy', '2018-02-06', 'SpaceX'),
        ('-159', 'europa-clipper', 'Europa Clipper', 'Falcon Heavy', '2024-10-14', 'NASA'),
        ('-255', 'psyche', 'Psyche', 'Falcon Heavy', '2023-10-13', 'NASA'),
        ('-91', 'hera', 'Hera', 'Falcon 9', '2024-10-07', 'ESA'),
    ]:
        heliocentric.append({'id': f'sx-{ident}', 'spkid': spk, 'name': name, 'launchVehicle': vehicle, 'launchDate': launch, 'operator': operator,
                             **horizons_elements(spk, ident)})

    print('Launch Library 2 fleet records (rate-limited; cached after first success)...')
    def ll2(path, name):
        return fetch(f'{LL2}{path}', f'll2-{name}', fallback=f'{LL2_DEV}{path}')
    configs = ll2('/config/launcher/?manufacturer__name=SpaceX&mode=detailed&limit=30', 'configs')['results']
    boosters = ll2('/launcher/?launcher_config__manufacturer__name=SpaceX&ordering=-flights&limit=20&mode=detailed', 'boosters')['results']
    capsules = ll2('/spacecraft/?search=dragon&limit=60&mode=detailed', 'capsules')['results']
    starship = ll2('/launch/?search=starship&limit=60&mode=list&ordering=net', 'starship')['results']
    nro = ll2('/launch/?search=NROL&lsp__name=SpaceX&limit=60&mode=list&ordering=net', 'nro')['results']

    pick = lambda d, *keys: {k: d.get(k) for k in keys}
    snapshot = {
        'retrievedAt': datetime.now(timezone.utc).isoformat(),
        'note': 'Dated snapshot. Orbits are osculating/mean elements at each epoch, not live tracking. Launch Library 2 records are as of retrieval. Starshield payload orbits are not public; only launch records are included.',
        'sources': sources,
        'dockedAtIss': docked,
        'earthOrbit': [{'role': 'dragon', **d} for d in dragons] + [{'role': 'falcon-payload', 'launchVehicle': 'Falcon 9', 'operator': 'NASA', **tess}],
        'heliocentric': heliocentric,
        'vehicles': [{
            **pick(c, 'id', 'name', 'full_name', 'variant', 'reusable', 'maiden_flight', 'total_launch_count', 'successful_launches', 'failed_launches',
                   'pending_launches', 'attempted_landings', 'successful_landings', 'failed_landings', 'leo_capacity', 'gto_capacity', 'length', 'diameter', 'to_thrust'),
            'active': c.get('active'),
        } for c in configs],
        'boosters': [{
            **pick(b, 'serial_number', 'flights', 'status', 'first_launch_date', 'last_launch_date', 'successful_landings', 'attempted_landings', 'flight_proven'),
            'vehicle': (b.get('launcher_config') or {}).get('full_name'),
        } for b in boosters if (b.get('launcher_config') or {}).get('manufacturer', {}).get('name', 'SpaceX') in ('SpaceX', None)],
        'capsules': [{
            'name': s.get('name'), 'serial': s.get('serial_number'), 'status': (s.get('status') or {}).get('name'),
            'flights': s.get('flights_count'), 'timeInSpace': s.get('time_in_space'), 'type': (s.get('spacecraft_config') or {}).get('name'),
        } for s in capsules],
        'starshipFlights': [{'name': l.get('name'), 'net': l.get('net'), 'status': (l.get('status') or {}).get('abbrev'), 'statusName': (l.get('status') or {}).get('name')} for l in starship],
        'nroLaunches': [{'name': l.get('name'), 'net': l.get('net'), 'status': (l.get('status') or {}).get('abbrev')} for l in nro],
    }
    OUT.write_text(json.dumps(snapshot, indent=1))
    print(f'Wrote {OUT.relative_to(ROOT.parent.parent)}: {len(snapshot["vehicles"])} vehicles, {len(snapshot["boosters"])} boosters, '
          f'{len(snapshot["capsules"])} capsules, {len(starship)} Starship launches, {len(nro)} NRO launches, docked={docked}')


if __name__ == '__main__':
    main()
