import { PainTypeId } from './pain-types';

/** Point de coordonnées UV (0..1) sur la texture d'un maillage du modèle 3D. */
export interface UvPoint {
  u: number;
  v: number;
  /** Position monde du hit (world-space painting). Absent dans les données anciennes. */
  wx?: number;
  wy?: number;
  wz?: number;
}

/**
 * Une "zone de douleur" correspond à un tracé libre dessiné sur une partie
 * du corps (un maillage du modèle 3D). Le tracé est mémorisé sous forme de
 * points UV afin de pouvoir être redessiné sur la texture à tout moment
 * (changement de couleur, export, ré-affichage...).
 */
export interface PainZone {
  id: string;
  /** Nom du maillage du modèle 3D sur lequel la zone a été dessinée. */
  meshName: string;
  /** Libellé lisible de la partie du corps (pour affichage / compte-rendu). */
  bodyPartLabel: string;
  type: PainTypeId;
  /** Intensité de la douleur, échelle de 1 (légère) à 10 (insupportable). */
  intensity: number;
  /** Caractéristiques cochées (cf. PAIN_CHARACTERISTICS). */
  characteristics: string[];
  /** Notes libres du patient. */
  notes: string;
  /** Rayon du tracé en coordonnées UV (0..1), utilisé pour le dessin et la sélection. */
  brushRadius: number;
  /** Points successifs du tracé libre, en coordonnées UV. */
  points: UvPoint[];
  createdAt: string;
  updatedAt: string;
}

export type PainZoneDraft = Pick<PainZone, 'type' | 'intensity' | 'characteristics' | 'notes' | 'brushRadius'>;

export function createDefaultDraft(): PainZoneDraft {
  return {
    type: 'aching',
    intensity: 5,
    characteristics: [],
    notes: '',
    brushRadius: 0.015,
  };
}
