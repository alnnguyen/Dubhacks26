# KO.rbit – audio pack

All files are **CC0 / public domain** (Kenney.nl packs, OpenGameArt items whose license field is CC0 only, or original sounds generated for this project and released CC0). **No attribution required** for any file. Optional credit line: "Sounds by Kenney.nl and OpenGameArt contributors (CC0)".

Every sound ships as `.mp3` (iPhone Safari) + `.webm` (Opus, smaller, used first where supported). SFX: mono 44.1 kHz, silence-trimmed, ~-16 LUFS / ≤ -1 dBTP, 96 kbps mp3. Loops/ambience: mono, ~-20 LUFS, 64 kbps mp3, crossfaded for seamless looping. Music: stereo, ~-18 LUFS, 80–128 kbps mp3, every track < 1.4 MB. Very short clicks (< 0.4 s) are peak-limited to about -2 dBTP; LUFS isn't meaningful at that length.

**Loop note:** the music tracks are author-marked loopable. MP3 adds encoder padding, so on iOS there may be a few ms gap at the loop point. The .webm loops are tighter. Ambience loops are crossfaded, so a tiny gap won't be heard.

## Top picks

- **menu_music** → `menu_music/menu_synthwave_calm.mp3`: Main menu / onboarding bed (TOP PICK)
- **battle_music** → `battle_music/battle_space_city_115bpm.mp3`: In-match loop (TOP PICK: laid-back synthwave groove)
- **travel** → `travel/hyperspace_jump_long.mp3`: Onboarding hyperspace jump: charge-up → jump (3.6s) (TOP PICK)
- **impact** → `impact/laser_player_a.mp3`: Player blaster (TOP PICK); VS intro lasers @1100; victory volley @150
- **ambience** → `ambience/mars_wind_loop.mp3`: Mars arena bed: thin wind + dust (TOP PICK)
- **ui** → `ui/ui_tap_a.mp3`: Button tap (TOP PICK)

## Hook map (match-intro-cursor-prompt.md / victory-cursor-prompt.md)

| Moment | sounds.ts key | file |
|---|---|---|
| VS intro whoosh @150ms | `vs.whoosh` | `travel/flyby_engine_a` |
| VS intro IMPACT @1050ms | `vs.impact` | `impact/impact_boom` |
| VS intro lasers @1100ms | `vs.laser` | `impact/laser_player_a` |
| VS SLAM @1600ms | `vs.vs` | `impact/vs_slam_b` |
| VS exit boost @2550ms | `vs.exit` | `travel/flyby_engine_b` |
| Victory volley @150ms | `victory.laser` | `impact/laser_player_a` |
| Victory IMPACT @450ms | `victory.impact` | `impact/impact_boom` |
| Victory boom @620ms | `victory.boom` | `impact/explosion_large_a` |
| VICTORY slam @950ms | `victory.slam + victory.sting` | `impact/vs_slam_b + ui/victory_sting_a` |
| Defeat klaxon @0 | `defeat.klaxon` | `impact/klaxon` |
| Defeat incoming fire @100ms | `defeat.laser` | `impact/laser_enemy_a` |
| Defeat hits @350 / @650ms | `defeat.hit` | `impact/hull_hit_a / shield_hit_a` |
| Defeat destruct @950ms | `defeat.boom` | `impact/explosion_large_a` |
| Defeat CRT power-off @1250ms | `defeat.powerDown` | `impact/power_down_b` |
| DEFEATED glitch @1600ms | `defeat.glitch` | `ui/ui_glitch_a` |
| Defeat sting @1950ms | `defeat.sting` | `ui/defeat_sting_a` |
| Onboarding hyperspace jump | `travel.jump` | `travel/hyperspace_jump_long` |
| Match start (arrive at Mars) | `travel.arrive` | `travel/hyperspace_arrive` |
| Menus / onboarding bed | `music.menu` | `menu_music/menu_synthwave_calm + ambience/cockpit_hum_loop` |
| In-match | `music.battle` | `battle_music/battle_space_city_115bpm + ambience/mars_wind_loop` |

## All files

| file | category | length | size (mp3 / webm) | license | attribution | source | where it's used |
|---|---|---|---|---|---|---|---|
| `menu_music/menu_synthwave_calm.mp3` ★ | menu_music | 157.9s (loop) | 1234.2 KB / 1399.1 KB | CC0 1.0 | no | [OpenGameArt – Calm Ambient 1 (Synthwave 4k) / 001_Synthwave_4k_0.mp3](https://opengameart.org/content/calm-ambient-1-synthwave-4k), by The Cynic Project (cynicmusic) | Main menu / onboarding bed (TOP PICK) |
| `menu_music/menu_outer_space_loop.mp3` | menu_music | 69.9s (loop) | 1093.1 KB / 618.7 KB | CC0 1.0 (author: "Public Domain") | no | [OpenGameArt – Outer Space Loop / outer_space_2.mp3](https://opengameart.org/content/outer-space-loop), by wipics | Menu / lobby / matchmaking wait loop |
| `menu_music/menu_observing_the_star.mp3` | menu_music | 134.43s (loop) | 1313.6 KB / 1504.6 KB | CC0 1.0 | no | [OpenGameArt – Another space background track (Observing The Star) / ObservingTheStar.ogg](https://opengameart.org/content/another-space-background-track), by yd | Onboarding / tutorial ambient |
| `battle_music/battle_space_city_115bpm.mp3` ★ | battle_music | 116.87s (loop) | 1370.2 KB / 951.8 KB | CC0 1.0 | no | [OpenGameArt – Space City / space_city_bpm115_0.ogg](https://opengameart.org/content/space-city), by mintodog | In-match loop (TOP PICK: laid-back synthwave groove) |
| `battle_music/battle_space_adventure_140bpm.mp3` | battle_music | 130.29s (loop) | 1273.0 KB / 1055.0 KB | CC0 1.0 | no | [OpenGameArt – Space Adventure / space_adventure_bpm140_0.ogg](https://opengameart.org/content/space-adventure), by mintodog | In-match loop, more energetic synthwave |
| `battle_music/battle_space_battle_130bpm.mp3` | battle_music | 88.62s (loop) | 1385.8 KB / 670.1 KB | CC0 1.0 | no | [OpenGameArt – Space Battle / space_battle_bpm130_0.ogg](https://opengameart.org/content/space-battle), by mintodog | In-match loop, most driving (final round / low HP) |
| `travel/hyperspace_jump_long.mp3` ★ | travel | 3.59s | 42.9 KB / 23.1 KB | CC0 (original/generated) | no | [Original, generated with numpy/ffmpeg for this project / hyperspace_jump_long.wav]((generated – see _originals/generated/gen.py)), by Grok Bot for Alex Nguyen | Onboarding hyperspace jump: charge-up → jump (3.6s) (TOP PICK) |
| `travel/hyperspace_jump_short.mp3` | travel | 2.1s | 25.5 KB / 13.1 KB | CC0 (original/generated) | no | [Original, generated with numpy/ffmpeg for this project / hyperspace_jump_short.wav]((generated – see _originals/generated/gen.py)), by Grok Bot for Alex Nguyen | VS intro / scene transition quick jump (2.1s) |
| `travel/hyperspace_arrive.mp3` | travel | 1.99s | 24.2 KB / 13.0 KB | CC0 (original/generated) | no | [Original, generated with numpy/ffmpeg for this project / hyperspace_arrive.wav]((generated – see _originals/generated/gen.py)), by Grok Bot for Alex Nguyen | Drop out of hyperspace into Mars arena (match start) |
| `travel/hyperdrive_charge.mp3` | travel | 2.52s | 30.3 KB / 19.2 KB | CC0 (original/generated) | no | [Original, generated with numpy/ffmpeg for this project / hyperdrive_charge.wav]((generated – see _originals/generated/gen.py)), by Grok Bot for Alex Nguyen | Charge-up only (pair with any whoosh, e.g. while "searching" ends) |
| `travel/warp_engine_engage.mp3` | travel | 7.43s | 87.9 KB / 44.5 KB | CC0 1.0 (credit "appreciated but unnecessary") | no | [OpenGameArt – Warp Engine Engage Sound / warp_engine_engage_0-16bit.wav](https://opengameart.org/content/warp-engine-engage-sound), by Bart (bart) | Alt hyperspace jump (real synth design) |
| `travel/warp_out_retro.mp3` | travel | 4.1s | 49.0 KB / 25.0 KB | CC0 1.0 | no | [OpenGameArt – Space Sound Effects / warpout.ogg](https://opengameart.org/content/space-sound-effects), by messersm | Alt short warp-out (bfxr, retro) |
| `travel/phase_jump.mp3` | travel | 0.45s | 6.2 KB / 3.0 KB | CC0 1.0 | no | [Kenney – Digital Audio / phaseJump1.ogg](https://kenney.nl/assets/digital-audio), by Kenney (kenney.nl) | Tiny boost/blink (dash ability) |
| `travel/flyby_engine_a.mp3` | travel | 1.8s | 21.8 KB / 11.6 KB | CC0 (original/generated) | no | [Original, generated with numpy/ffmpeg for this project / flyby_engine_a.wav]((generated – see _originals/generated/gen.py)), by Grok Bot for Alex Nguyen | VS intro ship fly-in @150ms (TOP PICK flyby) |
| `travel/flyby_engine_b.mp3` | travel | 1.2s | 14.7 KB / 8.2 KB | CC0 (original/generated) | no | [Original, generated with numpy/ffmpeg for this project / flyby_engine_b.wav]((generated – see _originals/generated/gen.py)), by Grok Bot for Alex Nguyen | Fast fighter pass-by / VS exit boost @2550ms |
| `travel/flyby_whoosh_c.mp3` | travel | 1.0s | 12.6 KB / 7.1 KB | CC0 (original/generated) | no | [Original, generated with numpy/ffmpeg for this project / flyby_whoosh_c.wav]((generated – see _originals/generated/gen.py)), by Grok Bot for Alex Nguyen | Short whoosh: panel slides, onboarding card transitions |
| `travel/whoosh_air.mp3` | travel | 5.25s | 62.2 KB / 30.5 KB | CC0 1.0 | no | [OpenGameArt – Air whoosh / whoosh2_0.wav](https://opengameart.org/content/air-whoosh), by pyranostudios | Generic air whoosh (VS intro alt whoosh) |
| `travel/flyby_rocket_retro.mp3` | travel | 4.18s | 49.9 KB / 36.3 KB | CC0 1.0 | no | [OpenGameArt – Rocket fly 8-bit / rocket.wav](https://opengameart.org/content/rocket-fly-8-bit), by person | Missile / rocket fly-by |
| `travel/engine_thrust_loop.mp3` | travel | 4.7s (loop) | 37.2 KB / 22.9 KB | CC0 1.0 | no | [Kenney – Sci-Fi Sounds / spaceEngineLow_000.ogg](https://kenney.nl/assets/sci-fi-sounds), by Kenney (kenney.nl) | Engine thrust while moving (loop) |
| `travel/thruster_fire_loop.mp3` | travel | 4.7s (loop) | 37.2 KB / 24.4 KB | CC0 1.0 | no | [Kenney – Sci-Fi Sounds / thrusterFire_000.ogg](https://kenney.nl/assets/sci-fi-sounds), by Kenney (kenney.nl) | Boost thruster loop |
| `impact/laser_player_a.mp3` ★ | impact | 0.24s | 3.7 KB / 2.1 KB | CC0 1.0 | no | [Kenney – Sci-Fi Sounds / laserSmall_000.ogg](https://kenney.nl/assets/sci-fi-sounds), by Kenney (kenney.nl) | Player blaster (TOP PICK); VS intro lasers @1100; victory volley @150 |
| `impact/laser_player_b.mp3` | impact | 0.34s | 4.9 KB / 2.8 KB | CC0 1.0 | no | [Kenney – Sci-Fi Sounds / laserSmall_002.ogg](https://kenney.nl/assets/sci-fi-sounds), by Kenney (kenney.nl) | Player blaster variant (round-robin) |
| `impact/laser_player_c.mp3` | impact | 0.41s | 5.6 KB / 3.2 KB | CC0 1.0 | no | [Kenney – Sci-Fi Sounds / laserSmall_004.ogg](https://kenney.nl/assets/sci-fi-sounds), by Kenney (kenney.nl) | Player blaster variant (round-robin) |
| `impact/laser_heavy.mp3` | impact | 0.68s | 8.6 KB / 4.5 KB | CC0 1.0 | no | [Kenney – Sci-Fi Sounds / laserLarge_000.ogg](https://kenney.nl/assets/sci-fi-sounds), by Kenney (kenney.nl) | Charged shot / super |
| `impact/laser_enemy_a.mp3` | impact | 0.24s | 3.7 KB / 2.6 KB | CC0 1.0 | no | [Kenney – Sci-Fi Sounds / laserRetro_000.ogg](https://kenney.nl/assets/sci-fi-sounds), by Kenney (kenney.nl) | Opponent blaster; defeat incoming fire @100 |
| `impact/laser_enemy_b.mp3` | impact | 0.74s | 9.5 KB / 5.1 KB | CC0 1.0 | no | [Kenney – Sci-Fi Sounds / laserLarge_002.ogg](https://kenney.nl/assets/sci-fi-sounds), by Kenney (kenney.nl) | Opponent heavy shot |
| `impact/explosion_small_a.mp3` | impact | 0.78s | 9.8 KB / 5.0 KB | CC0 1.0 | no | [Kenney – Sci-Fi Sounds / explosionCrunch_000.ogg](https://kenney.nl/assets/sci-fi-sounds), by Kenney (kenney.nl) | Small explosion / missile hit |
| `impact/explosion_small_b.mp3` | impact | 1.26s | 15.7 KB / 7.7 KB | CC0 1.0 | no | [Kenney – Sci-Fi Sounds / explosionCrunch_002.ogg](https://kenney.nl/assets/sci-fi-sounds), by Kenney (kenney.nl) | Small explosion variant |
| `impact/explosion_large_a.mp3` | impact | 2.0s | 24.2 KB / 10.3 KB | CC0 1.0 | no | [Kenney – Sci-Fi Sounds / lowFrequency_explosion_000.ogg](https://kenney.nl/assets/sci-fi-sounds), by Kenney (kenney.nl) | Ship destroyed: victory boom @620, defeat destruct @950 |
| `impact/explosion_large_b.mp3` | impact | 1.0s | 12.6 KB / 5.3 KB | CC0 1.0 | no | [Kenney – Sci-Fi Sounds / lowFrequency_explosion_001.ogg](https://kenney.nl/assets/sci-fi-sounds), by Kenney (kenney.nl) | Ship destroyed variant |
| `impact/shield_hit_a.mp3` | impact | 0.9s | 11.4 KB / 7.2 KB | CC0 1.0 | no | [Kenney – Sci-Fi Sounds / forceField_000.ogg](https://kenney.nl/assets/sci-fi-sounds), by Kenney (kenney.nl) | Shield absorbs hit |
| `impact/shield_hit_b.mp3` | impact | 0.89s | 11.4 KB / 6.7 KB | CC0 1.0 | no | [Kenney – Sci-Fi Sounds / forceField_002.ogg](https://kenney.nl/assets/sci-fi-sounds), by Kenney (kenney.nl) | Shield hit variant / shield up |
| `impact/hull_hit_a.mp3` | impact | 0.63s | 8.3 KB / 4.1 KB | CC0 1.0 | no | [Kenney – Sci-Fi Sounds / impactMetal_000.ogg](https://kenney.nl/assets/sci-fi-sounds), by Kenney (kenney.nl) | Hull hit; defeat hit 1 @350 & hit 2 @650 |
| `impact/hull_hit_b.mp3` | impact | 0.16s | 2.8 KB / 1.5 KB | CC0 1.0 | no | [Kenney – Impact Sounds / impactMetal_heavy_000.ogg](https://kenney.nl/assets/impact-sounds), by Kenney (kenney.nl) | Hull hit heavy variant |
| `impact/impact_boom.mp3` | impact | 0.63s | 8.3 KB / 4.4 KB | CC0 1.0 | no | [Kenney – Impact Sounds / impactPunch_heavy_000.ogg](https://kenney.nl/assets/impact-sounds), by Kenney (kenney.nl) | VS intro IMPACT @1050; victory IMPACT @450 |
| `impact/vs_slam_a.mp3` | impact | 0.49s | 6.5 KB / 3.3 KB | CC0 1.0 | no | [Kenney – Impact Sounds / impactPlate_heavy_000.ogg](https://kenney.nl/assets/impact-sounds), by Kenney (kenney.nl) | VS SLAM @1600; VICTORY slam @950 (layer with impact_boom) |
| `impact/vs_slam_b.mp3` | impact | 1.0s | 12.6 KB / 5.3 KB | CC0 1.0 | no | [Kenney – Sci-Fi Sounds / lowFrequency_explosion_001.ogg](https://kenney.nl/assets/sci-fi-sounds), by Kenney (kenney.nl) | Alt slam (deeper, cinematic) |
| `impact/klaxon.mp3` | impact | 1.2s | 14.7 KB / 10.6 KB | CC0 (original/generated) | no | [Original, generated with numpy/ffmpeg for this project / klaxon.wav]((generated – see _originals/generated/gen.py)), by Grok Bot for Alex Nguyen | Defeat red alert @0 |
| `impact/power_down.mp3` | impact | 0.48s | 6.5 KB / 3.6 KB | CC0 1.0 | no | [Kenney – Digital Audio / phaserDown3.ogg](https://kenney.nl/assets/digital-audio), by Kenney (kenney.nl) | Defeat CRT power-off @1250 |
| `impact/power_down_b.mp3` | impact | 0.65s | 8.3 KB / 5.6 KB | CC0 1.0 | no | [Kenney – Digital Audio / lowDown.ogg](https://kenney.nl/assets/digital-audio), by Kenney (kenney.nl) | Alt power-down (lower, longer) |
| `ambience/mars_wind_loop.mp3` ★ | ambience | 30.0s (loop) | 234.9 KB / 138.8 KB | CC0 (original/generated) | no | [Original, generated with numpy/ffmpeg for this project / mars_wind_loop.wav]((generated – see _originals/generated/gen.py)), by Grok Bot for Alex Nguyen | Mars arena bed: thin wind + dust (TOP PICK) |
| `ambience/mars_dust_storm_loop.mp3` | ambience | 24.0s (loop) | 188.0 KB / 110.3 KB | CC0 (original/generated) | no | [Original, generated with numpy/ffmpeg for this project / mars_dust_storm_loop.wav]((generated – see _originals/generated/gen.py)), by Grok Bot for Alex Nguyen | Mars storm / intense phase |
| `ambience/mars_wind_whoosh_loop.mp3` | ambience | 5.96s (loop) | 47.2 KB / 28.6 KB | CC0 1.0 | no | [OpenGameArt – wind whoosh loop / wind_woosh_loop.ogg](https://opengameart.org/content/wind-whoosh-loop), by sketchman3 | Short gusty wind loop (alt Mars bed) |
| `ambience/space_winds_loop.mp3` | ambience | 46.64s (loop) | 364.9 KB / 215.5 KB | CC0 1.0 | no | [OpenGameArt – Space Winds / space-wind_0.mp3](https://opengameart.org/content/space-winds), by aquinn | Space ambience under menus / orbit view |
| `ambience/deep_space_rumble_loop.mp3` | ambience | 20.0s (loop) | 156.8 KB / 87.4 KB | CC0 (original/generated) | no | [Original, generated with numpy/ffmpeg for this project / deep_space_rumble_loop.wav]((generated – see _originals/generated/gen.py)), by Grok Bot for Alex Nguyen | Low space rumble (under VS intro / battle) |
| `ambience/cockpit_hum_loop.mp3` | ambience | 12.0s (loop) | 94.3 KB / 56.9 KB | CC0 (original/generated) | no | [Original, generated with numpy/ffmpeg for this project / cockpit_hum_loop.wav]((generated – see _originals/generated/gen.py)), by Grok Bot for Alex Nguyen | Cockpit/bridge hum (onboarding hologram, menus) |
| `ambience/ship_engine_idle_loop.mp3` | ambience | 4.7s (loop) | 37.2 KB / 24.1 KB | CC0 1.0 | no | [Kenney – Sci-Fi Sounds / spaceEngineSmall_000.ogg](https://kenney.nl/assets/sci-fi-sounds), by Kenney (kenney.nl) | Ship idle engine hum (alt cockpit) |
| `ui/ui_tap_a.mp3` ★ | ui | 0.04s | 1.3 KB / 0.9 KB | CC0 1.0 | no | [Kenney – Interface Sounds / select_001.ogg](https://kenney.nl/assets/interface-sounds), by Kenney (kenney.nl) | Button tap (TOP PICK) |
| `ui/ui_tap_b.mp3` | ui | 0.1s | 1.9 KB / 1.0 KB | CC0 1.0 | no | [Kenney – Interface Sounds / click_001.ogg](https://kenney.nl/assets/interface-sounds), by Kenney (kenney.nl) | Button tap alt (softer click) |
| `ui/ui_tap_c.mp3` | ui | 0.13s | 2.5 KB / 1.3 KB | CC0 1.0 | no | [Kenney – Interface Sounds / toggle_001.ogg](https://kenney.nl/assets/interface-sounds), by Kenney (kenney.nl) | Toggle / switch / slider |
| `ui/ui_confirm_a.mp3` | ui | 0.29s | 4.3 KB / 2.9 KB | CC0 1.0 | no | [Kenney – Interface Sounds / confirmation_001.ogg](https://kenney.nl/assets/interface-sounds), by Kenney (kenney.nl) | Confirm / Ready / Play |
| `ui/ui_confirm_b.mp3` | ui | 0.54s | 7.1 KB / 3.9 KB | CC0 1.0 | no | [Kenney – Interface Sounds / confirmation_002.ogg](https://kenney.nl/assets/interface-sounds), by Kenney (kenney.nl) | Confirm alt / match found |
| `ui/ui_confirm_c.mp3` | ui | 0.62s | 8.0 KB / 4.0 KB | CC0 1.0 | no | [Kenney – Digital Audio / twoTone1.ogg](https://kenney.nl/assets/digital-audio), by Kenney (kenney.nl) | Sci-fi confirm (beepy) |
| `ui/ui_back_a.mp3` | ui | 0.06s | 1.6 KB / 0.9 KB | CC0 1.0 | no | [Kenney – Interface Sounds / back_001.ogg](https://kenney.nl/assets/interface-sounds), by Kenney (kenney.nl) | Back / cancel |
| `ui/ui_back_b.mp3` | ui | 0.09s | 1.9 KB / 1.7 KB | CC0 1.0 | no | [Kenney – Interface Sounds / back_002.ogg](https://kenney.nl/assets/interface-sounds), by Kenney (kenney.nl) | Back alt |
| `ui/ui_error.mp3` | ui | 0.1s | 2.2 KB / 1.2 KB | CC0 1.0 | no | [Kenney – Interface Sounds / error_004.ogg](https://kenney.nl/assets/interface-sounds), by Kenney (kenney.nl) | Invalid action |
| `ui/ui_glitch_b.mp3` | ui | 0.03s | 1.3 KB / 0.7 KB | CC0 1.0 | no | [Kenney – Interface Sounds / glitch_002.ogg](https://kenney.nl/assets/interface-sounds), by Kenney (kenney.nl) | Micro glitch stutter (retrigger 3-4x for flicker, defeat @650) |
| `ui/powerup_a.mp3` | ui | 0.34s | 4.6 KB / 2.6 KB | CC0 1.0 | no | [Kenney – Digital Audio / powerUp2.ogg](https://kenney.nl/assets/digital-audio), by Kenney (kenney.nl) | Power-up pickup |
| `ui/powerup_b.mp3` | ui | 0.4s | 5.6 KB / 3.2 KB | CC0 1.0 | no | [Kenney – Digital Audio / powerUp5.ogg](https://kenney.nl/assets/digital-audio), by Kenney (kenney.nl) | Power-up alt / shield restore |
| `ui/victory_sting_a.mp3` | ui | 0.82s | 10.5 KB / 6.5 KB | CC0 1.0 | no | [Kenney – Music Jingles / 8-Bit jingles/jingles_NES12.ogg](https://kenney.nl/assets/music-jingles), by Kenney (kenney.nl) | Victory sting (rising, retro) – play after VICTORY slam (~1.0s) |
| `ui/victory_sting_b.mp3` | ui | 0.73s | 9.2 KB / 5.1 KB | CC0 1.0 | no | [Kenney – Music Jingles / Hit jingles/jingles_HIT10.ogg](https://kenney.nl/assets/music-jingles), by Kenney (kenney.nl) | Victory sting alt (punchy) |
| `ui/victory_sting_c.mp3` | ui | 1.15s | 14.4 KB / 8.1 KB | CC0 1.0 | no | [Kenney – Digital Audio / zapThreeToneUp.ogg](https://kenney.nl/assets/digital-audio), by Kenney (kenney.nl) | Victory sting sci-fi (short zap up) |
| `ui/defeat_sting_a.mp3` | ui | 0.81s | 10.1 KB / 6.7 KB | CC0 1.0 | no | [Kenney – Music Jingles / 8-Bit jingles/jingles_NES11.ogg](https://kenney.nl/assets/music-jingles), by Kenney (kenney.nl) | Defeat sting (falling, retro) – after DEFEATED @1950 |
| `ui/defeat_sting_b.mp3` | ui | 0.72s | 9.2 KB / 5.6 KB | CC0 1.0 | no | [Kenney – Music Jingles / Hit jingles/jingles_HIT09.ogg](https://kenney.nl/assets/music-jingles), by Kenney (kenney.nl) | Defeat sting alt |
| `ui/defeat_sting_c.mp3` | ui | 1.28s | 16.0 KB / 8.7 KB | CC0 1.0 | no | [Kenney – Digital Audio / zapThreeToneDown.ogg](https://kenney.nl/assets/digital-audio), by Kenney (kenney.nl) | Defeat sting sci-fi (zap down) |
| `ui/ui_glitch_a.mp3` | ui | 0.6s | 7.7 KB / 4.4 KB | CC0 1.0 | no | [Kenney – Sci-Fi Sounds / computerNoise_001.ogg](https://kenney.nl/assets/sci-fi-sounds), by Kenney (kenney.nl) | Defeat "DEFEATED" glitch @1600 / hologram static (0.6s) |
| `ui/victory_fanfare_long.mp3` | ui | 8.0s | 126.2 KB / 55.6 KB | CC0 1.0 | no | [OpenGameArt – victory road / fanfare_-_victory_road_II.mp3](https://opengameart.org/content/victory-road), by bobjt | Optional longer victory fanfare over stats card (first 8s, faded) |

## Notes
- Sources verified on the live pages on 2026-10-18: Kenney asset pages state "Creative Commons CC0" (License.txt in each zip too); every OpenGameArt item's license field lists **only CC0**. Items that were dual-licensed (CC-BY + CC0) or CC-BY/SA were skipped.
- Generated files are made by `_originals/generated/gen.py` (numpy synthesis) and released CC0. `_originals/build.py` rebuilds the whole pack.
- `_originals/` holds the untouched downloads. Add it to `.gitignore`.
- Battle for Mars (OGA, CC0, Sperry Lion) and other extra candidates are in `_originals/oga/` but weren't processed (orchestral/epic, which doesn't match the chill synthwave brief).
