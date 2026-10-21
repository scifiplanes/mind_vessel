# Sprite Fusion Sprite Normals (JS port)

Faithful JavaScript port of the MIT-licensed generator from
[Hugo-Dz/spritefusion-sprite-normals](https://github.com/Hugo-Dz/spritefusion-sprite-normals)
(same relief pipeline: EDT silhouette volume + Oklab shading detail + Sobel normals).

Used by Mind Vessel when a Rust/`wasm-bindgen` build of the upstream crate is not available.
API mirrors the WASM module:

```js
import init, { generate_normal_rgba, generate_normal_map } from "./spritefusion_sprite_normals.js";
await init();
const { data, width, height } = generate_normal_rgba(rgbaUint8Clamped, w, h, { strength: 1.5 });
```

`generate_normal_map(pngBytes, optionsJson)` returns `{ normal_png, color_png, metadata, free }`
(async PNG encode via canvas). Prefer `generate_normal_rgba` for in-engine baking.

Copyright for the algorithm: Hugo Duprez — see `LICENSE`.
