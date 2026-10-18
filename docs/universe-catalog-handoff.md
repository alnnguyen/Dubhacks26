# Real catalog exploration expansion

## Scope and ownership

The user explicitly requested importing real catalogs and expanding universe exploration beyond the prior game plan. This authorizes this exploration increment despite the earlier hackathon feature freeze; it does not authorize deployment or changes to the duel. Goal: search, visit, fly among and learn about real stars, exoplanets and galaxies using local snapshots. Owned paths: web/src/ui/components/explore/, ExploreApp.tsx / exploration CSS, web/scripts/ import/validation, frontend README and handoff/status docs. Interface: frontend destinations, catalog frames and learning-card metadata. No network contracts, provider integrations, camera/duel modules, shared manifests, dependencies or environment variables changed.

## Data actually imported

- HYG v4.1: **24,835 stars** with positive catalog distance within 100 pc, plus named stars within 3,000 pc. Excludes Sun and the 100,000 pc unknown-distance sentinel. HYG is an Astronexus compilation of astronomical surveys, not a NASA-produced catalog. Retains name/ID, RA, declination, source distance, spectral type and magnitude. Derived stars.json is CC BY-SA 4.0.
- NASA Exoplanet Archive PSCompPars: **5,301 planet records across 3,894 hosts**, known distance <1,000 pc. Retains uncertainties, limit flags and mass provenance; does not present M sin i as a true mass or equilibrium temperature as surface temperature. Missing data remain null. Archive composite parameters can combine different publications/estimates.
- Gil de Paz et al. GALEX Atlas, Table 1, hosted by NASA/IPAC NED: **1,034 galaxies** with coordinates, published distance, distance-reference code, morphology and angular axes. This archival selection is not current NED-LVS or a complete universe census. Velocity-derived distances explicitly identify the table's H0=70 km/s/Mpc method. Literature distance codes link to the original table footnotes.

Snapshots: web/src/ui/components/explore/data/{stars,exoplanets,galaxies}.json. Manifest preserves source URLs/query, input/output SHA-256, retrieval times and counts. See data/ATTRIBUTION.md for source credits, licensing and exact regeneration instructions. Numerical tables downloaded; no remote media, credentials or model-generated facts used.

## User journey

Destinations / N opens Highlights, Solar system, Stars, Exoplanets and Galaxies. Search matches names/IDs and descriptions, including source catalog names and familiar galaxy aliases. Results are capped at 50 visible rows while all records remain searchable. Category scope is stated; an empty scoped search offers Search all catalogs.

Try Sirius, Proxima, TRAPPIST-1 e or Andromeda. Visit uses the existing hyperspace transition, then arrives facing the object. Catalog objects are selectable through scene points/sprites or the navigation list. Learning cards show source properties, version/source links and caveats; a Visit action travels to that object. Exoplanet cards include sibling planets for switching learning cards and visiting another planet. Legacy deep-field links now open the real star atlas. Return to Earth resets safely to the original solar scene.

Stellar frame: equatorial axes (+X RA 0, +Y north, -Z RA 90), 10 scene units/pc. Hosts use their archive RA/Dec/distance in the same frame. Catalogs remain separately identified; no unverified cross-catalog deduplication is claimed.
Galaxy frame: same axis convention, 50 scene units/Mpc, with a solar-neighborhood origin marker. Catalog galaxy sizes/shapes are artistic glyphs. System frame: selected host at the origin with its known planets in an illustrative ordered layout. Sizes, spacing and orbital phases are exaggerated/authored; this is not ephemeris propagation. The original solar layout and decorative background are still authored/procedural.

Data are imported only through lazy-loaded exploration. Approximately 6 MB uncompressed catalog data produce a roughly 1.17 MB gzip exploration chunk; Vite reports the larger-chunk warning. This is a deliberate bounded local snapshot rather than per-frame provider access. Only the current system gets planet meshes; stars/hosts and galaxies use batched points. Labels use lightweight sprites, avoiding separate HTML React roots during scene transitions. Actual phone parsing/performance remains unmeasured.

## Validation and handoff

Verified commands and browser observations are appended after final checks. No deployment performed. No new environment variables. Actual two-phone performance/touch and full deployed bridge → duel lifecycle remain human acceptance checks. Earlier uncommitted changes in other owners' paths were preserved.

### Checks actually completed

- `python3 web/scripts/validate-universe.py`: all three snapshot SHA-256 hashes, counts, unique IDs, coordinate ranges, positive distances and host count verified.
- `npm --prefix web test`: 124 tests passed, 1 live-network test skipped. Seven added catalog checks cover snapshot counts/IDs, invalid-distance exclusion, coordinate units/cardinal directions, Sirius/TRAPPIST-1/Andromeda source records, scientific labels, metadata coverage and host layout. Existing flight tests now validate catalog destination arrivals too.
- `npm --prefix web run build`: TypeScript and production bundle pass. Exploration chunk is ~6.37 MB raw / ~1.17 MB gzip, with Vite's size warning.
- Browser: star/galaxy/system layers rendered; navigation search found sourced records; TRAPPIST-1 e displayed source parameters and seven sibling planets; switching to f changed the card; Andromeda visit showed MESSIER 031, archival 0.78 Mpc distance and literature-reference method; cross-layer travel to Sirius succeeded. Sirius cruise advanced z from -10.8 to -11.5 at 5 u/s rather than resetting. Renderer warning/error logs in the fresh test tab were empty after replacing HTML labels with sprites.
- No actual-phone FPS/touch or deployed multiplayer flow test was performed. No external deployment or teammate messaging performed.
