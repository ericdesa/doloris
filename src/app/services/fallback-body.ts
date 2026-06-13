import * as THREE from 'three';

/**
 * Construit un corps humain "de secours", composé de formes primitives
 * (capsules, sphères, boîtes) toutes nommées comme les clés de
 * `BODY_PART_LABELS` (src/app/models/body-parts.ts).
 *
 * Ce corps est utilisé tant qu'aucun fichier `src/assets/models/body.glb`
 * n'est présent. Il sert de remplaçant fonctionnel : chaque maillage possède
 * des coordonnées UV exploitables pour le dessin des zones de douleur, donc
 * toute la mécanique (raycast, peinture, sélection) fonctionne à l'identique
 * une fois un modèle anatomique réel chargé.
 *
 * Pour utiliser un modèle réaliste : déposez votre fichier .glb sous
 * `src/assets/models/body.glb`. Si les noms de vos maillages diffèrent,
 * mettez à jour `BODY_PART_LABELS`.
 */

const SKIN = new THREE.MeshStandardMaterial({
  color: 0xe7c2a6,
  roughness: 0.75,
  metalness: 0.02,
});

interface PartOptions {
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
}

function addPart(group: THREE.Group, name: string, geometry: THREE.BufferGeometry, opts: PartOptions): void {
  const mesh = new THREE.Mesh(geometry, SKIN);
  mesh.name = name;
  mesh.position.set(...opts.position);
  if (opts.rotation) mesh.rotation.set(...opts.rotation);
  if (opts.scale) mesh.scale.set(...opts.scale);
  group.add(mesh);
}

/**
 * CapsuleGeometry orientée selon Z (long axe = longueur du pied).
 * rotateX fait pivoter les positions de la géométrie → la boîte englobante
 * reflète l'orientation réelle → generateCylindricalUV choisit l'axe Z.
 * Aucune face plate perpendiculaire à l'axe → zéro triangle UV dégénéré.
 */
function makeFootGeo(): THREE.BufferGeometry {
  const geo = new THREE.CapsuleGeometry(0.04, 0.17, 8, 20);
  geo.rotateX(Math.PI / 2); // longueur du pied → axe Z
  return geo;
}

export function buildFallbackBody(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'corps-simplifie';

  // --- Tête / cou ---------------------------------------------------------
  addPart(group, 'tete', new THREE.SphereGeometry(0.115, 32, 24), { position: [0, 1.74, 0] });
  addPart(group, 'cou', new THREE.CylinderGeometry(0.055, 0.06, 0.09, 24), { position: [0, 1.6, 0] });

  // --- Torse / bassin ------------------------------------------------------
  addPart(group, 'torse', new THREE.CapsuleGeometry(0.18, 0.18, 6, 24), { position: [0, 1.285, 0] });
  addPart(group, 'bassin', new THREE.SphereGeometry(0.165, 24, 18), {
    position: [0, 0.95, 0],
    scale: [1.15, 0.62, 0.9],
  });

  // --- Bras gauche -----------------------------------------------------
  addPart(group, 'bras_gauche', new THREE.CapsuleGeometry(0.055, 0.2, 6, 16), {
    position: [-0.275, 1.31, 0.01],
    rotation: [0, 0, 0.32],
  });
  addPart(group, 'avant_bras_gauche', new THREE.CapsuleGeometry(0.046, 0.19, 6, 16), {
    position: [-0.345, 0.985, 0.03],
    rotation: [0, 0, 0.42],
  });
  addPart(group, 'main_gauche', new THREE.SphereGeometry(0.05, 20, 16), {
    position: [-0.4, 0.8, 0.045],
    scale: [0.9, 1.3, 0.6],
  });

  // --- Bras droit ------------------------------------------------------
  addPart(group, 'bras_droit', new THREE.CapsuleGeometry(0.055, 0.2, 6, 16), {
    position: [0.275, 1.31, 0.01],
    rotation: [0, 0, -0.32],
  });
  addPart(group, 'avant_bras_droit', new THREE.CapsuleGeometry(0.046, 0.19, 6, 16), {
    position: [0.345, 0.985, 0.03],
    rotation: [0, 0, -0.42],
  });
  addPart(group, 'main_droite', new THREE.SphereGeometry(0.05, 20, 16), {
    position: [0.4, 0.8, 0.045],
    scale: [0.9, 1.3, 0.6],
  });

  // --- Jambe gauche ----------------------------------------------------
  addPart(group, 'cuisse_gauche', new THREE.CapsuleGeometry(0.1, 0.2, 6, 16), { position: [-0.115, 0.66, 0] });
  addPart(group, 'jambe_gauche', new THREE.CapsuleGeometry(0.075, 0.25, 6, 16), { position: [-0.11, 0.26, 0] });
  addPart(group, 'pied_gauche', makeFootGeo(), { position: [-0.11, 0.04, 0.06] });

  // --- Jambe droite ------------------------------------------------------
  addPart(group, 'cuisse_droite', new THREE.CapsuleGeometry(0.1, 0.2, 6, 16), { position: [0.115, 0.66, 0] });
  addPart(group, 'jambe_droite', new THREE.CapsuleGeometry(0.075, 0.25, 6, 16), { position: [0.11, 0.26, 0] });
  addPart(group, 'pied_droit', makeFootGeo(), { position: [0.11, 0.04, 0.06] });

  return group;
}
