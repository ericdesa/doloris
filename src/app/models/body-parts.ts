/**
 * Correspondance entre le nom technique d'un maillage du modèle 3D
 * et son libellé en français, utilisé dans la liste des zones et le
 * compte-rendu destiné au médecin.
 */
export const BODY_PART_LABELS = {
  tete:               'Tête',
  visage:             'Visage',
  cou:                'Cou',

  thorax:             'Thorax',
  abdomen:            'Abdomen',

  dos:                'Dos',
  lombaires:          'Lombaires',

  bassin:             'Bassin',
  fesse_gauche:       'Fesse gauche',
  fesse_droite:       'Fesse droite',

  epaule_gauche:      'Epaule gauche',
  bras_gauche:        'Bras gauche',
  coude_gauche:       'Coude gauche',
  avant_bras_gauche:  'Avant-bras gauche',
  main_gauche:        'Main gauche',

  epaule_droite:      'Epaule droite',
  bras_droit:         'Bras droit',
  coudes_droit:       'Coude droit',
  avant_bras_droit:   'Avant-bras droit',
  main_droite:        'Main droite',

  cuisse_gauche:      'Cuisse gauche',
  genoux_gauche:      'Genoux gauche',
  jambe_gauche:       'Jambe gauche',
  mollet_gauche:      'Mollet gauche',
  pied_gauche:        'Pied gauche',

  cuisse_droite:      'Cuisse droite',
  genoux_droite:      'Genoux droite',
  jambe_droite:       'Jambe droite',
  mollet_droite:      'Mollet droite',
  pied_droit:         'Pied droit',
} satisfies Record<string, string>;

export type BodyPartKey = keyof typeof BODY_PART_LABELS;

export function bodyPartLabel(meshName: string): string {
  return (BODY_PART_LABELS as Record<string, string>)[meshName] ?? meshName;
}

/**
 * Palette de couleurs par défaut pour la carte de zones peinte manuellement.
 * Familles : rouge=tête·visage, orange=cou, bleu=thorax·abdomen·dos·lombaires,
 * teal=bassin·fesses, violet=bras gauche, vert=bras droit,
 * jaune=jambe gauche, rose=jambe droite.
 */
export const ZONE_COLOR_PALETTE: Readonly<Record<BodyPartKey, string>> = {
  // Tête / cou
  tete:               '#e74c3c',
  visage:             '#c0392b',
  cou:                '#e67e22',
  // Torse
  thorax:             '#3498db',
  abdomen:            '#2980b9',
  // Dos
  dos:                '#1a6ea8',
  lombaires:          '#154f78',
  // Bassin / fesses
  bassin:             '#1abc9c',
  fesse_gauche:       '#16a085',
  fesse_droite:       '#0e8c75',
  // Bras gauche
  epaule_gauche:      '#9b59b6',
  bras_gauche:        '#8e44ad',
  coude_gauche:       '#7d3c98',
  avant_bras_gauche:  '#6c3483',
  main_gauche:        '#4a235a',
  // Bras droit
  epaule_droite:      '#2ecc71',
  bras_droit:         '#27ae60',
  coudes_droit:       '#229954',
  avant_bras_droit:   '#1e8449',
  main_droite:        '#145a32',
  // Jambe gauche
  cuisse_gauche:      '#f39c12',
  genoux_gauche:      '#e08e0b',
  jambe_gauche:       '#ca8309',
  mollet_gauche:      '#b07707',
  pied_gauche:        '#9a6a06',
  // Jambe droite
  cuisse_droite:      '#fd79a8',
  genoux_droite:      '#e84393',
  jambe_droite:       '#d63081',
  mollet_droite:      '#c0266f',
  pied_droit:         '#a91b5e',
};
