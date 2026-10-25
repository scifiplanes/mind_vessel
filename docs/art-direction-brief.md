# Art direction brief — MIND//VESSEL

Filled from the `create-game-assets` skill. Lock this before adding external or generated art.

## Game frame

- Player fantasy: Shape a Mind of Thoughts while a vessel acts alone in a persistent industrial-organic underworld.
- Core verbs: Extract, refine, build, fight, travel ducts, study, rest, gossip — never direct walk (Mind / Manual exception).
- Engine and renderer: Custom browser game — Canvas 2D scene + light pass; WebGL Bayer ordered-dither present; nearest-neighbor only.
- Target platforms: Desktop + phone browsers; static HTML; no asset CDN.
- Camera/view/facing: Top-down orthographic grid; actors face ±X (and mild faceY); camera follows vessel.
- Native viewport and common display scale: Logical world uses `RES=4` → cell `SS=40` px (`10×RES`). Scene canvas ≈ `320×156` logical tiles × `RES`.
- Typical asset size on screen: Creature footprint ~10×10 logical px (~40×40 device px at RES=4), often smaller when zoomed out on region map.

## Visual system

- Shape language: Chunky silhouettes, few protruding limbs; register families share body grammar (Bone soft/organic, Plate hard/mechanical, Lease live/tubular).
- Silhouette priorities: Head/eye cluster (`e` palette slot) and ground contact must read at native scale; no thin single-pixel limbs as sole identity.
- Value structure: 3–4 value bands per sprite (dark ground contact → mid body → lit face → eye spark). Readable in grayscale over mid-grey floors.
- Palette roles and exact swatches:
  - UI chrome: CSS vars `--bg/#b4b4b4`, `--fg/#121212`, `--amber/#8a5000`, `--red/#9a1410`, `--cyan/#0a5e62` (dark theme variants in `:root`).
  - World: per-species/kind 4-slot palettes in `SPECIES` / `KIND` (`a,b,c,e` mask letters in `SPR`).
  - Diegetic opportunity ticks: amber; danger/hostility: red; power/ok: cyan.
- Materials and surface cues: Mask letters encode material roles (bone/plate/flesh/glow), not photoreal albedo. Dither posterizes the whole frame — do not author soft gradients in sprites.
- Edge/line treatment: Hard pixel clusters; no anti-aliased outlines. Pose strokes are thick canvas dots/segments that bake to the same cluster language.
- Lighting direction and contrast: Soft radial light overlay + site ambient tint; Bayer dither is the film grain. Prefer high local contrast on actors vs floor. Restrained DoF (`applyDofBeforeDither`) runs on the finished scene **before** Bayer present; sharp ~8-tile focus disk (`DBG.dof` / `DBG.dofMax`).
- Detail density and focal hierarchy: Eyes and tools first; environment tiles flatter. Glyph UI (7×7 `GLYPH`) stays more iconic than world SPR.
- Motion character: Short lunge/bob/scramble via pose joints; flash on hit; particles for ambient site phase — juice is brief, not continuous wobble.
- Explicit exclusions:
  - Photoreal / painterly / soft 3D renders as production sprites (`.preview-res/*photoreal*` are experiments only).
  - Smooth anti-aliased character art, drop shadows under actors, emoji, Inter/Roboto UI fonts.
  - Text baked into sprites; mockup chrome; duplicate subjects in one frame.

## Technical contract

- Asset dimensions/aspect: Author at 10×10 masks (`SPR`) or stroke pose bake to `SS×SS` canvas; never upsample with bilinear.
- Alpha/background: Transparent outside mask; no checkerboard baked in.
- Grid/tile/frame size: World tile = 1 cell; sprite mask 10×10; glyph 7×7.
- Anchor/pivot/baseline: Feet near bottom of mask; pose bake recenters to ~`(5, 5.2)`.
- Filtering/mipmaps/compression: `imageSmoothingEnabled=false` everywhere; no mipmaps.
- Color space: sRGB hex in code; dither levels configurable (`DBG.levels`, default 16).
- Texture/poly/material budgets: All art inlined in `mind-vessel.html` / `sim/game.js` — prefer editing masks over adding PNG atlases.
- Naming and folders: `SPR.<kind>`, species/kind ids lowercase; UI glyphs in `GLYPH` / `VERB_G` / `COND_G`. Preview dumps may land in `.preview-res/` (non-shipping).

## Visual target

- Approved seed/reference paths:
  - In-game capture of vessel + one Bone/Plate/Lease creature at RES=4 with dither on (Bayer 8×8).
  - Mask examples: `SPR.crab`, `SPR.rig`, `SPR.kilncrab`, `SPR.tokenwight`.
  - Font: `PerfectDOS.ttf` (Perfect DOS VGA 437) + VT323 fallback.
- Required do/don't examples:
  - **Do:** Edit 10×10 masks or pose stroke tables; keep 4-slot palettes; check at native scale with dither.
  - **Don't:** Ship photoreal hero sheets, rounded-rect card art, or smooth shaded PNG replacements for `SPR`.
- Native-scale gameplay capture: Prefer `#cv` present path (post-dither) over raw scene canvas. Applied target: `.preview-res/61-canvas2d-locked-viewport.png`.
- Approval owner/date: Applied 2026-10-25 (Canvas 2D lock; 3D+DoF reverted). Re-approve only if redesign is intentional.
