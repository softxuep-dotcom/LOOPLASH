# LOOPLASH art direction and asset plan

## Shippable first pass

The runtime art is a soft botanical-fantasy style: plush silhouettes, painted cel shading,
dark navy playfields, and warm cream highlights. The playfield centre stays quiet so the
thread, capture preview, projectiles, and enemies remain readable at mobile scale.

| Group | Runtime assets | Motion treatment |
| --- | --- | --- |
| Meadow | puff, needler, shellbud, bomb-bloom, meadow backdrop | hover, squash, velocity tilt |
| Reef | skipper, splitter, mirrorling, bubble-ray, reef backdrop | hover, squash, direction flip |
| Encounters | knot-knight, storm-spool, twin-maw, tanglejaw | slower breathing, direction flip where needed |
| Code-native | needle, thread, motes, projectiles, capture preview, hit effects | Phaser graphics; preserves gameplay clarity |

All creature images use a 256×256 transparent frame with a centred subject. Runtime files
are lossless WebP; backgrounds are compressed WebP. Collision radii remain simulation data
and do not depend on visible pixels.

## Animation strategy

The first pass deliberately uses one strong source pose per creature. Phaser adds secondary
motion from simulation state: vertical hover, squash/stretch, horizontal facing, velocity
tilt, and fill-tint hit flashes. This avoids generated frame-to-frame shape drift and keeps
the game small.

If playtesting shows that a creature needs clearer anticipation, upgrade only that creature
to a small atlas:

1. keep the approved source pose as the model sheet;
2. create three directions (left, down, up), five frames each;
3. normalize every frame to the same 256×256 canvas and anchor;
4. animate at 8–10 FPS and preserve the vector fallback.

Use skeletal animation only for a large boss or a creature with independently moving limbs.
The current round creatures gain little from the extra runtime and authoring complexity.

## Pipeline and ownership

- Editable/generated masters live in `artifacts/art-source/`.
- Browser-ready files live in `public/assets/art/`.
- `python scripts/package-generated-art.py` crops, centres, scales, and packages the masters.
- `src/phaser/art/ArtManifest.ts` is the single runtime mapping for asset keys and display scale.
- This batch was generated specifically for LOOPLASH with OpenAI ImageGen. No third-party
  game asset is distributed in this batch.
- `E:/game/Vampire Survivors-like2/survios2` was inspected only for atlas organization and
  animation sizing conventions; its art was not copied because no clear asset licence was found.

## Next production priorities

1. Add a player avatar and dedicated needle silhouettes after the input feel is locked.
2. Add a five-frame anticipation/burst atlas for bomb-bloom if capture-preview testing needs it.
3. Add a phase-transition atlas or bone rig for tanglejaw only after boss timing is final.
4. Add UI iconography from the same cream/gold/coral palette; keep text and HUD code-native.

