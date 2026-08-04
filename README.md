# LOOPLASH — Player Fit Prototype

Phaser 4 + TypeScript + Vite browser prototype for the Poki-oriented LOOPLASH design. The prototype reduces launch content quantity while preserving the full interaction and build depth.

## Run

```bash
npm install
npm run dev
```

Production and verification:

```bash
npm run typecheck
npm run smoke
npm run build
```

## Controls

- Mouse / touch: press anywhere, drag a loop relative to the anchor, release to snap it shut.
- Keyboard: hold `Space`, draw with `WASD` or arrow keys, then release `Space`.
- Pause: `Esc` or the pause button.

## Player Fit content

- 2 biomes, 8 normal enemies, 3 elites, 1 complete three-phase boss.
- 3 needles, 15 patterns, 6 world rules, 10 seam synergies, and 3 objective types.
- Desktop, pointer, keyboard, and responsive touch layouts.
- English and Simplified Chinese localization architecture, reduced-motion and high-contrast settings.

All current art is lightweight Phaser vector drawing. It is deliberately replaceable by atlases without changing simulation rules.

## Architecture

```text
src/
  game/
    content/       Data definitions; most content expansion happens here
    core/          Shared types, math and deterministic random
    simulation/    Pure gameplay orchestration and focused systems
    runtime/       Lifecycle bridge between simulation, UI and platform
    platform/      Local/Poki-facing adapter boundary
  phaser/
    input/         Pointer and keyboard normalization
    scenes/        Thin fixed-step Phaser scene
    view/          State-driven vector renderer
  ui/              DOM HUD, choices and accessibility controls
  localization/    Message catalog and locale selection
```

The dependency direction is one-way: Phaser and the DOM consume the simulation; the simulation does not import rendering or HUD code. New enemies, patterns, seams and rules are primarily data additions. New behaviors belong in a focused system instead of the scene.

The local platform adapter mirrors Poki lifecycle boundaries. The eventual Poki SDK adapter can replace it without leaking SDK calls into scenes or gameplay systems.
