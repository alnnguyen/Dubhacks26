# Neptune destination — sources, data and what is fictional

Verified 2026-10-18. Values live in `web/src/arena/neptune/neptuneConfig.ts`, split the same way as Mars (`science` / `gameplay` / `render`).

## Measured data (NASA)

[NASA Neptune Fact Sheet (NSSDCA)](https://nssdc.gsfc.nasa.gov/planetary/factsheet/neptunefact.html):

| Quantity | Value |
| --- | --- |
| Equatorial radius (1 bar) | 24,764 km |
| Mean gravity at 1 bar | 11.27 m/s² (equatorial 11.00, polar 11.41) |
| Solar irradiance | 1.508 W/m² (Earth: 1361) |
| Mean distance from Sun | 4,514.953 × 10⁶ km ≈ 30.07 AU |
| Temperature at 1 bar | 72 K (−201 °C) |
| Atmosphere (by volume) | H₂ 80.0 %, He 19.0 %, CH₄ 1.5 % |
| Winds | 0–580 m/s |
| Sidereal rotation | 16.11 h |
| Geometric albedo | 0.442 |

[NASA Science — Neptune facts](https://science.nasa.gov/neptune/facts/): no solid surface; methane absorbs other colors and reflects blue; winds of more than 2,000 km/h; clouds of frozen methane; noon sunlight about 900× dimmer than Earth's; the 1989 Great Dark Spot was large enough to contain Earth and has since disappeared; Voyager-era images were adjusted to show clouds, and 2024 reprocessing shows a paler true color.

## Voyager 2 imagery used as cloud references

- [PIA00047 — Changes in Great Dark Spot](https://pds-rings.seti.org/press_releases/pages/PIA00xxx/PIA00047.html): the Spot is about Earth-sized; cirrus clouds are frozen methane, and they changed visibly within 18 hours.
- [PIA02222 — Neptune Clouds on the Dark Spot](https://science.nasa.gov/photojournal/neptune-clouds-on-the-dark-spot/): bright, high-altitude white clouds sit beside the dark spot, and light at methane wavelengths is absorbed deeper down.

## How the data is used

- **Gameplay:** the server uses 11.2 m/s², rounded from the fact sheet (`server/src/game/rules.ts`). Saber timing and damage do not change per world.
- **Clouds (procedural, not reconstructed):**
  - A dark, opaque lower deck in zonal bands.
  - A broken middle layer with a dark vortex and bright companion clouds on its southern edge, modeled on the Great Dark Spot imagery.
  - Thin bright methane-cirrus streaks above.
  - Each layer drifts at a different speed. The motion is scaled far below 580 m/s so it reads at arena scale.
- **Light:** real noon light is about 0.11 % of Earth's, too dark to play in, so exposure is compensated. The sun is a small, cool disk, and most light is blue scattered sky.
- **Color:** the palette is matched to the arrival cinematic's final frame so that the video-to-3D handoff is seamless. This is deeper and more saturated than Neptune's true color.

## Fictional elements

- **The combat platform:** an invented floating station. Neptune has no solid ground, and nothing here claims otherwise.
- **The arrival cinematic** (`web/public/assets/neptune/neptune-arrival.mp4`, supplied by the team as `space to saturn clouds.mp4`): AI-generated footage, not spacecraft imagery.
- **`cockpit-final.png` and `poster.jpg`:** derived from frames of that cinematic.

## Textures

`web/public/textures/planets/2k_neptune.jpg` (roulette planet) comes from [Solar System Scope](https://www.solarsystemscope.com/textures/), which distributes its textures under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) and describes them as "based on NASA elevation and imagery data". Unmapped areas are filled in artistically. Treat it as an artistic map, not a direct Voyager mosaic. Attribution is in `web/public/textures/planets/ATTRIBUTION.md`.
