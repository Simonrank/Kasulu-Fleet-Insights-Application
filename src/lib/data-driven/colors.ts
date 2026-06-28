/** Stable colour from a string key — no fixed type → colour map. */
export function colorFromKey(key: string, index = 0): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (Math.imul(31, hash) + key.charCodeAt(i)) | 0;
  }
  const hue = Math.abs(hash + index * 47) % 360;
  return `hsl(${hue} 55% 48%)`;
}
