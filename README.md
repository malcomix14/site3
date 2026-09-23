# ÉLAN — Precision, Revealed

Expérience WebGL cinématique pilotée par le scroll : une seule caméra voyage sans coupure
depuis le hublot d'un jet privé jusqu'au cœur du mouvement mécanique d'une montre.

**Hublot → traversée du verre → plongée dans les nuages → falaise et resort → hall de l'hôtel →
ascenseur → penthouse (salon, couloir-galerie, cuisine, chambre, salle de bain) → baie vitrée
qui s'ouvre → vol au ras de la mer → yacht → salon du yacht → montre → déconstruction → mouvement.**

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # build de production (dist/)
npm run preview    # sert le build
```

Paramètres d'URL utiles :

- `?quality=high|medium|low` — force un niveau de qualité (sinon détection automatique)
- `?debug` — expose `window.__elan` (état du voyage) dans un build de production

Aucune ressource externe n'est nécessaire : toutes les géométries, textures, environnements
lumineux et sons sont générés de façon procédurale au chargement (polices embarquées via
`@fontsource`).

## Stack

React 19 · TypeScript · Vite · Three.js · React Three Fiber · GSAP ScrollTrigger + Lenis ·
postprocessing · Web Audio API.

## Architecture

```
src/
  journey/            le chef d'orchestre
    timeline.ts       plans caméra + « cues » (portes, baie vitrée, explosion, DOF, exposition…)
    interpolation.ts  pistes cubiques monotones (Steffen) : mouvement C1, sans dépassement
    JourneyController scroll amorti → cues → pose caméra → état partagé
    ScrollDriver.ts   Lenis (molette lissée) + GSAP ScrollTrigger (tactile natif)
    layout.ts         ancrages du monde unique (hublot, hôtel, penthouse, yacht, montre)
  camera/CameraRig.ts caméra de cinéma : caméra à l'épaule, parallaxe au pointeur, houle du yacht
  engine/             pipeline de chargement réel, baker GPU de textures, environnements PMREM,
                      assembleur (fusion des géométries par matériau), résolution adaptative
  materials/          bibliothèque de matériaux, recettes de textures procédurales (marbres,
                      bois, pierres, tissus, perlage, Côtes de Genève, soleillé), océan,
                      piscines, « interior mapping », rideaux, feu, perspective atmosphérique
  scenes/             WorldScene (ciel, mer, côte, végétation), WindowScene (cabine, hublot,
                      aile), CloudScene, HotelScene (architecture + hall), ElevatorScene,
                      ApartmentScene, YachtScene, WatchScene (+ builders/ procéduraux)
  effects/            DOF, flou de mouvement simulé, bloom, étalonnage ACES, faisceaux, poussière
  audio/              design sonore 100 % synthétisé (cabine, vent, mer, ambiance, échappement)
  ui/                 chargement, en-tête, rail de chapitres, légendes, étiquettes techniques, final
```

### Points notables

- **Un seul monde, une seule caméra** : le hublot est réellement placé à 380 m au-dessus de la mer,
  la vue à travers est le vrai monde ; la caméra traverse physiquement les vitres.
- **Montre fonctionnelle** : rouage calculé par module et nombre de dents (barillet 90, centre 80/12,
  moyenne 75/10, seconde 80/10, échappement 15/5) ; les dents engrènent réellement, l'échappement
  avance d'une demi-dent par alternance (28 800 A/h), balancier et spiral oscillent, les aiguilles
  affichent l'heure réelle et le guichet la date du jour. Ralenti cohérent pour le final.
- **Performances** : niveaux de qualité, DPR adaptatif, visibilité des scènes par fenêtre de
  progression, fusion des géométries, instancing, ombres limitées à la zone d'action,
  pré-compilation des shaders et répétition de chaque chapitre hors écran pendant le chargement.
- **Son** optionnel (bouton en haut à droite), le site fonctionne intégralement sans.
