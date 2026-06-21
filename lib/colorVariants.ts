function hexToRgb(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, "0");
  return `#${clamp(r)}${clamp(g)}${clamp(b)}`;
}

/** Mezcla `hex` hacia blanco (factor > 0) o hacia negro (factor < 0). factor en [-1, 1]. */
export function blendHex(hex: string, factor: number): string {
  const [r, g, b] = hexToRgb(hex);
  const target = factor >= 0 ? 255 : 0;
  const f = Math.abs(factor);
  return rgbToHex(r + (target - r) * f, g + (target - g) * f, b + (target - b) * f);
}

/**
 * Color de una subcategoría derivado del color de su padre: mismo tono base,
 * con un matiz de luminosidad distinto según su posición entre sus hermanas
 * (la del medio conserva el color exacto del padre).
 */
export function siblingColor(parentHex: string, index: number, count: number): string {
  if (count <= 1) return parentHex;
  const STEP = 0.22;
  const offset = (index - (count - 1) / 2) * STEP;
  return blendHex(parentHex, offset);
}
