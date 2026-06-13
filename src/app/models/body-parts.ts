/**
 * Correspondance entre le nom technique d'un maillage du modèle 3D
 * et son libellé en français, utilisé dans la liste des zones et le
 * compte-rendu destiné au médecin.
 *
 * Le modèle de secours (généré si aucun fichier .glb n'est fourni dans
 * src/assets/models/body.glb) utilise exactement ces noms. Si vous chargez
 * votre propre modèle anatomique, complétez ce dictionnaire avec les noms
 * des maillages de votre fichier (visibles dans la console au chargement).
 */
export const BODY_PART_LABELS: Record<string, string> = {
  tete: 'Tête',
  tete_face: 'Tête',
  cou: 'Cou',
  torse: 'Torse',
  dos: 'Dos',
  bassin: 'Bassin',
  fesse_gauche: 'Fesse gauche',
  fesse_droite: 'Fesse droite',
  bras_gauche: 'Bras gauche',
  bras_gauche_dos: 'Bras gauche',
  bras_gauche_avant: 'Bras gauche',
  avant_bras_gauche: 'Avant-bras gauche',
  main_gauche: 'Main gauche',
  bras_droit: 'Bras droit',
  bras_droit_dos: 'Bras droit',
  bras_droit_avant: 'Bras droit',
  avant_bras_droit: 'Avant-bras droit',
  main_droite: 'Main droite',
  cuisse_gauche: 'Cuisse gauche',
  cuisse_gauche_dos: 'Cuisse gauche',
  cuisse_gauche_avant: 'Cuisse gauche',
  jambe_gauche: 'Jambe gauche',
  jambe_gauche_dos: 'Jambe gauche',
  pied_gauche: 'Pied gauche',
  cuisse_droite: 'Cuisse droite',
  cuisse_droite_dos: 'Cuisse droite',
  cuisse_droite_avant: 'Cuisse droite',
  jambe_droite: 'Jambe droite',
  jambe_droite_dos: 'Jambe droite',
  pied_droit: 'Pied droit',
};

export function bodyPartLabel(meshName: string): string {
  return BODY_PART_LABELS[meshName] ?? meshName;
}

// Centroïdes en espace normalisé :
//   nx ∈ [-1,+1]  gauche→droite  (wx - centerX) / (sizeX/2)
//   ny ∈ [0,1]    bas→haut       (wy - minY)    / sizeY
//   nz ∈ [-1,+1]  dos→ventre     (wz - centerZ) / (sizeZ/2)  (Three.js : +Z vers la caméra)
//
// Les clés _dos / _avant / _face sont des centroïdes directionnels qui partagent
// le même libellé que leur partie principale. Ils évitent que les zones directionnelles
// (fesses nz=-0.7, torse/bassin nz>0) capturent les membres vus de face ou de dos.
export const BODY_PART_CENTROIDS: ReadonlyArray<{ key: string; nx: number; ny: number; nz: number }> = [
  { key: 'tete',                  nx:  0.000, ny: 0.938, nz: +0.00 },
  { key: 'tete_face',             nx:  0.000, ny: 0.910, nz: +0.40 },
  { key: 'cou',                   nx:  0.000, ny: 0.862, nz: +0.00 },
  { key: 'torse',                 nx: -0.001, ny: 0.763, nz: +0.51 },
  { key: 'dos',                   nx:  0.000, ny: 0.650, nz: -0.70 },
  { key: 'bassin',                nx:  0.000, ny: 0.512, nz: +0.40 },
  { key: 'fesse_gauche',          nx: -0.202, ny: 0.504, nz: -0.75 },
  { key: 'fesse_droite',          nx:  0.200, ny: 0.499, nz: -0.74 },
  { key: 'bras_gauche',           nx: -0.500, ny: 0.706, nz: +0.00 },
  { key: 'bras_gauche_dos',       nx: -0.504, ny: 0.740, nz: -0.89 },
  { key: 'bras_gauche_avant',     nx: -0.560, ny: 0.724, nz: -0.02 },
  { key: 'avant_bras_gauche',     nx: -0.729, ny: 0.633, nz: -0.14 },
  { key: 'main_gauche',           nx: -0.926, ny: 0.512, nz: +0.03 },
  { key: 'bras_droit',            nx:  0.500, ny: 0.706, nz: +0.00 },
  { key: 'bras_droit_dos',        nx:  0.491, ny: 0.733, nz: -0.91 },
  { key: 'bras_droit_avant',      nx:  0.537, ny: 0.719, nz: +0.01 },
  { key: 'avant_bras_droit',      nx:  0.724, ny: 0.632, nz: -0.14 },
  { key: 'main_droite',           nx:  0.937, ny: 0.509, nz: +0.02 },
  { key: 'cuisse_gauche',         nx: -0.209, ny: 0.356, nz: +0.00 },
  { key: 'cuisse_gauche_dos',     nx: -0.209, ny: 0.375, nz: -0.55 },
  { key: 'cuisse_gauche_avant',   nx: -0.209, ny: 0.375, nz: +0.50 },
  { key: 'jambe_gauche',          nx: -0.315, ny: 0.143, nz: -0.13 },
  { key: 'jambe_gauche_dos',      nx: -0.295, ny: 0.240, nz: -0.76 },
  { key: 'pied_gauche',           nx: -0.379, ny: 0.046, nz: -0.35 },
  { key: 'cuisse_droite',         nx:  0.209, ny: 0.356, nz: +0.00 },
  { key: 'cuisse_droite_dos',     nx:  0.209, ny: 0.375, nz: -0.55 },
  { key: 'cuisse_droite_avant',   nx:  0.209, ny: 0.375, nz: +0.50 },
  { key: 'jambe_droite',          nx:  0.289, ny: 0.140, nz: -0.16 },
  { key: 'jambe_droite_dos',      nx:  0.308, ny: 0.232, nz: -0.77 },
  { key: 'pied_droit',            nx:  0.387, ny: 0.037, nz: -0.32 },
];

/**
 * Retourne la clé de `BODY_PART_LABELS` la plus proche d'un point normalisé.
 * nx = (wx - centerX) / (sizeX/2)  [-1 … +1]
 * ny = (wy - minY)    / sizeY       [0 … 1]
 * nz = (wz - centerZ) / (sizeZ/2)  [-1 … +1]  dos=-1, ventre=+1
 */
export function inferBodyPartKey(nx: number, ny: number, nz: number): string {
  let best = BODY_PART_CENTROIDS[0].key;
  let bestDist = Infinity;
  for (const c of BODY_PART_CENTROIDS) {
    // ny (hauteur) pèse 2× — discriminant principal tête/cou/torse/jambes.
    // nz (avant/arrière) pèse 0.5× — évite que la face avant de la tête soit
    // confondue avec le torse dont le centroïde est très avancé (nz=+0.7).
    const d = (nx - c.nx) ** 2 + 2 * (ny - c.ny) ** 2 + 0.5 * (nz - c.nz) ** 2;
    if (d < bestDist) { bestDist = d; best = c.key; }
  }
  return best;
}

export interface BodyPartCandidate {
  key: string;
  label: string;
  dist: number;
}

/** Retourne le classement complet des parties du corps pour un point normalisé. */
export function inferBodyPartDebug(nx: number, ny: number, nz: number): {
  winner: string;
  nx: number; ny: number; nz: number;
  candidates: BodyPartCandidate[];
} {
  const candidates = BODY_PART_CENTROIDS.map(c => ({
    key: c.key,
    label: BODY_PART_LABELS[c.key] ?? c.key,
    dist: Math.sqrt((nx - c.nx) ** 2 + 2 * (ny - c.ny) ** 2 + 0.5 * (nz - c.nz) ** 2),
  })).sort((a, b) => a.dist - b.dist);
  return { winner: candidates[0].key, nx, ny, nz, candidates };
}
