/**
 * JavaScript port of Hugo-Dz/spritefusion-sprite-normals (MIT).
 * Same generate_normal pipeline as the Rust/WASM library.
 */
const MAX_PIXELS = 4_194_304;

const LINEAR = (() => {
  const t = new Float32Array(256);
  for (let v = 0; v < 256; v++) {
    const x = v / 255;
    t[v] = x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  }
  return t;
})();

function lightness(r, g, b) {
  const R = LINEAR[r], G = LINEAR[g], B = LINEAR[b];
  const l = (0.41222146 * R + 0.53633255 * G + 0.051445995 * B) ** (1 / 3);
  const m = (0.2119035 * R + 0.6806995 * G + 0.10739696 * B) ** (1 / 3);
  const s = (0.08830246 * R + 0.28171885 * G + 0.6299787 * B) ** (1 / 3);
  return 0.21045426 * l + 0.7936178 * m - 0.004072047 * s;
}

function defaults() {
  return {
    alpha_threshold: 0.03,
    shape_radius: 4.0,
    shape_strength: 1.15,
    shape_softness: 1.15,
    detail_strength: 6.0,
    detail_scale: 0.6,
    normal_strength: 1.5,
    normal_format: "opengl",
    invert_x: false,
    invert_y: false,
    frame_size: null,
  };
}

function parseOptions(optionsJson) {
  const d = defaults();
  let o = {};
  if (typeof optionsJson === "string") {
    try { o = JSON.parse(optionsJson || "{}"); } catch (e) { throw new Error("Invalid options: " + e.message); }
  } else if (optionsJson && typeof optionsJson === "object") o = optionsJson;
  const s = {
    alpha_threshold: d.alpha_threshold,
    shape_radius: d.shape_radius,
    shape_strength: o.volume != null ? +o.volume : (o.shape_strength != null ? +o.shape_strength : d.shape_strength),
    shape_softness: d.shape_softness,
    detail_strength: o.detail != null ? +o.detail : (o.detail_strength != null ? +o.detail_strength : d.detail_strength),
    detail_scale: o.smoothing != null ? +o.smoothing : (o.detail_scale != null ? +o.detail_scale : d.detail_scale),
    normal_strength: o.strength != null ? +o.strength : (o.normal_strength != null ? +o.normal_strength : d.normal_strength),
    normal_format: o.directx ? "directx" : (o.normal_format || d.normal_format),
    invert_x: !!o.invert_x,
    invert_y: !!o.invert_y,
    frame_size: null,
  };
  if (o.frame_width != null || o.frame_height != null) {
    if (o.frame_width == null || o.frame_height == null) throw new Error("Supply both frame_width and frame_height");
    s.frame_size = [o.frame_width | 0, o.frame_height | 0];
  } else if (o.frame_size) s.frame_size = o.frame_size;
  validate(s);
  return s;
}

function validate(s) {
  const checks = [
    ["alpha-threshold", s.alpha_threshold, 0, 0.99],
    ["shape-radius", s.shape_radius, 0.5, 512],
    ["shape-strength", s.shape_strength, 0, 8],
    ["shape-softness", s.shape_softness, 0, 8],
    ["detail-strength", s.detail_strength, 0, 8],
    ["detail-scale", s.detail_scale, 0.6, 8],
    ["normal-strength", s.normal_strength, 0, 8],
  ];
  for (const [name, value, min, max] of checks) {
    if (!Number.isFinite(value) || value < min || value > max) {
      throw new Error(`${name} must be finite and between ${min} and ${max}`);
    }
  }
  if (s.frame_size && (!s.frame_size[0] || !s.frame_size[1])) {
    throw new Error("frame-size dimensions must be positive");
  }
}

function padding(s) {
  return Math.ceil(3 * Math.max(s.shape_softness, s.detail_scale * 2)) + 3;
}

function squaredLine(source, destination, len) {
  const sites = [];
  const starts = [];
  for (let q = 0; q < len; q++) {
    const height = source[q];
    if (!Number.isFinite(height)) continue;
    let intersection = -Infinity;
    while (sites.length) {
      const p = sites[sites.length - 1];
      intersection = (height + q * q - source[p] - p * p) / (2 * (q - p));
      if (intersection > starts[starts.length - 1]) break;
      sites.pop();
      starts.pop();
    }
    if (!sites.length) intersection = -Infinity;
    sites.push(q);
    starts.push(intersection);
  }
  if (!sites.length) {
    destination.fill(Infinity, 0, len);
    return;
  }
  let active = 0;
  for (let q = 0; q < len; q++) {
    while (active + 1 < starts.length && starts[active + 1] < q) active++;
    const delta = q - sites[active];
    destination[q] = delta * delta + source[sites[active]];
  }
}

function edt(mask, width, height) {
  const data = new Float32Array(width * height);
  const source = new Float32Array(Math.max(width, height));
  const destination = new Float32Array(Math.max(width, height));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) source[x] = mask[y * width + x] ? Infinity : 0;
    squaredLine(source, destination, width);
    data.set(destination.subarray(0, width), y * width);
  }
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) source[y] = data[y * width + x];
    squaredLine(source, destination, height);
    for (let y = 0; y < height; y++) data[y * width + x] = Math.sqrt(destination[y]);
  }
  return { width, height, data };
}

function addScaled(output, source, weight, n) {
  for (let i = 0; i < n; i++) output[i] += source[i] * weight;
}

function gaussian(input, sigma) {
  if (sigma < 0.05) return { width: input.width, height: input.height, data: input.data.slice() };
  const radius = Math.ceil(sigma * 3);
  const kernel = [];
  let total = 0;
  for (let i = -radius; i <= radius; i++) {
    const w = Math.exp(-0.5 * (i / sigma) ** 2);
    kernel.push(w);
    total += w;
  }
  for (let i = 0; i < kernel.length; i++) kernel[i] /= total;
  const { width, height } = input;
  const horizontal = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    const srcRow = input.data.subarray(y * width, (y + 1) * width);
    const outRow = horizontal.subarray(y * width, (y + 1) * width);
    for (let k = 0; k < kernel.length; k++) {
      const offset = k - radius;
      const weight = kernel[k];
      const skip = Math.min(Math.abs(offset), width);
      if (offset < 0) {
        for (let i = 0; i < width - skip; i++) outRow[i + skip] += srcRow[i] * weight;
      } else {
        for (let i = 0; i < width - skip; i++) outRow[i] += srcRow[i + skip] * weight;
      }
    }
  }
  const result = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    const outRow = result.subarray(y * width, (y + 1) * width);
    for (let k = 0; k < kernel.length; k++) {
      const offset = k - radius;
      const row = y + offset;
      if (row < 0 || row >= height) continue;
      addScaled(outRow, horizontal.subarray(row * width, (row + 1) * width), kernel[k], width);
    }
  }
  return { width, height, data: result };
}

function maskedGaussian(input, weight, sigma) {
  const weighted = { width: input.width, height: input.height, data: new Float32Array(input.data.length) };
  for (let i = 0; i < input.data.length; i++) weighted.data[i] = input.data[i] * weight.data[i];
  const numerator = gaussian(weighted, sigma);
  const denominator = gaussian(weight, sigma);
  for (let i = 0; i < numerator.data.length; i++) {
    numerator.data[i] /= Math.max(denominator.data[i], 1e-8);
  }
  return numerator;
}

function sobel(field, index) {
  const d = field.data;
  const w = field.width;
  const up = index - w, down = index + w;
  const dx = (d[up + 1] + 2 * d[index + 1] + d[down + 1] - d[up - 1] - 2 * d[index - 1] - d[down - 1]) * 0.125;
  const dy = (d[down - 1] + 2 * d[down] + d[down + 1] - d[up - 1] - 2 * d[up] - d[up + 1]) * 0.125;
  return [dx, dy];
}

function slopesToNormal(dx, dyImage, settings) {
  let x = -dx * settings.normal_strength;
  let y = dyImage * settings.normal_strength;
  if (settings.normal_format === "directx") y = -y;
  if (settings.invert_x) x = -x;
  if (settings.invert_y) y = -y;
  const length = Math.sqrt(x * x + y * y + 1);
  return [x / length, y / length, 1 / length];
}

function components(mask, width, height) {
  const visited = new Uint8Array(mask.length);
  const result = [];
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || visited[start]) continue;
    const part = {
      pixels: [start],
      min_x: start % width,
      min_y: (start / width) | 0,
      max_x: start % width,
      max_y: (start / width) | 0,
    };
    visited[start] = 1;
    let cursor = 0;
    while (cursor < part.pixels.length) {
      const index = part.pixels[cursor++];
      const x = index % width, y = (index / width) | 0;
      if (x < part.min_x) part.min_x = x;
      if (x > part.max_x) part.max_x = x;
      if (y < part.min_y) part.min_y = y;
      if (y > part.max_y) part.max_y = y;
      for (let ny = Math.max(0, y - 1); ny <= Math.min(height - 1, y + 1); ny++) {
        for (let nx = Math.max(0, x - 1); nx <= Math.min(width - 1, x + 1); nx++) {
          const neighbor = ny * width + nx;
          if (mask[neighbor] && !visited[neighbor]) {
            visited[neighbor] = 1;
            part.pixels.push(neighbor);
          }
        }
      }
    }
    result.push(part);
  }
  return result;
}

function neutralMap(src, width, height) {
  const out = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    out[o] = 128; out[o + 1] = 128; out[o + 2] = 255; out[o + 3] = src[o + 3];
  }
  return out;
}

function reliefGenerate(rgba, width, height, settings) {
  const pad = padding(settings);
  const pw = width + 2 * pad, ph = height + 2 * pad;
  const opacity = new Float32Array(pw * ph);
  const lightnessF = new Float32Array(pw * ph);
  const mask = new Array(pw * ph).fill(false);
  let low = 1, high = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const si = (y * width + x) * 4;
      const alpha = rgba[si + 3] / 255;
      if (alpha <= settings.alpha_threshold) continue;
      const i = (y + pad) * pw + (x + pad);
      mask[i] = true;
      opacity[i] = alpha;
      const value = lightness(rgba[si], rgba[si + 1], rgba[si + 2]);
      lightnessF[i] = value;
      if (value < low) low = value;
      if (value > high) high = value;
    }
  }
  const mid = (low + high) * 0.5;
  for (let i = 0; i < mask.length; i++) if (mask[i]) lightnessF[i] -= mid;

  const shape = edt(mask, pw, ph);
  const reach = settings.shape_radius;
  for (let i = 0; i < shape.data.length; i++) {
    const inset = Math.max(shape.data[i] - 0.5, 0);
    shape.data[i] = settings.shape_strength * reach * Math.log1p(inset / reach);
  }
  const opacityField = { width: pw, height: ph, data: opacity };
  const lightnessField = { width: pw, height: ph, data: lightnessF };
  let combined = gaussian(shape, settings.shape_softness);
  const fine = maskedGaussian(lightnessField, opacityField, settings.detail_scale);
  const broad = maskedGaussian(lightnessField, opacityField, settings.detail_scale * 2);
  for (let i = 0; i < combined.data.length; i++) {
    combined.data[i] += settings.detail_strength * (0.7 * fine.data[i] + 0.3 * broad.data[i]);
  }
  const result = neutralMap(rgba, width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const si = (y * width + x) * 4;
      const i = (y + pad) * pw + (x + pad);
      if (!mask[i]) continue;
      const [dx, dy] = sobel(combined, i);
      const n = slopesToNormal(dx, dy, settings);
      result[si] = Math.round((n[0] * 0.5 + 0.5) * 255);
      result[si + 1] = Math.round((n[1] * 0.5 + 0.5) * 255);
      result[si + 2] = Math.round((n[2] * 0.5 + 0.5) * 255);
      result[si + 3] = rgba[si + 3];
    }
  }
  return result;
}

function getPixel(src, w, h, x, y) {
  if (x < 0 || y < 0 || x >= w || y >= h) return [0, 0, 0, 0];
  const i = (y * w + x) * 4;
  return [src[i], src[i + 1], src[i + 2], src[i + 3]];
}

function generateNormal(rgba, width, height, settings) {
  const pad = padding(settings);
  const padded = (width + 2 * pad) * (height + 2 * pad);
  if (!width || !height || padded > MAX_PIXELS) throw new Error("image is empty or exceeds the pixel processing limit");
  const [fw, fh] = settings.frame_size || [width, height];
  if (width % fw || height % fh) throw new Error("image dimensions must be exact multiples of frame-size");
  const result = neutralMap(rgba, width, height);
  for (let y0 = 0; y0 < height; y0 += fh) {
    for (let x0 = 0; x0 < width; x0 += fw) {
      const frame = new Uint8ClampedArray(fw * fh * 4);
      for (let y = 0; y < fh; y++) {
        for (let x = 0; x < fw; x++) {
          const [r, g, b, a] = getPixel(rgba, width, height, x0 + x, y0 + y);
          const i = (y * fw + x) * 4;
          frame[i] = r; frame[i + 1] = g; frame[i + 2] = b; frame[i + 3] = a;
        }
      }
      const mask = [];
      for (let i = 0; i < fw * fh; i++) mask.push(frame[i * 4 + 3] / 255 > settings.alpha_threshold);
      for (const part of components(mask, fw, fh)) {
        const iw = part.max_x - part.min_x + 1;
        const ih = part.max_y - part.min_y + 1;
        const island = new Uint8ClampedArray(iw * ih * 4);
        for (const index of part.pixels) {
          const sx = index % fw, sy = (index / fw) | 0;
          const di = ((sy - part.min_y) * iw + (sx - part.min_x)) * 4;
          const si = index * 4;
          island[di] = frame[si]; island[di + 1] = frame[si + 1];
          island[di + 2] = frame[si + 2]; island[di + 3] = frame[si + 3];
        }
        const generated = reliefGenerate(island, iw, ih, settings);
        for (const index of part.pixels) {
          const sx = index % fw, sy = (index / fw) | 0;
          const gi = ((sy - part.min_y) * iw + (sx - part.min_x)) * 4;
          const oi = ((y0 + sy) * width + (x0 + sx)) * 4;
          result[oi] = generated[gi]; result[oi + 1] = generated[gi + 1];
          result[oi + 2] = generated[gi + 2]; result[oi + 3] = generated[gi + 3];
        }
      }
    }
  }
  return result;
}

/** @param {Uint8ClampedArray|Uint8Array} rgba @param {number} width @param {number} height @param {object|string} [options] */
export function generate_normal_rgba(rgba, width, height, options = {}) {
  const settings = parseOptions(options);
  const data = generateNormal(rgba instanceof Uint8ClampedArray ? rgba : new Uint8ClampedArray(rgba), width, height, settings);
  return { data, width, height };
}

async function decodePng(bytes) {
  const blob = new Blob([bytes], { type: "image/png" });
  const bmp = await createImageBitmap(blob);
  const c = typeof OffscreenCanvas !== "undefined"
    ? new OffscreenCanvas(bmp.width, bmp.height)
    : Object.assign(document.createElement("canvas"), { width: bmp.width, height: bmp.height });
  const g = c.getContext("2d", { willReadFrequently: true });
  g.drawImage(bmp, 0, 0);
  bmp.close?.();
  const img = g.getImageData(0, 0, c.width, c.height);
  return img;
}

async function encodePng(rgba, width, height) {
  const c = typeof OffscreenCanvas !== "undefined"
    ? new OffscreenCanvas(width, height)
    : Object.assign(document.createElement("canvas"), { width, height });
  const g = c.getContext("2d");
  g.putImageData(new ImageData(new Uint8ClampedArray(rgba), width, height), 0, 0);
  const blob = c.convertToBlob
    ? await c.convertToBlob({ type: "image/png" })
    : await new Promise((res) => c.toBlob(res, "image/png"));
  return new Uint8Array(await blob.arrayBuffer());
}

/**
 * WASM-compatible entry: PNG bytes in, PNG bytes out.
 * @param {Uint8Array} bytes
 * @param {string} optionsJson
 */
export async function generate_normal_map(bytes, optionsJson = "{}") {
  const img = await decodePng(bytes);
  const settings = parseOptions(optionsJson);
  const normal = generateNormal(img.data, img.width, img.height, settings);
  const normal_png = await encodePng(normal, img.width, img.height);
  const color_png = await encodePng(img.data, img.width, img.height);
  const metadata = JSON.stringify({ width: img.width, height: img.height, animation: null });
  return {
    normal_png,
    color_png,
    metadata,
    free() {},
  };
}

/** No-op init for API parity with the wasm-bindgen package. */
export default async function init() {
  return true;
}
