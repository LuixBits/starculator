# Starculator design brief

> **Owner feedback, 2026-10-04 (overrides everything below where they conflict):** the first prototype's look was judged _terrible_: too much signage and decoration. Direction for now and for the redesign later:
>
> - **Function and UX first.** Easy to use, interesting interaction, no clutter. Every decorative object must earn its place; when in doubt, remove it.
> - **Signs:** at most ONE neon sign on the whole site (the site title). No neon section headings, no stencil text blocks, no "ASCII"-style lettering, no hazard-tape tags, no stamps. Section headings are plain text.
> - **Type:** a small set of font sizes, three or four in total (e.g. title, heading, body, small). Not six.
> - **Keep:** the palette (deep violet, magenta, cyan, amber), Righteous for the title/headings and Space Mono for body, the 3D hold as the hero of the planner page, the departure board as the ship picker, the manifest as the entry form.
> - The remainder of this brief describes the original "freight deck" concept; treat it as a mood reference, not a checklist. The full visual rework happens in a later phase.

**Purpose.** Starculator should look like a sibling of the Projects room in the owner's portfolio (`LuixBits/lupe-webfolio`, `/projects`): a handcrafted, illustrated place built from semantic HTML, original SVG and CSS materials, not a generic dashboard. This brief translates that room into a Star Citizen cargo setting. A local clone of the portfolio sits at `/home/user/luixbits/lupe-webfolio` during development; the files named below are the technique references.

## 1. The scene

A **freight deck** on a space station after hours. Deep violet walls, a perspective floor grid in magenta that recedes to a horizon, cyan work-light reflections, an amber "sunset" glow from a distant hangar door. Along the deck:

| Content or action               | Object                                                              | Notes                                                                                                                                                                                                                                                                                     |
| ------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Site title and section headings | **Neon signs** (SVG tube lettering with an HTML heading underneath) | Port the construction of `src/lib/projects/overview/NeonSign.svelte`: dark backing stroke, faint halo, bright core, white hot centre, `drop-shadow` glow. Pink for the main sign, cyan for sections, violet for secondary.                                                                |
| Pick a ship                     | **Departure board**                                                 | A wall-mounted board with monospace rows (manufacturer, ship, SCU, grids, max box). Rows are real links. Search is a slot in the board's frame. Optional subtle split-flap feel on hover; none under reduced motion.                                                                      |
| The cargo hold in 3D            | **Holo-table**                                                      | The Threlte canvas sits inside a drawn table: dark bezel, cyan edge light, four feet, a thin "projection" gradient rising from the surface. The 3D scene uses the same palette (see §4).                                                                                                  |
| Enter containers                | **Manifest sheet**                                                  | Cream paper on the table's edge with ink-blue monospace text, a stamped header ("MANIFEST"), count fields per container size drawn as stencil crate icons (1/2/4/8/16/24/32 SCU). A hand stamp (see `src/lib/cv/Hanko.svelte` for the stamp idea) marks "PACKED" when a plan is complete. |
| Fill level                      | **Cargo scale**                                                     | A vertical gauge with a needle, SCU used / SCU total in large tabular figures, per-grid bars underneath.                                                                                                                                                                                  |
| Unplaced items, warnings        | **Hazard tag**                                                      | Amber-and-black striped tag pinned to the manifest.                                                                                                                                                                                                                                       |
| Game version and data date      | **Crate stencil**                                                   | Sprayed stencil text on a crate in the footer: `DATA 4.10.1-LIVE · 2026-09-22 · SCUNPACKED`.                                                                                                                                                                                              |
| Footer                          | **Deck edge**                                                       | The floor grid runs to a glowing horizon with a banded sun (see `FooterVaporwave.svelte`); the fan-site disclaimer sits on a small metal plate.                                                                                                                                           |

Objects rest on something: the board hangs on the wall, the table stands on the floor, paper lies on the table. Every control is a native element (`<a>`, `<button>`, `<input>`, `<details>`); SVG supplies the casing, HTML supplies the accessible name.

## 2. Palette (CSS custom properties, defined once in `src/app.css`)

Taken from the portfolio's `vaporwave` theme in `src/lib/themes.css`, extended for cargo.

```css
:root {
	--bg: #241046; /* deck wall */
	--bg-deep: #160a30; /* shadows, bezels */
	--wall-1: #302046;
	--wall-2: #41304b;
	--wall-3: #201a35; /* wall gradient stops */
	--fg: #ffe9ff; /* text */
	--fg-muted: #c8a6ef; /* secondary text */
	--accent: #ff5ed1; /* magenta neon, floor grid */
	--accent-2: #35e6e6; /* cyan work light */
	--accent-2-deep: #00d9ff;
	--sun: #ffd36e; /* amber glow, hazard tags */
	--neon-pink: #ff78d6;
	--neon-cyan: #72f0e7;
	--neon-violet: #bfa0ff;
	--paper: #f3ead8;
	--paper-ink: #1d2a4a;
	--paper-shadow: #c9b99a;
	--metal: #8b747d;
	--metal-dark: #17131c;
	--focus: #c2faf2;
	/* container groups (one per contract / destination), in order */
	--crate-1: #ff5ed1;
	--crate-2: #35e6e6;
	--crate-3: #ffd36e;
	--crate-4: #bfa0ff;
	--crate-5: #7cf5b3;
	--crate-6: #ff8a5c;
	--crate-7: #d8f55c;
}
```

Backgrounds use layered gradients, never flat fills: e.g. `radial-gradient(ellipse at 85% 18%, #35e6e622, transparent 32%), radial-gradient(ellipse at 18% 22%, #d144bc35, transparent 40%), linear-gradient(var(--wall-1), var(--wall-2) 62%, var(--wall-3))` (from `workshop.css`). Low-opacity repeating gradients add wall panel seams.

## 3. Typography (same six sizes as the portfolio)

- Display: **Righteous** (`@fontsource/righteous`), uppercase, `letter-spacing: 0.06em`, weight 700, used for `h1`–`h3` and the HTML text under neon signs.
- Body and everything else (numbers, labels, controls, tables): **Space Mono** (`@fontsource/space-mono`, 400 + 700), `font-variant-numeric: tabular-nums`.
- Sizes, verbatim from the portfolio's `app.css`: `--fs-hero: clamp(2.4rem, 6vw, 4.25rem)`, `--fs-h1: clamp(1.85rem, 4.2vw, 2.9rem)`, `--fs-h2: clamp(1.25rem, 2.6vw, 1.8rem)`, `--fs-h3: 1.15rem`, `--fs-body: 1.06rem`, `--fs-small: 0.85rem`; `--lh-tight: 1.12`, `--lh-body: 1.62`. **No other font sizes.** Let text wrap; give containers room instead of shrinking type.
- Headline treatment for the room sign (from `workshop.css`): `text-shadow: 0 0 3px #fff2ff, 2px 2px 0 #b44e9f, 0 0 15px #ff5ed1, 0 0 55px #ff5ed178`.

## 4. The 3D hold (Threlte)

- Background colour equals `--bg-deep`; add `<T.Fog>` in the same hue so the table surface fades out.
- Floor: `<Grid>` from `@threlte/extras` with `cellSize={1.25}`, `sectionSize={2.5}`, cell colour cyan at low alpha, section colour magenta, `fadeDistance` so it reads as the holo-table's projection.
- Grid volumes (the cargo grids): translucent boxes with `<Edges>` in `--accent-2` at 60 % alpha and a very faint cyan fill (`opacity 0.06`); the 1.25 m cell lattice drawn as thin lines on the floor face only (not every edge of every cell, which gets noisy).
- Containers: `<InstancedMesh>` per size, matte `MeshStandardMaterial` in the group colour at reduced saturation, plus an emissive tint of the same colour so they glow slightly against the dark table; `<Edges>` only on the selected box in `--fg`.
- Ship silhouette: a wireframe bounding box from length/width/height in `--metal`, 25 % alpha, so the holds have scale context without any game mesh.
- Camera: three-quarter view from the ramp/door side by default; `CameraControls` with damping; an orthographic top-down toggle; `renderMode="on-demand"`; `dpr={[1, 2]}`.
- Lighting: one hemisphere light (violet sky, dark floor) plus one cyan directional key light from the table's edge and a faint magenta fill from the opposite side. No shadows in v1.
- Door/ramp face: a magenta arrow strip on the floor at the grid's door edge, labelled "RAMP" in a `<HTML>` overlay using `--fs-small`.

## 5. Motion

Bounded and purposeful, as in the portfolio.

| Event                       | Motion                                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------- |
| Page enter                  | Room settles from 0.94 scale and fades in over 640 ms (`cubicOut`).                                     |
| Pack complete               | Boxes drop in loading order with a 40 ms stagger (and a small bounce), so the plan reads as a sequence. |
| Hover a departure-board row | Row lifts 2 px, cyan underline draws in over 220 ms.                                                    |
| Neon signs                  | A very slow hum (opacity 0.96–1.0 over 6 s). No flicker loops that distract.                            |
| Reduced motion              | `prefers-reduced-motion: reduce` removes all of the above; the finished composition is shown directly.  |

## 6. Layout

- Room width capped at `--room-max-width: 1600px`; fluid below. Side gutter `clamp(0.9rem, 3.5vw, 2rem)`.
- Planner page on desktop: holo-table left (two thirds), manifest + scale right (one third); stacked on narrow screens with the 3D view first and a sticky fill summary.
- Phone: 16 px gutter minimum, no horizontal scroll, touch targets at least 44 px, `touch-action: none` on the canvas wrapper only.
- Focus: `outline: 3px solid var(--focus); outline-offset: 5px`.

## 7. Implementation rules

- Tailwind 4 is available for layout utilities (grid, flex, spacing). All colour, type and material come from the custom properties above and hand-written CSS in components. **No component library** (no shadcn); accessible primitives are written by hand or, if a dialog or combobox is really needed, taken from Bits UI headless.
- SVG artwork is original. Prefix `<defs>` IDs with `$props.id()` when a component can appear more than once. Decorative layers get `aria-hidden="true"` and `pointer-events: none`.
- Deterministic generative details (star scatter, wall seams) use a seeded hash, never `Math.random`, so SSR output equals client output.
- Work visually: run the dev server and look at every change in Chromium at desktop (1440 px) and phone (390 px) widths; take screenshots into `docs/screenshots/` for review.
- Footer must include: "This is an unofficial Star Citizen fan site, not affiliated with the Cloud Imperium group of companies." and the data provenance stencil.

## 8. Reference files in the portfolio clone

- `src/lib/projects/overview/NeonSign.svelte`: neon tube lettering construction.
- `src/lib/projects/overview/workshop.css`: wall gradients, ceiling, door, sign shadows, focus styles.
- `src/lib/components/footer/FooterVaporwave.svelte`: receding floor grid, horizon, banded sun.
- `src/lib/scenes/VaporwaveScene.svelte`: deterministic SVG geometry and seeded hashing.
- `src/lib/projects/CrtCabinet.svelte`, `CounterTv.svelte`: bezel and cabinet materials (model for the holo-table).
- `src/lib/cv/PaperScroll.svelte`, `src/lib/cv/Hanko.svelte`: paper texture and stamp.
- `src/app.css`, `src/lib/themes.css`: type scale and palette tokens.
- `docs/handcrafted-scenes.md`, `docs/projects-typography.md`: method and rules.
