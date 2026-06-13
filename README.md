# Cartographie de la douleur

Application Angular permettant à un patient de **dessiner librement, sur un
modèle 3D du corps humain**, les zones où il ressent de la douleur, puis
d'associer à chaque zone :

- un **type de douleur** (code couleur : brûlure, décharge, picotement,
  douleur sourde, crampe, engourdissement, pression, autre) ;
- une **intensité** de 1 à 10 ;
- des **caractéristiques** complémentaires (constante, intermittente,
  irradiante, aggravée la nuit...) ;
- des **notes libres**.

L'ensemble peut être exporté en compte-rendu texte ou en JSON, pour être
transmis à un médecin.

## Démarrage

```bash
npm install
npm start
```

L'application est servie sur `http://localhost:4200`.

## Modèle 3D

Par défaut, l'application génère un **corps humain simplifié** (formes
géométriques de base) qui supporte déjà l'intégralité des fonctionnalités :
dessin libre, sélection, édition, export.

Pour afficher un **modèle anatomique réaliste**, déposez un fichier
`body.glb` dans `src/assets/models/` — voir
[`src/assets/models/README.md`](src/assets/models/README.md) pour le détail
(format attendu, correspondance des noms de parties du corps).

## Fonctionnement (aperçu technique)

- **Dessin libre sur le modèle 3D** : chaque maillage peignable reçoit un
  calque transparent dont la texture est un `<canvas>` 2D. Un raycast
  Three.js convertit la position du pointeur en coordonnées UV, sur
  lesquelles le tracé est peint en temps réel
  (`src/app/services/body-scene.engine.ts`).
- **Données des zones** : chaque tracé est enregistré comme une `PainZone`
  (type, intensité, caractéristiques, notes, points UV) via un service à
  base de signals Angular (`src/app/services/pain-data.service.ts`), sans
  dépendance externe de gestion d'état.
- **Deux modes d'interaction** : « Dessiner » pour créer une nouvelle zone,
  « Sélectionner » pour cliquer une zone existante et l'éditer ou la
  supprimer.

## Structure du projet

```
src/app/
├── models/                  # Types de douleur, modèle de zone, libellés des parties du corps
├── services/
│   ├── pain-data.service.ts   # État applicatif (signals) : zones, mode, export, compte-rendu
│   ├── body-scene.engine.ts   # Scène Three.js, chargement du modèle, peinture des textures
│   ├── fallback-body.ts       # Corps simplifié généré si aucun .glb n'est fourni
│   └── geometry.utils.ts       # Conversion couleur, détection de zone sous le curseur
├── components/
│   ├── body-viewer/          # Visualiseur 3D (interaction pointeur)
│   ├── tool-panel/           # Choix du type, intensité, caractéristiques, notes
│   └── zone-panel/            # Liste des zones, édition détaillée, export
└── shared/                    # Styles partagés entre panneaux latéraux
```

## Personnalisation

- **Couleurs et typographies** : `src/styles.scss` (variables CSS) et
  `src/app/models/pain-types.ts` (couleurs par type de douleur).
- **Caractéristiques proposées** : `PAIN_CHARACTERISTICS` dans
  `src/app/models/pain-types.ts`.
