/**
 * Ajoute des coordonnées UV (TEXCOORD_0) par projection cylindrique aux
 * primitives du GLB qui n'en ont pas encore.
 *
 *   U = angle horizontal autour de l'axe Y  (0 = avant, 0.5 = arrière)
 *   V = hauteur normalisée                  (0 = haut, 1 = bas)
 *
 * Usage : node scripts/add-uvs.mjs
 */

import { NodeIO } from '@gltf-transform/core';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const INPUT  = resolve(__dirname, '../src/assets/models/body.glb');
const OUTPUT = resolve(__dirname, '../src/assets/models/body.glb');

const io = new NodeIO();
const document = await io.read(INPUT);

let modified = 0;

for (const mesh of document.getRoot().listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    if (prim.getAttribute('TEXCOORD_0')) continue;   // déjà des UV

    const position = prim.getAttribute('POSITION');
    if (!position) continue;

    const count = position.getCount();
    const accessor = document.createAccessor()
      .setType('VEC2')
      .setArray(new Float32Array(count * 2));

    // Bounding box locale pour normaliser Y
    let xMin = Infinity, xMax = -Infinity;
    let yMin = Infinity, yMax = -Infinity;
    let zMin = Infinity, zMax = -Infinity;
    const tmp = [0, 0, 0];
    for (let i = 0; i < count; i++) {
      position.getElement(i, tmp);
      if (tmp[0] < xMin) xMin = tmp[0]; if (tmp[0] > xMax) xMax = tmp[0];
      if (tmp[1] < yMin) yMin = tmp[1]; if (tmp[1] > yMax) yMax = tmp[1];
      if (tmp[2] < zMin) zMin = tmp[2]; if (tmp[2] > zMax) zMax = tmp[2];
    }
    const cx     = (xMin + xMax) / 2;
    const cz     = (zMin + zMax) / 2;
    const yRange = (yMax - yMin) || 1;

    for (let i = 0; i < count; i++) {
      position.getElement(i, tmp);
      const u = 0.5 + Math.atan2(tmp[2] - cz, tmp[0] - cx) / (2 * Math.PI);
      const v = 1 - (tmp[1] - yMin) / yRange;
      accessor.setElement(i, [u, v]);
    }

    prim.setAttribute('TEXCOORD_0', accessor);
    modified++;
    console.log(`  ✓ UV ajoutés à la primitive "${mesh.getName() || '(sans nom)'}"`);
  }
}

if (modified === 0) {
  console.log('Toutes les primitives ont déjà des UV — aucune modification nécessaire.');
} else {
  await io.write(OUTPUT, document);
  console.log(`\n${modified} primitive(s) mise(s) à jour → ${OUTPUT}`);
}
