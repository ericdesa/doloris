import { PainZone, UvPoint } from '../models/pain-zone.model';

/** Convertit une couleur hexadécimale (#rrggbb) en chaîne rgba() avec une opacité donnée. */
export function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Recherche la zone la plus proche d'un point UV donné, sur un maillage donné,
 * en se basant sur la distance aux points du tracé. Utilisée en mode
 * "sélection" pour cliquer sur une zone existante.
 */
export function findZoneAtUv(zones: PainZone[], meshName: string, uv: UvPoint): PainZone | null {
  let best: { zone: PainZone; distance: number } | null = null;

  for (const zone of zones) {
    if (zone.meshName !== meshName) continue;
    for (const point of zone.points) {
      const du = point.u - uv.u;
      const dv = point.v - uv.v;
      const distance = Math.sqrt(du * du + dv * dv);
      if (distance <= zone.brushRadius) {
        if (!best || distance < best.distance) {
          best = { zone, distance };
        }
      }
    }
  }

  return best?.zone ?? null;
}
