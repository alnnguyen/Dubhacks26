# Local solar catalog expansion — October 18

## Goal, ownership and interface

User-authorized follow-up: complete the major planets and add spacecraft, Starlink, asteroids and comets with real catalog facts and navigable learning cards. Owned paths: exploration frontend, local data importer/snapshots and frontend documentation. Interface: three destination categories and three BodyScience kinds, resolved through existing frontend learn/visit callbacks and the persistent local navigation frame. No server, combat, sessions, shared dependencies/manifests, environment variables, deployment or external messages. Unrelated working changes preserved.

## Included scope

- All eight major planets: added Saturn, Uranus and Neptune. Saturn has illustrated bands and three ring annuli. Planet positions/radii remain the designed static layout; colors and Saturn's rings are procedural illustrations, not new NASA image assets.
- Earth's Moon remains the natural satellite in this bounded release; other planetary moons are not imported.
- 20 artificial satellites: ISS and Hubble GP elements from CelesTrak, plus 18 Starlink records from the first page of the community TLE API listed in NASA Open APIs. Two stale mirrored records were excluded by a 30-day freshness bound. This is a sample, not the current full Starlink fleet.
- 60 NASA/JPL SBDB small bodies: 42 asteroids and 18 comets. Includes Ceres, Vesta, Halley, Encke, 67P/Churyumov-Gerasimenko, Bennu and Ryugu. The main selection is the first 40 numbered asteroids and 16 numbered comets by SPK-ID plus five named records (one was already present).
- Search categories Satellites / Asteroids / Comets; highlight shortcuts; detailed source cards with epochs, orbital parameters, known diameter, altitude/period or perihelion/aphelion. Unknown diameter is shown as unknown.
- Batched selectable points, an oversized schematic ISS, a schematic spacecraft for a selected satellite, selected small-body mesh and display orbit, and an illustrative anti-solar comet tail. Only ISS and the selected extra object get name labels; extra labels fade with solar distance. Catalog objects hide at stellar scale.

## Data honesty

The spacecraft and small bodies are **frozen epoch illustrations**, not live positions. Elliptical Kepler conversion of the supplied mean/orbit elements is a two-body approximation, not SGP4 propagation, Horizons ephemerides, ground tracks or a collision prediction. NASA osculating element epochs vary by object and may be much older than the download date; cards show both. No attempt is made to advance everything to a common current epoch. Planet phases also remain authored, so apparent conjunctions have no real observational meaning.

Satellite axes use the catalog equatorial frame aligned to the illustrative Earth; Sun-centered small bodies use the ecliptic frame. Small-body radial distance uses a monotonic compression matching the authored planetary orbit distances. Satellite altitude above the scaled Earth is exaggerated ×5; craft sizes, small bodies and comet tails are exaggerated. No satellite operational-status or comet-activity inference is made. Satellite approaches arrive on the outward side of Earth so the target is not hidden behind Earth.

## Provenance and importer

Data file: `web/src/ui/components/explore/data/local-objects.json`. Each source response has its exact URL, retrieval time and SHA-256 in the file. Downloaded raw responses are cached in ignored `web/scripts/.catalog-cache/` for at least the two-hour CelesTrak update interval; failed imports preserve successful downloads and do not overwrite the shipped snapshot. There are no runtime network calls or API keys.

Regenerate with `python3 web/scripts/import-local-objects.py` from the repo root. Requires network access. Do not repeatedly refresh CelesTrak; its full Starlink group permits one download per update. An initial uncached importer failed after a full group download; the provider refused a repeat. The final importer uses the bounded community mirror for Starlink, and caches every successful response immediately. No full-group retries are built into the final importer.

Sources:
- NASA/JPL SBDB query: https://ssd-api.jpl.nasa.gov/doc/sbdb_query.html
- NASA/JPL named records: https://ssd-api.jpl.nasa.gov/doc/sbdb.html
- NASA major-planet facts: https://nssdc.gsfc.nasa.gov/planetary/factsheet/ and NASA Science planet pages linked in each card.
- CelesTrak GP: https://celestrak.org/NORAD/documentation/gp-data-formats.php
- Community TLE mirror: https://tle.ivanstanojevic.me/ / https://github.com/ivanstan/tle-api — listed at https://api.nasa.gov/ but independently operated, not a NASA-operated tracking service or official SpaceX integration.

## Changed files and checks

New localObjects data/types/Kepler conversion and tests; LocalObjectsScene and snapshot importer; local-objects.json. Extended bodies/bodiesScience/destinations, localNavigation, LocalBodyLabels, LocalUniverseScene, CatalogScene export, SolarSystem visuals and ExploreHud categories/credits. One existing approach regression now runs longer to account for approaching the expanded outer-planet layout.

Six new regressions cover all major planets, source identities/epochs/categories, ISS/Hubble/Starlink/named small bodies, Kepler perihelion/aphelion/rotation, monotonic radial compression/closed display orbits and safe continuous arrival. Final checks and browser evidence are recorded below.

## Final acceptance evidence

- Full frontend suite: **144 passed, 1 live-network test skipped**; targeted local navigation/catalog subset: 20 passed.
- TypeScript/production build passed. Existing Node 22.11/Vite supported-version warning and large catalog chunk warning remain; exploration data gzip is about 1.18 MB.
- All 10 source-response SHA-256 hashes matched the cached downloads. Existing star/exoplanet/galaxy integrity validator still passed.
- Browser: Saturn rings/name visible; ISS source card showed NORAD 25544, epoch, period and altitude and Visit arrived outside Earth with schematic panels/orbit and name; Halley search/card/visit showed its actual NASA epoch and a rendered tail/orbit; Starlink search returned 18 records and its card identified the community mirror, epoch and non-live status. Runtime warning/error logs were empty at ISS verification.
- Screenshots: `/private/tmp/solar-expansion-saturn.png`, `/private/tmp/solar-expansion-iss.png`.
- Phone frame rate, actual phone touch selection and deployed flow remain unverified. No deployment performed. No new environment variables.
