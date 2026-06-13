/**
 * Référentiel des types de douleur.
 * La couleur associée à chaque type est l'élément central du code couleur
 * affiché sur le modèle 3D et dans la légende.
 */
export type PainTypeId =
  | 'burning'
  | 'stabbing'
  | 'tingling'
  | 'aching'
  | 'cramping'
  | 'numbness'
  | 'pressure'
  | 'other';

export interface PainTypeDefinition {
  id: PainTypeId;
  label: string;
  description: string;
  /** Couleur hexadécimale, utilisée à la fois pour l'UI et pour le dessin sur le modèle 3D */
  color: string;
}

export const PAIN_TYPES: PainTypeDefinition[] = [
  {
    id: 'burning',
    label: 'Brûlure',
    description: 'Sensation de chaleur, de feu',
    color: '#e0563f',
  },
  {
    id: 'stabbing',
    label: 'Décharge / élancement',
    description: 'Douleur vive, soudaine, en coup de poignard',
    color: '#f3a23a',
  },
  {
    id: 'tingling',
    label: 'Picotement / fourmillement',
    description: 'Fourmis, picotements, sensation électrique légère',
    color: '#9b6bd6',
  },
  {
    id: 'aching',
    label: 'Douleur sourde / tension',
    description: 'Gêne diffuse, tension, lourdeur',
    color: '#3a86c8',
  },
  {
    id: 'cramping',
    label: 'Crampe / spasme',
    description: 'Contraction involontaire, spasme musculaire',
    color: '#9c6644',
  },
  {
    id: 'numbness',
    label: 'Engourdissement',
    description: 'Perte de sensation, zone "endormie"',
    color: '#98a4a8',
  },
  {
    id: 'pressure',
    label: 'Pression / oppression',
    description: "Sensation d'écrasement, de poids, d'étau",
    color: '#2f9e8f',
  },
  {
    id: 'other',
    label: 'Autre',
    description: 'Sensation difficile à classer',
    color: '#6c7a82',
  },
];

export function getPainType(id: PainTypeId): PainTypeDefinition {
  return PAIN_TYPES.find((t) => t.id === id) ?? PAIN_TYPES[PAIN_TYPES.length - 1];
}

/** Caractéristiques complémentaires, cumulables, à cocher pour préciser une zone. */
export const PAIN_CHARACTERISTICS: string[] = [
  'Constante',
  'Intermittente',
  'Pulsatile',
  'Aggravée par le mouvement',
  'Aggravée la nuit',
  'Irradiante',
  'Soulagée par le repos',
  'Soulagée par le chaud',
  'Soulagée par le froid',
];
