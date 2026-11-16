# Radar vélo d'occasion

Tableau de bord pour centraliser une recherche de vélo de route d'occasion entre
**deux zones** : la région parisienne et Saint-Nazaire / Loire-Atlantique.
Annonces agrégées (Leboncoin, Troc-Vélo, Decathlon Occasion), filtre automatique
selon tes critères, score de pertinence, et suivi de chaque annonce jusqu'à l'achat.

React 19, TypeScript, Vite 6, Tailwind CSS 4, icônes Lucide. Aucune base de données :
tout est enregistré dans le `localStorage` du navigateur.

Site en ligne : https://astiricx.github.io/radar-velo/

## Lancer le projet en local

Il faut [Node.js](https://nodejs.org) 20 ou plus récent (22 recommandé, voir `.nvmrc`).

```bash
npm install
npm run dev
```

Ouvre ensuite http://localhost:5173.

| Commande            | Effet                                                 |
| ------------------- | ----------------------------------------------------- |
| `npm run dev`       | Serveur de développement avec rechargement à chaud    |
| `npm run build`     | Version de production dans `dist/`                    |
| `npm run preview`   | Sert `dist/` en local pour vérifier la version finale |
| `npm run typecheck` | Vérification TypeScript, sans rien produire           |

## Mettre le projet sur GitHub

### 1. Premier commit

Depuis le dossier du projet :

```bash
npm install                 # crée package-lock.json, à commiter aussi
npm run build               # vérifie que tout compile avant de pousser
git init -b main
git add .
git commit -m "Radar vélo d'occasion : première version"
```

### 2. Créer le dépôt et pousser

**Avec GitHub CLI** (`gh auth login` une seule fois au préalable) :

```bash
gh repo create radar-velo --private --source=. --remote=origin --push
```

Remplace `--private` par `--public` si tu veux un dépôt public.

**Sans GitHub CLI** : crée un dépôt vide nommé `radar-velo` sur
https://github.com/new (sans README, sans `.gitignore`, sans licence), puis :

```bash
git remote add origin https://github.com/Astiricx/radar-velo.git
git push -u origin main
```

### 3. Commits suivants

```bash
git add .
git commit -m "Décris ici ta modification"
git push
```

À chaque push, le workflow `.github/workflows/ci.yml` vérifie les types et lance un
build (onglet **Actions** du dépôt).

## Site en ligne (GitHub Pages)

L'application est publiée sur **https://astiricx.github.io/radar-velo/**.

Le workflow `.github/workflows/pages.yml` (« Site ») la reconstruit et la republie à
chaque push sur `main`. Les commits de la veille quotidienne, qui ne touchent que
`data/`, ne la republient pas. On peut aussi la relancer à la main depuis l'onglet
**Actions** → **Site** → **Run workflow**.

Si GitHub Pages n'est pas encore activé sur le dépôt : **Settings** → **Pages** →
**Source : GitHub Actions**, puis relancer le workflow « Site ».

> Les statuts, notes et critères sont enregistrés dans le navigateur. Ils ne se
> partagent pas entre ton ordinateur et ton téléphone, ni entre `localhost` et
> le site en ligne.

### Autre hébergeur (Vercel, Netlify…)

Importe le dépôt, garde les réglages détectés pour Vite (build `npm run build`,
dossier `dist`). Aucune variable d'environnement n'est nécessaire : sans
`BASE_PATH`, le site est servi à la racine.

## Veille quotidienne automatique (GitHub Actions)

Tous les jours à 8 h UTC (9 h à Paris en hiver, 10 h en été), le workflow
`.github/workflows/daily-analysis.yml` lance `scripts/daily-check.ts` :

1. il rassemble les annonces du jour : celles déposées dans `data/inbox.json`
   et, tant que la simulation est active, quelques annonces simulées dans tes
   deux zones ;
2. il ignore celles déjà analysées (`data/state.json`) ;
3. il applique **le même filtre strict et le même score que l'application**
   (`src/lib`) : carbone, disques, taille M / 56 / 57, budget maximum 4 500 €,
   région parisienne ou Saint-Nazaire / Loire-Atlantique, ou livraison ;
4. il met à jour `data/journal.md` (une entrée par jour, avec les annonces
   pertinentes, leur score et les écartées) et `data/listings.json` ;
5. s'il a analysé de nouvelles annonces, il commite `data/` sur `main`.

Le résumé de chaque exécution s'affiche dans l'onglet **Actions** du dépôt.

**Lancer la veille à la main** : onglet Actions → « Veille quotidienne » →
« Run workflow ». La case « simulation » choisit d'ajouter ou non les annonces
simulées.

**Réglages** (Settings → Secrets and variables → Actions → onglet Variables) :

| Variable            | Effet                                                               |
| ------------------- | ------------------------------------------------------------------- |
| `VEILLE_SIMULATION` | `false` : n'analyse plus que `data/inbox.json` (vraies annonces)    |
| `COMMIT_RESULTS`    | `false` : simple exécution de contrôle, rien n'est commité          |

En local : `npm run daily-check` (ajoute `VEILLE_DATE=2026-12-01` pour rejouer
une date précise).

> **Annonces simulées.** Le script ne lit pas Leboncoin, Troc-Vélo ni Decathlon :
> depuis les serveurs de GitHub, ces sites bloquent les robots, et leurs
> conditions d'utilisation l'interdisent pour Leboncoin. Les annonces simulées sont
> marquées « *(simulée)* » dans le journal et `"simulated": true` dans
> `listings.json`. Les vraies annonces passent par `data/inbox.json`, dont le
> format est décrit dans `data/README.md`.

> GitHub suspend les tâches planifiées d'un dépôt public sans activité pendant
> 60 jours. Les commits quotidiens de la veille suffisent à l'éviter ; en mode
> contrôle seul (`COMMIT_RESULTS=false`), réactive-la depuis l'onglet Actions si
> GitHub te prévient.

## Ce que fait l'application

- **Deux zones de recherche.** Région parisienne (220 km autour de Paris) et
  Saint-Nazaire / Loire-Atlantique (120 km autour de Saint-Nazaire). Chaque annonce
  est rattachée à la zone la plus proche ; celles hors zones restent retenues si
  elles sont livrables. Rayon, ville centre et nom de chaque zone se règlent dans
  « Critères », et chaque zone peut être désactivée.
- **Agrégation simulée.** 38 annonces de démonstration réparties en trois vagues,
  dans les deux zones. « Lancer une recherche » fait arriver la vague suivante,
  marquée « Nouveau ».
- **Filtre automatique.** Toute annonce hors budget maximum, hors type, hors taille,
  sans cadre carbone ou freins à disque, avec une transmission non retenue, ou hors
  de tes zones sans livraison est écartée. La liste des écartées et le motif
  restent consultables.
- **Vraies photos.** Chaque carte, ligne du tableau et carte du pipeline affiche une
  photo de vélo de route.
- **Trois vues.** Cartes, tableau, et pipeline en colonnes où les cartes se glissent
  d'un statut à l'autre.
- **Score sur 100**, expliqué ligne par ligne dans la fiche de l'annonce.
- **Suivi.** Statut, vendeur, contact, lieu et date de rendez-vous, prix négocié,
  rappel daté, notes. Les rappels remontent en haut du tableau de bord.
- **Filtres et tris.** Zone, recherche libre, type, tranche de prix, statut,
  plateforme ; tri par score, prix ou date. Les compteurs par zone en haut de page
  servent aussi de filtre rapide.
- **Ajout manuel.** « Ajouter une annonce » enregistre une vraie annonce avec le lien
  de sa photo. Elle est filtrée, rattachée à une zone et notée comme les autres.
- **Thème** clair, sombre ou calé sur le système.

## Photos

Les annonces de démonstration utilisent de vraies photos de vélos de route
hébergées par [Unsplash](https://unsplash.com/license) (utilisation libre, sans
autorisation). Elles sont listées dans `src/data/photos.ts`. Ce sont des **photos
d'illustration** : un vélo comparable, pas le vélo exact de l'annonce, et elles
portent la mention « Photo d'illustration ».

Pour une annonce ajoutée à la main, colle le lien de la photo du vendeur (clic droit
sur la photo dans l'annonce → « Copier l'adresse de l'image ») : c'est elle qui
s'affiche. Certaines plateformes bloquent l'affichage de leurs photos sur d'autres
sites ; dans ce cas la vignette affiche la plaque marque et modèle.

Chaque annonce a une photo de secours. Si les deux ne se chargent pas, ou pendant
le chargement, la vignette affiche une plaque sobre avec la marque et le modèle en
typographie : aucune illustration dessinée.

## Structure

```
.
├── .github/workflows/
│   ├── ci.yml                 Vérification automatique à chaque push
│   └── daily-analysis.yml     Veille quotidienne planifiée
├── scripts/
│   ├── daily-check.ts         Analyse quotidienne (filtre, score, journal)
│   └── simulation.ts          Annonces simulées, tirées selon la date
├── data/                      Résultats de la veille (journal, annonces, état)
├── public/favicon.svg
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── src/
    ├── main.tsx               Point d'entrée
    ├── App.tsx                État global, filtres, tris, assemblage des vues
    ├── index.css              Tailwind + couleurs des deux thèmes
    ├── types.ts               Modèle de données (Listing, Criteria, Zone…)
    ├── data/
    │   ├── mockListings.ts    Annonces de démonstration (Paris et Loire-Atlantique)
    │   ├── photos.ts          Catalogue des photos Unsplash
    │   ├── sources.ts         Plateformes et liens de recherche
    │   └── cities.ts          Villes, coordonnées, calcul de distance
    ├── lib/
    │   ├── aggregator.ts      Recherche simulée (à remplacer par de vraies données)
    │   ├── criteria.ts        Critères et zones de départ, filtre automatique
    │   ├── zones.ts           Rattachement d'une annonce à la zone la plus proche
    │   ├── scoring.ts         Calcul du score de pertinence
    │   ├── pipeline.ts        Statuts du pipeline
    │   ├── storage.ts         Persistance localStorage
    │   └── format.ts          Prix, dates, distances
    ├── hooks/useTheme.ts      Thème clair / sombre / système
    └── components/            Header, Summary, Toolbar, ListingCard, ListingTable,
                               KanbanBoard, DetailDrawer, CriteriaPanel, ZoneBadge,
                               AddListingDialog, Reminders, BikeThumb, ScoreBib…
```

## Adapter

- **Critères et zones.** Bouton « Critères » dans l'application. Valeurs de départ
  dans `src/lib/criteria.ts` (`DEFAULT_CRITERIA`) : route, taille M / 56, idéal
  3 500 €, maximum 4 500 €, deux zones, carbone, disque, Shimano Di2 ou Ultegra
  mécanique.
- **Villes.** Pour ajouter une ville (centre de zone ou lieu d'annonce), ajoute ses
  coordonnées dans `src/data/cities.ts`.
- **Annonces de démonstration.** `src/data/mockListings.ts`.
- **Barème du score.** `src/lib/scoring.ts`.

### Barème par défaut

| Critère              | Points | Règle                                                                    |
| -------------------- | -----: | ------------------------------------------------------------------------ |
| Prix                 |     25 | 25 jusqu'au budget idéal, puis dégressif jusqu'à 10 au maximum            |
| Décote               |     10 | 10 à partir de 45 % sous le prix neuf                                     |
| Transmission         |     15 | Dura-Ace Di2 15, Ultegra Di2 13, 105 Di2 9, Ultegra mécanique 6           |
| Cadre aéro           |      8 | Aéro 8, polyvalent 2                                                      |
| Capteur de puissance |     10 | Présent 10                                                                |
| Roues                |      8 | Carbone ≥ 45 mm 8, ≥ 30 mm 5, carbone bas 3                               |
| Prolongateurs        |      6 | Montage prévu 6, kit tiers 4, à vérifier 2                                |
| Distance             |     10 | Depuis le centre de la zone la plus proche : ≤ 30 km 10, ≤ 80 km 8, ≤ 150 km 6, dans le rayon 4 ; livraison au moins 7 |
| État et âge          |      8 | État (1 à 4) + âge du modèle (1 à 4)                                      |

Un bonus décoché dans les critères sort du calcul ; le total est ramené sur 100.

## Brancher de vraies annonces

Le scraping est simulé. Un navigateur ne peut pas lire Leboncoin ou Troc-Vélo
directement : ces sites bloquent les requêtes venant d'une autre page (CORS) et les
robots. Deux voies :

1. **À la main** : « Ajouter une annonce » dans l'application.
2. **Automatique** : un script côté serveur (une fonction Vercel planifiée, par
   exemple) produit un fichier JSON d'objets `Listing`, et `runSearch()` dans
   `src/lib/aggregator.ts` va le chercher avec `fetch()`. C'est la seule fonction à
   remplacer.

## Données enregistrées

Tout est dans le `localStorage`, sous le préfixe `radar-velo:v1:` : critères et
zones, suivi des annonces, annonces ajoutées, recherches déjà lancées, filtres, tri,
vue, thème. « Critères » → « Réinitialiser la démo » efface tout.
