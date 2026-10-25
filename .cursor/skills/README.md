# Project gamedev skills

Subset of [awesome-gamedev-agent-skills](https://github.com/gamedev-skills/awesome-gamedev-agent-skills) for **MIND//VESSEL**.

## Engine fingerprint

No Godot / Unity / Phaser / three.js. Custom **Canvas 2D + WebGL dither** in `mind-vessel.html`. The `router` skill will not match an engine — load **discipline / genre / workflow** skills only.

## Installed (use these)

| Skill | Why it fits |
|-------|-------------|
| `router` | Dispatch to the rows below |
| `roguelike` | Genre: runs, FOV, permadeath-ish vessel, procedural sites |
| `procedural-gen` | `genRegion` / `genLevel`, seeded RNG |
| `game-ai` + `ai-behavior-trees-utility-ai` | Shared `think()` Mind priority (selector-like) |
| `create-game-assets` | `SPR` / pose / glyphs — see `docs/art-direction-brief.md` |
| `save-systems` | `mindvessel.campaign.v1` + prefs |
| `shader-programming` | Bayer dither fragment present path |
| `game-feel` | Flash, particles, mind pulse, ambient site FX |
| `game-ui-ux` | Simple/Detailed, layouts, safe-area CSS |
| `camera-systems` | Follow cam (when tuning framing/shake) |
| `performance-optimization` | Large sim + present path; profile first |
| `level-design` | Site pacing / register tiers |
| `input-systems` | Mind vs Manual, rebinding later |
| `dialogue-systems` | Only if branching yarn/ink-style talk is added |
| `physics-tuning` | Rare — soft grid motion, not rigid bodies |
| `audio-design` | When SFX/music land |
| `prototype-fast` | Still validating pillars |
| `itch-publish` / `game-jam` | Shipping / jam scope |

## Explicitly not installed

Engine packs (Godot, Unity, Unreal, Phaser, Pixi, three.js, Bevy, …) — wrong stack.
