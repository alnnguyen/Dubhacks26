# Mars arena assets — provenance

## NASA-derived

| File | Source | Notes |
|---|---|---|
| `jezero_mola.png`, `jezero_mola.json` | NASA PDS, **MGS-M-MOLA-5-MEGDR-L3-V1.0**, product `megt44n000hb.img` (Mars Orbiter Laser Altimeter, Mars Global Surveyor). https://pds-geosciences.wustl.edu/mgs/mgs-m-mola-5-megdr-l3-v1/mgsl_300x/meg128/ | Jezero Crater region, 17.13–19.63 °N, 76.33–78.83 °E (~148 km). 128 px/deg (~463 m/px) source, range-fetched rows, cropped, bilinear-resampled to 256², 16-bit normalized. Script: `scripts/mars/crop_mola.py`. NASA data is not copyrighted; credit NASA/JPL/GSFC MOLA Science Team. |

Planetary values in `src/arena/mars/marsConfig.ts`: NASA Mars Fact Sheet, https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html (verified 2026-10-17).

## Third-party textures (not NASA)

CC0 1.0 (public domain) photo-scanned PBR materials from **ambientCG** (https://ambientcg.com), downscaled and recompressed. Colors are re-graded in the shaders toward Mars tones; they are Earth materials, not Mars imagery.

| File prefix | ambientCG asset | Role |
|---|---|---|
| `textures/ground079s_*` | Ground079S | regolith with pebbles |
| `textures/ground097_*` | Ground097 | wind-rippled sand |
| `textures/rock061_*` | Rock061 | layered sedimentary rock (slopes, formations) |
| `textures/rock035_*` | Rock035 | dark rock used as basalt (boulders) |

## Procedural (generated in code, not NASA-derived)

- Arena-scale terrain detail (rolling regolith, ridges, mid-distance hills) — `terrain/heightmap.ts`
- All rock and formation geometry — `rockGeometry.ts`
- Sky, sun halo, haze and dust — `MarsSky.tsx`, `Dust.tsx`
- The embedded combat platform (fictional): geometry and its painted bronze/steel panel, wear and dust textures — `MarsPlatform.tsx`
- Layered canyon walls and their strata/erosion (artistic reconstruction inspired by Jezero delta and crater-rim outcrops in Perseverance panoramas, not measured terrain) — `CanyonCliffs.tsx`
- The platform's regolith berm and the flattened floor around it — `terrain/heightmap.ts` (`MARS_PLATFORM`); the MOLA relief beyond it is unchanged
- Wind-blown surface dust wisps — `WindDust.tsx`

## Arrival cinematic handoff

`spacetomars.mp4` is played unchanged. Its final second is solid dust; the live scene starts inside fog and a screen veil whose colours were sampled from that final frame (centre #dd3d0a, mid #a82508, edges #8a1c04) — `MarsArrival.tsx`, `mars-arrival.css`.

The MOLA relief is shown with a documented 2.6× vertical exaggeration and a 1/40 horizontal scale (angular size preserved).
