# Astronaut model

`astronaut-suit.glb` — "Astronaut" (Finn the Frog variant) from the **Ultimate Space Kit** by **Quaternius**
(https://quaternius.com), downloaded from Poly Pizza: https://poly.pizza/m/0D54W8yfrA

License: **CC0 1.0 Universal** (public domain). Attribution is not required; credited here as thanks.

The file is unmodified. At load time the app removes the animal head and the pistol
(`src/features/avatars/utils/astronautModel.ts`) and adds its own helmet, photo face,
backpack and lightsaber.

## Battle suit supplied by the user

`battle-astronaut.glb` is an unchanged copy of the supplied
`Astronaut by Quaternius - OgeSH89Nmx.glb`. Creator credit: Quaternius (as named by the supplied file).
The battle renderer reuses its suit triangles, UVs and skin weights, replacing the source character's head with the existing customizable helmet. Its original animations are not used for combat; segment transforms come from the same streamed stick-figure joints. This does not replace the onboarding GLB above.
