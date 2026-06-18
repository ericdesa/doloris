import { ZoneDrag } from '../models/zone-drag.model';
import { ZONE_COLOR_PALETTE, BodyPartKey, bodyPartLabel } from '../models/body-parts';

const reverseColorMap = new Map<string, BodyPartKey>(Object.entries(ZONE_COLOR_PALETTE).map(([k, v]) => [v, k as BodyPartKey]));

/**
 * Retourne la clé anatomique (BodyPartKey) correspondant au point monde donné,
 * en cherchant dans les drags quel pinceau couvre ce point.
 * Itère en ordre inverse pour que le dernier drag l'emporte.
 */
export function resolveZoneAt(
  drags: ReadonlyArray<ZoneDrag>,
  modelRadius: number,
  meshName: string,
  wx: number,
  wy: number,
  wz: number,
): BodyPartKey | null {
  for (let i = drags.length - 1; i >= 0; i--) {
    const drag = drags[i];
    if (drag.meshName !== meshName) continue;
    const r2 = (drag.brushRadius * modelRadius) ** 2;
    for (const p of drag.points) {
      const dx = wx - p.wx,
        dy = wy - p.wy,
        dz = wz - p.wz;
      if (dx * dx + dy * dy + dz * dz < r2) {
        return reverseColorMap.get(drag.colorHex) ?? null;
      }
    }
  }
  return null;
}

export function resolveZoneLabel(
  drags: ReadonlyArray<ZoneDrag>,
  modelRadius: number,
  meshName: string,
  wx: number,
  wy: number,
  wz: number,
): string {
  const key = resolveZoneAt(drags, modelRadius, meshName, wx, wy, wz);
  return key ? bodyPartLabel(key) : bodyPartLabel(meshName);
}
