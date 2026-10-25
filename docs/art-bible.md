# MIND//VESSEL — Art Bible (locked · applied)

**Status:** Applied — Canvas 2D hard-pixel + Bayer dither + **restrained set-only DoF**.  
**Approved / applied:** 2026-10-25  
**Seed:** Pose cast `.preview-res/53-pose-end-assets-hero.png`; native target `.preview-res/61-canvas2d-locked-viewport.png`.  
**Companion:** `docs/art-direction-brief.md` · **Manifest:** `docs/asset-manifest.json`

One request → one asset inside this bible. No per-request style redesign.  
Mesh-3D prototype was reverted; **DoF stays** as a 2D set pass (`applySetDof`, `DBG.dof` / `DBG.dofMax`).

---

## 0. Frame

| Axis | Lock |
|------|------|
| Genre | Indirect-control roguelike (Mind / Thoughts) |
| Camera | Top-down orthographic; ±X facing; follow vessel |
| Platform | Desktop + phone browsers |
| Renderer | Canvas 2D scene + light pass; WebGL Bayer present; nearest only |
| Scale | `RES=4` → `SS=40`; SPR **10×10**; glyphs **7×7** |
| Actor footprint | ~40×40 device px at RES=4 |

---

## 1. Visual language

Hard-pixel actors, props, items, UI glyphs, and FX. Soft radial light + site tint + Bayer grain bind the frame. **DoF before dither:** compose sharp scene → restrained DoF (soft far field, sharp ~8-tile focus disk) → Bayer present. Never blur post-dither output. No photoreal meshes, no full 3D set, no bilinear sprite upscale.

---

## 2. Palette

**UI:** `#b4b4b4` bg, `#121212` fg, `#8a5000` amber, `#9a1410` red, `#0a5e62` cyan (+ dark theme vars).  
**Actors:** exactly 4 slots `a/b/c/e` from `SPECIES`/`KIND`. Eyes (`e`) + ground contact first.

Canonical: Crab `#7a4a3a #3b2520 #a8705a #d8c060` · Rig `#8aa0a4 #2a383c #d0e4e8 #5cc4c4` · Skeleton `#8a8270 #4a4438 #c8c0a8 #501818`.

---

## 3. Silhouette & proportion

Chunky mass; pose-class grammar; feet in lower mask / bake ≈ `(5,5.2)`; no thin 1-px-only identity; facing ±X.

---

## 4. Materials / lighting / DoF

Mask letters = material roles. Site ambient + soft radial light + Bayer. **Hard 1-px footing** under actors — never soft alpha drop shadows.  
**DoF:** `DBG.dof` (default on), blur px `DBG.dofMax` (default 2.4); sharp disk ~8 tiles around vessel; applied in `draw` via `applyDofBeforeDither()` immediately before `presentFrame()`; respects `prefers-reduced-motion`.

---

## 5. UI / icons

7×7 glyphs; Perfect DOS type; amber/red/cyan semantics; hard steps; Simple mode non-verbal defaults.

---

## 6. Motion

Pose lunge/bob/scramble; brief flash/particles; ortho follow; nearest scale at all zooms.

---

## 7. Specs

| Family | Spec |
|--------|------|
| `SPR` | 10×10 · `.a b c e` · hard alpha |
| Pose | SS×SS bake · nearest · feet pivot |
| Glyphs | 7×7 |
| Present | Bayer default 8×8, levels 16; `imageSmoothingEnabled=false` |
| Delivery | In-code masks/strokes preferred |

---

## 8. Avoid

1. Photoreal / soft-3D character or item replacements  
2. Full mesh-3D world as production path  
3. DoF that melts focus-band sprite contours  
4. Bilinear / “realistic” sprite upscale  
5. Soft drop shadows under actors  
6. AA outlines, emoji, Inter/Roboto  
7. Palette bloat; text baked into art; copying another game’s cast  

---

## 9. Readability

Judge at `#cv` post-dither size. Grayscale actor-vs-floor. Phone hit targets ≥ ~40 CSS px.
