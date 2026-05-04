// Lightweight computer-vision helpers used by Color Hunt and Shape Detective.
// Goals: detect ONLY the foreground object (largest connected blob), not the
// whole frame. Pure JS — no OpenCV — but uses small downscaled buffers so it
// runs comfortably at 20–30 FPS on phones/laptops.

export type Pt = { x: number; y: number };
export type BBox = { x: number; y: number; w: number; h: number };

export type ColorName =
  | "red" | "orange" | "yellow" | "green" | "blue"
  | "purple" | "pink" | "white" | "black" | "brown";

export type ShapeName =
  | "triangle" | "square" | "rectangle" | "pentagon"
  | "hexagon" | "circle" | "oval";

export const COLOR_META: Record<ColorName, { label: string; swatch: string; emoji: string }> = {
  red:    { label: "red",    swatch: "#ef4444", emoji: "🍎" },
  orange: { label: "orange", swatch: "#f97316", emoji: "🍊" },
  yellow: { label: "yellow", swatch: "#facc15", emoji: "🍌" },
  green:  { label: "green",  swatch: "#22c55e", emoji: "🥦" },
  blue:   { label: "blue",   swatch: "#3b82f6", emoji: "🫐" },
  purple: { label: "purple", swatch: "#a855f7", emoji: "🍇" },
  pink:   { label: "pink",   swatch: "#ec4899", emoji: "🌸" },
  white:  { label: "white",  swatch: "#f8fafc", emoji: "☁️" },
  black:  { label: "black",  swatch: "#0f172a", emoji: "🖤" },
  brown:  { label: "brown",  swatch: "#92400e", emoji: "🪵" },
};

// ---------------- color space ----------------
export function rgb2hsv(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d === 0) h = 0;
  else if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h = Math.round(h * 60);
  if (h < 0) h += 360;
  const s = max === 0 ? 0 : d / max;
  const v = max;
  return { h, s, v };
}

export function classifyHSV(h: number, s: number, v: number): ColorName | null {
  // achromatic
  if (v < 0.18) return "black";
  if (s < 0.18 && v > 0.85) return "white";
  if (s < 0.22) return null; // gray — ambiguous, ignore
  // brown is dark/desaturated orange-red
  if (v < 0.55 && s > 0.25 && (h < 35 || h >= 345)) return "brown";
  if (h < 12 || h >= 345) return "red";
  if (h < 38)  return "orange";
  if (h < 65)  return "yellow";
  if (h < 170) return "green";
  if (h < 250) return "blue";
  if (h < 290) return "purple";
  if (h < 345) return "pink";
  return null;
}

// ---------------- segmentation ----------------
// Build a binary mask of the foreground object using saturation/value plus
// edge-from-mean fallback. Returns mask + dominant color of the object only.
export function segmentObject(
  data: Uint8ClampedArray, W: number, H: number,
): { mask: Uint8Array; bbox: BBox | null; color: ColorName | null; pixelCount: number } {
  const N = W * H;
  const mask = new Uint8Array(N);

  // First pass: collect HSV stats and a saturated/dark/bright mask.
  // Foreground heuristic: pixel is "interesting" when it is meaningfully
  // saturated OR clearly darker/brighter than the frame mean (objects).
  let meanV = 0;
  const hs = new Float32Array(N), ss = new Float32Array(N), vs = new Float32Array(N);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    const { h, s, v } = rgb2hsv(data[i], data[i + 1], data[i + 2]);
    hs[j] = h; ss[j] = s; vs[j] = v; meanV += v;
  }
  meanV /= N;

  let fgCount = 0;
  for (let j = 0; j < N; j++) {
    const s = ss[j], v = vs[j];
    const sat = s > 0.30 && v > 0.20;
    const dark = v < meanV - 0.18;
    const bright = v > meanV + 0.20 && s < 0.25; // bright achromatic (paper)
    if (sat || dark || bright) { mask[j] = 1; fgCount++; }
  }
  // If almost everything is "foreground", drop the bright-achromatic side
  // (likely a bright background); keep only saturated/dark.
  if (fgCount > N * 0.55) {
    fgCount = 0;
    for (let j = 0; j < N; j++) {
      const s = ss[j], v = vs[j];
      const keep = (s > 0.30 && v > 0.20) || v < meanV - 0.18;
      mask[j] = keep ? 1 : 0;
      if (keep) fgCount++;
    }
  }

  // Erode + dilate (3x3) — denoise.
  const tmp = new Uint8Array(N);
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      tmp[i] = mask[i] && mask[i - 1] && mask[i + 1] && mask[i - W] && mask[i + W] ? 1 : 0;
    }
  }
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      mask[i] = tmp[i] || tmp[i - 1] || tmp[i + 1] || tmp[i - W] || tmp[i + W] ? 1 : 0;
    }
  }

  // Connected-component labeling — keep only the largest blob
  // touching/near center area when possible.
  const labels = new Int32Array(N);
  const sizes: number[] = [0];
  const stack: number[] = [];
  let bestLabel = 0, bestSize = 0;
  let bestMinX = 0, bestMinY = 0, bestMaxX = 0, bestMaxY = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const start = y * W + x;
      if (!mask[start] || labels[start]) continue;
      const lbl = sizes.length;
      sizes.push(0);
      stack.push(start);
      labels[start] = lbl;
      let count = 0, minX = x, minY = y, maxX = x, maxY = y;
      while (stack.length) {
        const i = stack.pop()!;
        const px = i % W, py = (i / W) | 0;
        count++;
        if (px < minX) minX = px; if (py < minY) minY = py;
        if (px > maxX) maxX = px; if (py > maxY) maxY = py;
        if (px > 0     && mask[i - 1]    && !labels[i - 1])    { labels[i - 1] = lbl; stack.push(i - 1); }
        if (px < W - 1 && mask[i + 1]    && !labels[i + 1])    { labels[i + 1] = lbl; stack.push(i + 1); }
        if (py > 0     && mask[i - W]    && !labels[i - W])    { labels[i - W] = lbl; stack.push(i - W); }
        if (py < H - 1 && mask[i + W]    && !labels[i + W])    { labels[i + W] = lbl; stack.push(i + W); }
      }
      sizes[lbl] = count;
      if (count > bestSize) {
        bestSize = count; bestLabel = lbl;
        bestMinX = minX; bestMinY = minY; bestMaxX = maxX; bestMaxY = maxY;
      }
    }
  }

  if (bestSize < N * 0.01) {
    return { mask: new Uint8Array(N), bbox: null, color: null, pixelCount: 0 };
  }

  // Build single-blob mask + dominant color from inside it
  const out = new Uint8Array(N);
  const counts: Record<string, number> = {};
  for (let j = 0; j < N; j++) {
    if (labels[j] === bestLabel) {
      out[j] = 1;
      const c = classifyHSV(hs[j], ss[j], vs[j]);
      if (c) counts[c] = (counts[c] || 0) + 1;
    }
  }
  let bestColor: ColorName | null = null, bcc = 0;
  for (const k of Object.keys(counts) as ColorName[]) {
    if (counts[k] > bcc) { bcc = counts[k]; bestColor = k; }
  }
  if (bcc < bestSize * 0.25) bestColor = null;

  return {
    mask: out,
    bbox: { x: bestMinX, y: bestMinY, w: bestMaxX - bestMinX + 1, h: bestMaxY - bestMinY + 1 },
    color: bestColor,
    pixelCount: bestSize,
  };
}

// ---------------- contour ----------------
export function traceContour(mask: Uint8Array, W: number, H: number, bbox: BBox): Pt[] {
  // Find first foreground pixel in bbox
  let sx = -1, sy = -1;
  outer:
  for (let y = bbox.y; y < bbox.y + bbox.h; y++) {
    for (let x = bbox.x; x < bbox.x + bbox.w; x++) {
      if (mask[y * W + x]) { sx = x; sy = y; break outer; }
    }
  }
  if (sx < 0) return [];
  const dx = [-1, -1, 0, 1, 1, 1, 0, -1];
  const dy = [0, -1, -1, -1, 0, 1, 1, 1];
  const pts: Pt[] = [];
  let cx = sx, cy = sy, prev = 6;
  const maxSteps = (bbox.w + bbox.h) * 4 + 200;
  for (let i = 0; i < maxSteps; i++) {
    pts.push({ x: cx, y: cy });
    let found = false;
    const start = (prev + 6) % 8;
    for (let k = 0; k < 8; k++) {
      const d = (start + k) % 8;
      const nx = cx + dx[d], ny = cy + dy[d];
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      if (mask[ny * W + nx]) { cx = nx; cy = ny; prev = d; found = true; break; }
    }
    if (!found) break;
    if (cx === sx && cy === sy && pts.length > 4) break;
  }
  return pts;
}

function perpDist(p: Pt, a: Pt, b: Pt) {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (dx === 0 && dy === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export function rdp(points: Pt[], epsilon: number): Pt[] {
  if (points.length < 3) return points;
  let maxD = 0, idx = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpDist(points[i], points[0], points[points.length - 1]);
    if (d > maxD) { maxD = d; idx = i; }
  }
  if (maxD > epsilon) {
    const left = rdp(points.slice(0, idx + 1), epsilon);
    const right = rdp(points.slice(idx), epsilon);
    return left.slice(0, -1).concat(right);
  }
  return [points[0], points[points.length - 1]];
}

export function classifyShape(contour: Pt[], bbox: BBox): ShapeName | null {
  if (contour.length < 30) return null;
  const bw = bbox.w, bh = bbox.h;
  if (bw < 24 || bh < 24) return null;

  let peri = 0;
  for (let i = 1; i < contour.length; i++) {
    peri += Math.hypot(contour[i].x - contour[i - 1].x, contour[i].y - contour[i - 1].y);
  }
  const eps = 0.035 * peri;
  const poly = rdp(contour, eps);
  const corners = poly.length - 1;

  let area = 0;
  for (let i = 0; i < contour.length - 1; i++) {
    area += contour[i].x * contour[i + 1].y - contour[i + 1].x * contour[i].y;
  }
  area = Math.abs(area) / 2;
  const circ = (4 * Math.PI * area) / (peri * peri || 1);
  const aspect = bw / bh;

  if (circ > 0.78) return aspect > 0.78 && aspect < 1.28 ? "circle" : "oval";
  if (corners === 3) return "triangle";
  if (corners === 4) {
    if (aspect > 0.78 && aspect < 1.28) return "square";
    return "rectangle";
  }
  if (corners === 5) return "pentagon";
  if (corners === 6) return "hexagon";
  if (corners > 6 && circ > 0.65) return aspect > 0.78 && aspect < 1.28 ? "circle" : "oval";
  return null;
}
