// One room, one number: square feet, as the properties measure them. Square
// metres are derived here rather than stored, so a staff edit to one cannot
// leave the other saying something different.
const SQ_METRES_PER_SQ_FOOT = 0.092903;

export function squareMetres(sqFt: number): number {
  return Math.round(sqFt * SQ_METRES_PER_SQ_FOOT);
}

// "28 m² · 300 sq ft" — both units, because a guest booking from Kolkata and
// one booking from Frankfurt do not read the same one.
export function formatRoomSize(sqFt: number | null | undefined): string | null {
  if (!sqFt || sqFt <= 0) return null;
  return `${squareMetres(sqFt)} m² · ${sqFt.toLocaleString('en-IN')} sq ft`;
}
