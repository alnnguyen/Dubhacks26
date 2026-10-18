# KO.rbit: real space datasets and APIs (DubHacks 26)

_Compiled Sat Oct 17, 2026, about 2:55 PM PT. Every URL below was checked live from the box with curl or WebFetch (HTTP 200 unless noted). CORS = whether a phone browser can call it directly; "no" means proxy it through `apps/server`._

**How these were found:** the Parallel plugin was **not usable**. `parallel-cli` wasn't installed. I installed v0.9.3 into a venv at `/tmp/pvenv`, but `parallel-cli auth --json` returned `authenticated: false`: no `PARALLEL_API_KEY` env var and no stored login. To enable it, run `parallel-cli login` or set `PARALLEL_API_KEY`. The research fell back to WebSearch, WebFetch, and direct curl checks. The raw source list is in `datasets-sources.json`. It is **not** Parallel output.

---

## ⭐ Top 5 for the ~18-hour build

| # | Dataset | Game use | Effort |
|---|---|---|---|
| 1 | **NASA Planetary Fact Sheet** | The wheel's numbers: gravity drives the rock hang time and block window, and the briefing card shows escape velocity, day length, and temperature. Bake it into `worlds.json`. | S |
| 2 | **Solar System Scope textures + NASA SVS Deep Star Map + CGI Moon Kit** | Real equirectangular planet maps and a real sky for the cockpit windshield and the 5-second world intro. | S |
| 3 | **JPL Horizons API** | The windshield shows Mars, the Moon, and others in their **real directions from UW right now**. Fetch az/el server-side once per hour and place sprites on the skybox. | M |
| 4 | **NOAA SWPC Planetary K-index** | A live "space weather" chip in the lobby. Kp ≥ 5 means "geomagnetic storm: blaster bolts flicker / shields +10%". Free, no key, CORS-open. | S |
| 5 | **JPL SBDB Close-Approach (CAD) API** | "Today's rock is real." The thrown rock is named after an asteroid passing Earth this month and sized from its magnitude (e.g., "2026 TS, ~10 m, passes Oct 18"). | S–M |

These give a visible real-data story in each phase: the **wheel** (Fact Sheet), the **windshield** (Horizons + star map), the **lobby** (Kp), and the **duel** (CAD asteroid rock).

---

## 1. Planetary physical constants

| Name | URL | Format | License | Auth / limits | Freshness | Size | Game use | Effort |
|---|---|---|---|---|---|---|---|---|
| ⭐ NASA Planetary Fact Sheet (metric) | https://nssdc.gsfc.nasa.gov/planetary/factsheet/ · Mars https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html · Moon https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html | HTML tables (copy by hand into JSON) | US Gov public domain; credit "NASA NSSDCA" | None | Static reference | <50 KB | Verified values: gravity **Earth 9.8 / Moon 1.6 / Mars 3.7 m/s²**; escape velocity Earth 11.2 / Moon 2.4 km/s; day Earth 24.0 h / Moon 708.7 h; mean temp Earth 15 °C / Moon −20 °C (Mars about 3.7 m/s², 5.0 km/s, 24.7 h, −65 °C, 0.01 bar from the same table). Feeds `rockFlightTimeMs` and the briefing card. | S |
| NASA Fact Sheet ratio-to-Earth table | https://nssdc.gsfc.nasa.gov/planetary/factsheet/planet_table_ratio.html | HTML | Public domain | None | Static | small | Direct "0.38× Earth gravity" strings for the voice coach and UI. | S |
| JPL Planetary Physical Parameters | https://ssd.jpl.nasa.gov/planets/phys_par.html | HTML table | Public domain (JPL/Caltech credit) | None | Static | small | A second authoritative source for judges ("JPL says g = 3.71"). Optional cross-check. | S |

## 2. Imagery and textures (world backdrops, windshield, intro)

| Name | URL | Format | License | Auth / limits | Freshness | Size | Game use | Effort |
|---|---|---|---|---|---|---|---|---|
| ⭐ Solar System Scope textures | https://www.solarsystemscope.com/textures/ | JPG equirectangular, 2K/8K (Earth day/night/clouds, Moon, Mars, "Stars + Milky Way") | CC BY 4.0 per their site, so attribution is required (confirm on the page footer) | None | Static | 2K is about 0.5–2 MB each | The fastest route to a spinning-planet wheel and a skybox. Use 2K on phones. Based on NASA data. | S |
| ⭐ NASA SVS Deep Star Maps 2020 | https://svs.gsfc.nasa.gov/4851 | EXR 4k–64k plus a JPG preview (`starmap_2020_4k_print.jpg`) | NASA public domain; credit NASA/Goddard SVS | None | 2020 (Gaia DR2 + Hipparcos/Tycho) | 4k EXR is several MB | A **real** star sky around the cockpit windshield (celestial coordinates, so it lines up with Horizons directions). Convert the 4k EXR to JPG. | S |
| ⭐ NASA SVS CGI Moon Kit | https://svs.gsfc.nasa.gov/4720 | `lroc_color_2k.jpg`, TIFF up to 16k, plus displacement (LOLA) | NASA public domain | None | Static (LRO) | 2k JPG is small | A photoreal Moon for the wheel and the Moon-arena intro. | S |
| NASA Visible Earth: Blue Marble | https://visibleearth.nasa.gov/collection/1484/blue-marble | JPG/PNG/TIFF, up to 21600×10800 | NASA public domain | None | Static | 1–100+ MB | Earth texture and the Earth-world intro. | S |
| USGS Mars Viking Global Color Mosaic (925 m) | https://astrogeology.usgs.gov/search/map/mars_viking_global_color_mosaic_925m | GeoTIFF | Public domain (USGS/NASA) | None | Static | about 2.5 GB full; use a downsample | Scientifically sourced Mars color. Overkill for the MVP; use Solar System Scope instead. | M |
| USGS LRO LROC WAC Global Mosaic (100 m) | https://astrogeology.usgs.gov/search/map/moon_lro_lroc_wac_global_morphology_mosaic_100m | GeoTIFF | Public domain | None | Static | GBs | Grayscale lunar terrain. Stretch goal only. | M |
| NASA Solar System Treks (Moon/Mars Trek) | https://trek.nasa.gov/ · https://trek.nasa.gov/mars/ · https://trek.nasa.gov/moon/ | Web map tiles (WMTS) | NASA public domain | None | Static | Tiles on demand | A zoomable real-surface "landing zone" image behind the wheel result ("Arena: Jezero Crater"). | M |
| HYG star catalog v4.4 | https://codeberg.org/astronexus/hyg (the GitHub copy is archived) · https://www.astronexus.com/projects/hyg | CSV.gz, 119,614 stars | **CC BY-SA 4.0** (share-alike) | None | Updated 2026-07-12 | about 15 MB gz; filter to mag < 6 (~9k stars) | Render real named stars as points in Three.js, with tappable labels like "Betelgeuse". The alternative to the star-map image. | M |
| NASA Image and Video Library API | https://images-api.nasa.gov/search?q=mars%20dust%20storm · docs https://images.nasa.gov/docs/images.nasa.gov_api_docs.pdf | JSON + JPG/MP4 | Mostly public domain; check each item | No key; CORS-open | Live archive | n/a | Real mission photos on the result/debrief screen or the loading card. | S |
| ESA Gaia Archive | https://gea.esac.esa.int/archive/ | ADQL/TAP → CSV/VOTable | ESA/Gaia/DPAC, CC BY-SA 3.0 IGO | Free; queries are slow | DR3 | Huge | **Skip for the MVP.** HYG or the SVS star map already include Gaia-derived data. | L |

## 3. Live data (freshness in the lobby)

| Name | URL | Format | License | Auth / limits | Freshness | Size | Game use | Effort |
|---|---|---|---|---|---|---|---|---|
| ⭐ JPL Horizons API | https://ssd-api.jpl.nasa.gov/doc/horizons.html · endpoint `https://ssd.jpl.nasa.gov/api/horizons.api` | JSON wrapper with a text ephemeris inside | Public domain (JPL credit) | No key. **No CORS header, so call it from the server.** Be polite with request volume. | Real-time ephemeris | ~2 KB per request | Tested: `COMMAND='499'` (Mars), `CENTER='coord@399'`, `SITE_COORD='-122.3035,47.6553,0.05'` (UW), `QUANTITIES='4'`, which gives az/el. Mars at 2026-Oct-18 18:00 UT returned az 242.55° / el 46.18°. Do Moon (301), Mars (499), Jupiter (599), Venus (299) once an hour and cache. Combined with gyro heading, the windshield shows real planet directions. | M |
| ⭐ NOAA SWPC Planetary K-index | https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json (also 1-min: https://services.swpc.noaa.gov/json/planetary_k_index_1m.json) · info https://www.swpc.noaa.gov/products/planetary-k-index | JSON array of `{time_tag, Kp, a_running, station_count}` (last element = latest) | US Gov public domain; credit NOAA SWPC | No key, `Access-Control-Allow-Origin: *` | 3-hour (1-minute version also available) | ~10 KB | Lobby chip "Space weather Kp 3.0, calm". Kp ≥ 5 triggers a storm modifier and an aurora tint on the windshield. Fetch once per lobby load. | S |
| CelesTrak GP: stations (ISS) | https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=json · docs https://celestrak.org/NORAD/documentation/gp-data-formats.php · policy https://celestrak.org/usage-policy.php | OMM JSON / TLE | Free; credit CelesTrak | No key, CORS `*`. **Max one download per 2 h per group; non-200 responses lead to an IP block.** | Every 2 h | stations ~30 KB; **starlink 4.7 MB** (too big for phones) | Server caches it for 2 h and computes passes with `satellite.js`. Shows "ISS rises over UW in 14 min" in the cockpit and gives the voice coach a line. | M |
| Where the ISS At API | https://api.wheretheiss.at/v1/satellites/25544 | JSON (lat/lon/alt/velocity) | Free | No key, CORS `*`, about 1 req/s | Live | <1 KB | The simplest live ISS marker. A no-math alternative to CelesTrak. (Open-Notify `api.open-notify.org` **timed out**, so avoid it.) | S |
| ⭐ JPL SBDB Close-Approach Data (CAD) | https://ssd-api.jpl.nasa.gov/doc/cad.html · e.g. `https://ssd-api.jpl.nasa.gov/cad.api?dist-max=0.05&date-min=now&date-max=%2B30&diameter=true` | JSON (`des`, `cd` date, `dist` au, `v_rel` km/s, `h` magnitude, `diameter` often null) | Public domain | No key, **no CORS, so proxy it** | Daily | ~5 KB | Tested: 32 objects within 0.05 au in the next 30 days, e.g. **2026 TS** on 2026-Oct-18 06:16 UT at 0.006 au and 10.3 km/s. Name the rock after one, scale its size, and scale damage by `v_rel`. | S–M |
| NASA NeoWs (Asteroids feed) | `https://api.nasa.gov/neo/rest/v1/feed?start_date=…&end_date=…&api_key=…` · portal https://api.nasa.gov/ | JSON with **estimated diameter min/max in meters** and a hazardous flag | Public domain | api.data.gov key. **DEMO_KEY: docs say 30/hr, 50/day per IP; the live header showed `X-RateLimit-Limit: 10`.** Get a free key. CORS `*` | Daily | ~50 KB | The same as CAD but with diameters already computed. "Potentially hazardous" rocks deal crit damage. | S |
| NASA DONKI (solar flares, CMEs) | https://ccmc.gsfc.nasa.gov/tools/DONKI/ · via `https://api.nasa.gov/DONKI/FLR?startDate=…&api_key=…` | JSON | Public domain | api.data.gov key. **Returned 503 on both tries today, so it's flaky.** | Event-driven | small | "X-class flare 2 days ago" flavor text. Low priority; Kp covers the same idea more reliably. | S |

## 4. Environment effects

| Name | URL | Format | License | Auth / limits | Freshness | Size | Game use | Effort |
|---|---|---|---|---|---|---|---|---|
| Curiosity REMS weather (Gale Crater) | https://mars.nasa.gov/rss/api/?feed=weather&category=msl&feedtype=json · page https://mars.nasa.gov/msl/weather/ | JSON (`soles[]`: min/max temp °C, pressure Pa, `atmo_opacity`, `ls`) | Outreach data from CAB/NASA; credit "NASA/JPL-Caltech/CAB"; outreach use only | No key | **Lagging: the newest sol is 4995 on 2026-08-25** (about 7 weeks old) | ~1 MB for the full history | Mars arena HUD: "Gale Crater: −71 °C to −5 °C, 777 Pa", plus a frost tint. If `atmo_opacity` isn't "Sunny", add a dust overlay. Bundle a snapshot at build time; don't fetch live. | S |
| Perseverance MEDA weather | page https://mars.nasa.gov/mars2020/weather/ · feed `…?feed=weather&category=mars2020&feedtype=json` · PDS https://pds-atmospheres.nmsu.edu/data_and_services/atmospheres_data/PERSEVERANCE/meda.html | JSON / PDS tables | Public domain | None | **The outreach feed is stale (2024, values "--").** PDS releases come in batches. | varies | **Not recommended for live use.** Cite MEDA dust-devil and wind facts in the voice script only. | M |
| Mars Climate Database (LMD/ESA) | https://www-mars.lmd.jussieu.fr/ | Web query / NetCDF | Free for research; registration required for the full data | Web UI | Model climatology | n/a | Modeled dust opacity and wind by season for a scientifically backed "dust storm" intensity. Stretch goal. | L |
| LRO Diviner lunar temperatures | https://www.diviner.ucla.edu/ | Maps / PDS | Public domain | None | Static | varies | Moon briefing: "Surface: about +120 °C in sunlight, about −170 °C at night". Use the published figures as constants and tint the camera blue-white. | S |
| ~~NASA InSight Mars Weather API~~ | `https://api.nasa.gov/insight_weather/` | JSON | – | – | **Dead: newest sol 675 = Oct 2020** (mission ended in 2022) | – | **Don't use.** It still returns 200 with 2020 data, which is easy to mistake for live. | – |

## 5. Creative gameplay hooks

| Idea | Data | Effort |
|---|---|---|
| **The rock is a real asteroid.** Diameter ≈ 1329 km / √albedo × 10^(−H/5); with albedo 0.14, H = 24 gives about 56 m. Map that to a rock scale of 0.5–1.5×. | CAD `h` or NeoWs `estimated_diameter` | S |
| **Asteroid speed sets damage.** `v_rel` 5–30 km/s maps linearly to 15–30 rock damage. The voice line: "This one's doing 10 km/s." | CAD | S |
| **Escape velocity sets blaster bolt speed.** Low-escape worlds get faster bolts. Pure flavor from the same Fact Sheet row. | Fact Sheet | S |
| **Day length sets arena lighting.** The Moon (708.7 h day) is locked to a harsh terminator; Earth uses the real UW sun position. | Fact Sheet + `suncalc` npm | S |
| **Live sky event as a bonus.** If the ISS or the Moon is above the horizon over UW during the match, the "orbital assist" special unlocks. | CelesTrak/Horizons | M |
| **Specific asteroid facts.** e.g. `https://ssd-api.jpl.nasa.gov/sbdb.api?sstr=433` (Eros: diameter, rotation period) gives a debrief like "you threw a chunk of Eros". | JPL SBDB API (https://ssd-api.jpl.nasa.gov/doc/sbdb.html) | S |
| **Real 3D models of probes/rovers floating outside the windshield.** | https://science.nasa.gov/3d-resources/ · https://github.com/nasa/NASA-3D-Resources (GLB/OBJ, NASA media guidelines) | S–M |

---

## Pitfalls (read before coding)

1. **InSight weather is dead.** The API still answers, but with Oct 2020 data. Don't present it as live.
2. **CelesTrak blocks repeat downloads.** Fetch each group at most once every 2 h, server-side, cached to disk. Stop on any non-200 response (301/403/404/50x); more than 1,000 errors a day puts your IP in the firewall. Always use `celestrak.org`, never `.com` (that returns a 301). Don't pull `GROUP=starlink` (4.7 MB) to phones.
3. **NASA DEMO_KEY** is documented at 30 req/hr and 50/day per IP, and the live NeoWs header reported a limit of **10**. Hackathon Wi-Fi shares one IP, so register a free key at https://api.nasa.gov/ and keep it in server env.
4. **JPL APIs (Horizons, CAD, SBDB) send no CORS header.** Phones can't call them directly; proxy them through `apps/server`.
5. **APOD changes:** the legacy APOD API is archived Dec 1, 2026, and NASA's Mars Rover Photos and Earth APIs are already archived (per api.nasa.gov). Don't build on them.
6. **DONKI returned 503 today.** Treat it as optional with a cached fallback.
7. **The MSL weather feed lags about 7 weeks.** Label it "latest reported sol", not "today".
8. **License hygiene:** NASA/USGS/NOAA/JPL data is public domain (credit anyway; no NASA logo implying endorsement). Solar System Scope is CC BY 4.0, so add an attribution line. HYG is CC BY-SA 4.0, so credit it and share-alike any derived star file. Put a "Data sources" credits panel in the app; judges like it.
9. **Phone budget:** ship 2K textures (not 8K+) and stars filtered to mag < 6. The camera, MediaPipe, and Three.js already share the GPU.
10. **Demo resilience:** snapshot every live feed into `worlds.json` / `live-cache.json` at build time and fall back silently if the Wi-Fi dies, with the cached timestamp shown.

## Suggested wiring (owner)
- **B (server):** `/api/sky` (Horizons, 1 h cache), `/api/rock` (CAD, 6 h cache), `/api/iss` (CelesTrak stations, 2 h cache), plus Fact Sheet values in `packages/physics/worlds.json`.
- **A (lobby):** skybox from the SVS star map, planet sprites from `/api/sky`, Kp chip fetched directly from NOAA.
- **C (AR):** rock scale and damage from `/api/rock`, per-world camera tint.
- **D (voice):** eve lines pulled from the Fact Sheet, Kp, and asteroid name/speed.
