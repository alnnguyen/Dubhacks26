# Earth texture credits

Files in this folder are downscaled (4096/2048/1024 px) copies of the 8K Earth
textures shipped in https://github.com/ulanch/earth (`frontend/public/textures/earth/`).

- **Shader techniques** (`src/ui/components/spaceship/SpaceEnvironment.tsx`) adapted from
  ulanch/earth — MIT License, Copyright (c) 2025 Alex Ulanch.
- **Texture images**: the reference repo does not state their source. Their names and
  resolution match the Solar System Scope 8K Earth set (https://www.solarsystemscope.com/textures/),
  licensed **CC BY 4.0** and based on NASA imagery. Attribution:
  "Earth textures © Solar System Scope (CC BY 4.0), based on NASA data."
  Confirm provenance before public release; NASA Blue Marble / Black Marble
  (public domain) are drop-in replacements if needed.

| File | Source | Use |
|---|---|---|
| earth_day_4k.jpg / earth_day_2k.jpg | 8k_earth_day.jpg | daytime surface (High / Low quality) |
| earth_night_2k.jpg | 8k_earth_night.jpg | city lights |
| earth_clouds_2k.jpg | 8k_earth_clouds.jpg | cloud shell + cloud shadows |
| earth_specular_1k.jpg | 8k_earth_specular.jpg | ocean specular mask |
