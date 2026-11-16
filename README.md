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

## Veille quotidienne automatique (GitHub Actions + Apify)

Tous les jours à 8 h UTC (9 h à Paris en hiver, 10 h en été), le workflow
`.github/workflows/daily-analysis.yml` lance `scripts/daily-check.ts` :

1. il collecte les annonces récentes sur **Leboncoin** et **Troc-Vélo** via
   Apify (voir plus bas), plus celles déposées dans `data/inbox.json` ;
2. il ignore celles déjà analysées (`data/state.json`) ;
3. il lit dans le titre et la description le groupe, le cadre, les freins, la
   taille, l'année, les roues et le capteur de puissance. Ce que l'annonce ne
   précise pas est supposé et marqué **« À vérifier »** ;
4. il applique **le même filtre strict et le même score que l'application**
   (`src/lib`) : carbone, disques, taille M / 56 / 57, budget maximum 4 500 €,
   région parisienne ou Saint-Nazaire / Loire-Atlantique, ou livraison ;
5. il met à jour `data/journal.md` et `data/listings.json` (vraies annonces
   retenues, avec leur **lien direct**), commite `data/` sur `main`, puis
   relance la publication du site, qui affiche ces annonces.

Le résumé de chaque exécution s'affiche dans l'onglet **Actions** du dépôt.

### Clé Apify (plan gratuit)

1. Sur https://console.apify.com, menu **Settings** → **API & Integrations** :
   copie ton **Personal API token**.
2. Sur GitHub, dans le dépôt : **Settings** → **Secrets and variables** →
   **Actions** → onglet **Secrets** → **New repository secret**.
3. Nom : `APIFY_TOKEN`, valeur : la clé copiée → **Add secret**.

Sans ce secret, la veille tourne quand même mais ne collecte rien.

### Coût et garde-fous

| Plateforme | Comment | Par jour, au plus | Coût estimé par mois |
| ---------- | ------- | ----------------- | -------------------- |
| Leboncoin  | Acteur `memo23/leboncoin-scraper` (0,79 $ / 1 000 annonces) | 2 recherches × 30 annonces | ~1,40 $ |
| Troc-Vélo  | `apify/puppeteer-scraper` : Chrome sans écran (le site exige un vrai navigateur), ni images ni CSS | 1 page de liste + 8 annonces | ~1,20 $ (+ proxy résidentiel s'il est activé) |
| Decathlon Occasion | Idem, page « Vélo route occasion » | 4 pages de liste + 12 annonces | 0 à ~0,30 $ |

Sur Troc-Vélo et Decathlon, seules les annonces dont la vignette cite un groupe
Shimano retenu et un prix dans le budget sont ouvertes. Leboncoin est filtré à la
source : catégorie Vélos, type Course, taille M, 1 500 à 4 500 €, 60 km autour
de Paris et de Saint-Nazaire, plus récentes d'abord. Chaque exécution a un
plafond de dépense, et la collecte s'arrête si la consommation du mois atteint 4 $.

**Cheerio Scraper et Puppeteer Scraper.** Ce sont les acteurs génériques d'Apify :
ils n'ont pas besoin d'être ajoutés à ton compte, mais Apify demande d'autoriser
chacun une fois. Si le journal affiche « Apify demande d'autoriser une fois cet
acteur », ouvre le lien indiqué et clique sur **Approve**.

**API interne de Troc-Vélo.** À chaque passage, le navigateur relève les appels
JSON que fait la page de liste. S'ils révèlent une API de recherche, le journal
les affiche (« appels JSON relevés ») : on pourra alors l'interroger directement,
sans navigateur, pour presque rien.

**Réglages facultatifs** (Settings → Secrets and variables → Actions → onglet
Variables) :

| Variable              | Par défaut | Effet |
| --------------------- | ---------- | ----- |
| `APIFY_BUDGET_USD`    | `4`        | Consommation du mois au-delà de laquelle la collecte est sautée |
| `APIFY_MAX_ITEMS`     | `30`       | Annonces Leboncoin lues par zone et par jour |
| `DECATHLON_MAX_ITEMS` | `12`       | Annonces Decathlon Occasion ouvertes par jour |
| `APIFY_PROXY_GROUPS`  | vide (proxy automatique) | `RESIDENTIAL` : proxy résidentiel français pour les scrapers génériques, si un site bloque le proxy par défaut (facturé au volume) |
| `TROCVELO_PROXY_GROUPS` | comme ci-dessus | Proxy pour Troc-Vélo seulement, par exemple `RESIDENTIAL` |
| `DECATHLON_ENABLED`   | `true`     | `false` : ne plus lire Decathlon Occasion |
| `TROCVELO_MAX_ITEMS`  | `8`        | Annonces Troc-Vélo ouvertes par jour |
| `TROCVELO_SEARCH_URL` | catégorie route | Page de liste Troc-Vélo (copie l'adresse après avoir posé tes filtres) |
| `TROCVELO_ENABLED`    | `true`     | `false` : ne plus lire Troc-Vélo |
| `COMMIT_RESULTS`      | `true`     | `false` : simple exécution de contrôle, rien n'est commité |

**Lancer la veille à la main** : onglet Actions → « Veille quotidienne » →
« Run workflow ». Cases utiles : « Réanalyser aussi les annonces déjà vues » et
« Annonces Leboncoin lues par zone » pour une collecte plus large ponctuelle.

En local : `APIFY_TOKEN=… npm run daily-check`. Sans clé, `npm run test:apify`
vérifie l'analyse sur des exemples, et
`APIFY_FIXTURES=scripts/apify/fixtures npm run daily-check` rejoue une veille
complète sans appeler Apify.

> **Conditions d'utilisation.** Leboncoin interdit la collecte automatique dans
> ses conditions. Cette veille est réglée pour un usage personnel et un très petit
> volume (40 annonces par jour au plus), mais le risque reste le tien.

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
- **Vraies annonces.** Celles retenues par la veille quotidienne, avec leur lien
  direct et la photo du vendeur. Les nouvelles du jour sont marquées « Nouveau » ;
  « Actualiser » recharge le dernier résultat.
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
│   ├── daily-analysis.yml     Veille quotidienne planifiée
│   └── pages.yml              Publication du site sur GitHub Pages
├── scripts/
│   ├── daily-check.ts         Veille quotidienne (collecte, filtre, score, journal)
│   ├── apify/                 Collecte Leboncoin et Troc-Vélo via Apify
│   │   ├── config.ts          Recherches, limites et budget (plan gratuit)
│   │   ├── client.ts          Appels à l'API Apify
│   │   ├── leboncoin.ts       Recherches ciblées et lecture des annonces Leboncoin
│   │   ├── trocvelo.ts        Annonces Troc-Vélo (Puppeteer Scraper, vrai navigateur)
│   │   ├── decathlon.ts       Annonces Decathlon Occasion
│   │   ├── page-function.ts   Fonction de page Cheerio (lecture directe et Cheerio Scraper)
│   │   ├── browser-page-function.ts  Fonction de page navigateur (Puppeteer Scraper)
│   │   ├── direct.ts          Lecture directe depuis GitHub, sans Apify
│   │   ├── parse.ts           Groupe, cadre, freins, taille… lus dans le texte
│   │   ├── selftest.ts        Vérifications sur des exemples (npm run test:apify)
│   │   └── fixtures/          Exemples au format des acteurs Apify
│   └── simulation.ts          Annonces inventées, pour les tests
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
    │   ├── sources.ts         Plateformes suivies
    │   └── cities.ts          Villes, coordonnées, calcul de distance
    ├── lib/
    │   ├── aggregator.ts      Recherche simulée du mode démonstration
    │   ├── live.ts            Chargement des annonces de la veille (data/listings.json)
    │   ├── links.ts           Liens directs d'annonces (jamais de recherche)
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

## Annonces affichées

Le site lit `data/listings.json`, produit par la veille quotidienne. Chaque
bouton « Voir l'annonce » ouvre l'annonce elle-même, jamais une recherche : les
liens sont vérifiés par `src/lib/links.ts`.

Tant que la veille n'a trouvé aucune vraie annonce, l'application montre des
annonces de démonstration inventées, sans lien. Elles disparaissent dès la
première annonce réelle. Tu peux aussi ajouter une annonce à la main (« Ajouter
une annonce ») ; elle reste dans ton navigateur.

## Données enregistrées

Tout est dans le `localStorage`, sous le préfixe `radar-velo:v1:` : critères et
zones, suivi des annonces, annonces ajoutées, recherches déjà lancées, filtres, tri,
vue, thème. « Critères » → « Réinitialiser la démo » efface tout.
