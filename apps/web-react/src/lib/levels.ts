/**
 * Level colours for ANY number of levels (N comes from the data).
 * One indigo hue in OKLCH; lightness spread evenly from light (L1) to dark (top level).
 * Same algorithm as mockups/fde-redesign/ramp.js (validated with the dataviz ordinal checker for N = 3…9).
 */
export interface LevelColor {
  level: number;
  hex: string;
  /** Text colour on the fill. */
  ink: string;
}

const HUE = 277;
const L_LIGHT = 0.74;
const L_DARK = 0.24;

function oklchToRgb(L: number, C: number, hDeg: number): number[] {
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055));
}
const inGamut = (rgb: number[]) => rgb.every((v) => v >= -0.0005 && v <= 1.0005);
const clamp = (v: number) => Math.min(1, Math.max(0, v));
const toHex = (rgb: number[]) => '#' + rgb.map((v) => Math.round(clamp(v) * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
const lum = (rgb: number[]) => {
  const c = rgb.map((v) => clamp(v)).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};

const cache = new Map<number, LevelColor[]>();

/** Colours for levels 1..n, light → dark. */
export function levelRamp(n: number): LevelColor[] {
  const hit = cache.get(n);
  if (hit) return hit;
  const out: LevelColor[] = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 1 : i / (n - 1);
    const L = L_LIGHT + (L_DARK - L_LIGHT) * t;
    let C = 0.11 + 0.09 * Math.sin(Math.PI * Math.min(1, t * 1.1));
    let rgb = oklchToRgb(L, C, HUE);
    while (!inGamut(rgb) && C > 0.01) rgb = oklchToRgb(L, (C -= 0.005), HUE);
    const Y = lum(rgb);
    const cWhite = 1.05 / (Y + 0.05);
    const cInk = (Y + 0.05) / (0.0157 + 0.05);
    out.push({ level: i + 1, hex: toHex(rgb), ink: cWhite >= cInk ? '#FFFFFF' : '#1E1B4B' });
  }
  cache.set(n, out);
  return out;
}
