# Universe catalog snapshots

These local numerical snapshots are used by the exploration mode. `manifest.json` records original URLs, exact selection/query, raw-download SHA-256, output SHA-256, retrieval time in UTC and counts. The snapshots are bundled only with lazy-loaded exploration, not the duel. No credentials or live API calls are needed during travel.

## Stars — stars.json

24,835 HYG v4.1 stars: positive catalog distance within 100 parsecs, plus proper-named stars within 3,000 parsecs. Sun and the catalog's 100,000 pc unknown-distance sentinel are excluded. RA hours are converted to degrees. Distance, spectral type and magnitude remain source values; this is neither Gaia's full catalog nor a complete stellar census. No proper-motion propagation or claim of current-epoch positions.

Source: David Nash / Astronexus, HYG Database v4.1, archived GitHub snapshot:
https://github.com/astronexus/HYG-Database
https://raw.githubusercontent.com/astronexus/HYG-Database/main/hyg/CURRENT/hygdata_v41.csv

**stars.json is a derived HYG dataset, distributed under Creative Commons Attribution-ShareAlike 4.0 International:** https://creativecommons.org/licenses/by-sa/4.0/

Original license: https://github.com/astronexus/HYG-Database/blob/main/LICENSE
Modifications: filtered records, selected/renamed columns, RA conversion and display IDs. Original HYG IDs are preserved after the `hyg-` prefix. Coordinate conversion into render units happens in catalog.ts. HYG combines multiple surveys and is not itself a NASA-produced dataset. Credit upstream missions/catalogs as described in HYG's documentation.

## Planets — exoplanets.json

5,301 planet records across 3,894 hosts from NASA Exoplanet Archive PSCompPars with known positive distance less than 1,000 pc. Distances/uncertainties, radius/mass values and limit/provenance flags, orbital period, semi-major axis, equilibrium temperature, discovery method/year and selected host parameters are preserved. Missing fields remain null. A value can be an archive estimate; composite parameters may combine references and should not be treated as one self-consistent orbital solution. `Msini` is displayed as minimum mass. Equilibrium temperature is not surface temperature. Planet visual appearances, sizes, spacing and phases are authored illustrations.

Source and table definitions:
https://exoplanetarchive.ipac.caltech.edu/docs/API_PS_columns.html
TAP retrieval documentation:
https://exoplanetarchive.ipac.caltech.edu/docs/TAP/usingTAP.html

Acknowledgement: This research has made use of the NASA Exoplanet Archive, which is operated by the California Institute of Technology, under contract with the National Aeronautics and Space Administration under the Exoplanet Exploration Program. Catalog cards link to the archive system overview, where original publication references can be inspected.

## Galaxies — galaxies.json

All 1,034 valid Table 1 records from **Gil de Paz et al., The GALEX Ultraviolet Atlas of Nearby Galaxies**, hosted by NASA/IPAC Extragalactic Database. This is the archival atlas sample, not the latest NED database or NED-LVS. Preserve original catalog name, J2000 RA/Dec, distance in Mpc, distance-reference code, morphological classification and angular axes. Selected familiar aliases are editorial search labels; original identifiers remain visible.

Source table and its distance-method footnotes:
https://ned.ipac.caltech.edu/level5/GALEX_Atlas/Gildepaz2.html
Publication: https://arxiv.org/abs/astro-ph/0606440

Reference code 1 means Virgo-infall-corrected velocity distance using H0 = 70 km/s/Mpc. Other codes refer to the publication's distance literature; retain the numeric code and direct table link. This sample is selection-limited and distance estimates can be uncertain. No current-epoch update, completeness or physical galaxy-shape claim is made. Rendered glyph sizes/shapes are illustrative.

Acknowledgement: This research has made use of the NASA/IPAC Extragalactic Database (NED), which is funded by the National Aeronautics and Space Administration and operated by the California Institute of Technology.

## Regeneration

Download the three original files with the URLs and TAP query recorded in manifest.json. Then run from the repository root:

    python3 web/scripts/import-universe.py --stars /path/hygdata_v41.csv --planets /path/nasa-exoplanets.json --galaxies /path/galex-atlas.html

The importer uses only Python's standard library, validates unique IDs/counts, excludes invalid distances and writes all four snapshots. Raw inputs are temporary build-time research files, not phone downloads. No dependencies or root tooling changed.

## Local solar objects

`local-objects.json` contains public numerical orbital/fact data from NASA/JPL SBDB, CelesTrak GP and a bounded community TLE API mirror sample. Exact source requests, retrieval times and SHA-256 response hashes are embedded in the JSON. The mirror is listed in NASA Open APIs but independently operated; this is not an official SpaceX integration. Source attribution and modeled-frame/epoch limitations: `docs/local-solar-catalog-handoff.md` at the repository root. Geometry, craft silhouettes, bands, rings and comet tails are authored illustrations; no new photographic assets were downloaded.

## Provided planet-view facts and interior models

`planets-facts.json` was supplied in the user's `planet-view` reference bundle and retained byte-for-byte. It embeds NASA fact-sheet and interior research source URLs, generation date and confidence labels. Interior radius fractions, colors and surfaces are simplified visual models; gas/ice giant interiors remain labeled model-based. The reference's rendered demonstration video is not imported as live performance evidence. Details and checksums: `docs/planet-inspector-handoff.md`.
