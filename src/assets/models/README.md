# Source :

https://poly.pizza/m/eWGDnQ0jzmH

# Modèle 3D du corps

Déposez ici votre fichier **`body.glb`** (format glTF binaire) pour afficher un
modèle anatomique réaliste à la place du corps simplifié généré par défaut.

```
src/assets/models/body.glb
```

## Où trouver un modèle ?

Tout modèle humanoïde au format `.glb` ou `.gltf` convient, à condition que
chaque maillage possède des **coordonnées UV** (c'est le cas de la quasi-totalité
des modèles anatomiques destinés au rendu). Des modèles gratuits sont
disponibles par exemple sur Sketchfab ou Mixamo (export au format glTF).

## Faire correspondre les noms des parties du corps

L'application affiche, pour chaque zone de douleur, le nom de la partie du
corps concernée (« Bras gauche », « Torse »...). Cette correspondance est
définie dans :

```
src/app/models/body-parts.ts
```

1. Chargez votre modèle, ouvrez la console du navigateur (l'application y
   affiche le nom de chaque maillage peignable au démarrage — voir
   `BodySceneEngine.paintableMeshNames`, accessible facilement en ajoutant
   temporairement un `console.log` dans `body-viewer.component.ts`).
2. Reportez ces noms dans `BODY_PART_LABELS` avec leur libellé en français.

Si un maillage n'a pas d'entrée dans `BODY_PART_LABELS`, son nom technique est
affiché tel quel — l'application reste fonctionnelle, seul l'étiquetage est
moins lisible.

## Aucun fichier présent ?

Si `body.glb` est absent, l'application génère automatiquement un corps
simplifié (formes géométriques de base) qui prend en charge exactement la même
mécanique de dessin, de sélection et d'export. C'est le mode de démonstration
par défaut de ce projet.
