# Données de la veille quotidienne

Ces fichiers sont mis à jour chaque jour par la GitHub Action
`.github/workflows/daily-analysis.yml`, qui lance `scripts/daily-check.ts`.

| Fichier         | Contenu                                                                 |
| --------------- | ----------------------------------------------------------------------- |
| `journal.md`    | Une entrée par jour : annonces pertinentes (avec score), écartées et pourquoi |
| `listings.json` | Toutes les annonces retenues depuis le début, de la meilleure à la moins bonne |
| `state.json`    | Identifiants déjà analysés, pour ne jamais traiter deux fois la même annonce |
| `inbox.json`    | Annonces réelles à analyser, à remplir à la main ou par un autre outil   |

## Ajouter une vraie annonce dans `inbox.json`

Le fichier contient une liste. Exemple d'entrée :

```json
[
  {
    "id": "lbc-3284550278",
    "source": "leboncoin",
    "url": "https://www.leboncoin.fr/ad/velos/3284550278",
    "image": "https://…/photo.jpg",
    "title": "Van Rysel RCR-F Pro Di2, taille M",
    "brand": "Van Rysel",
    "model": "RCR-F Pro 105 Di2",
    "year": 2026,
    "size": "M",
    "price": 3849,
    "newPrice": 4499,
    "city": "Issy-les-Moulineaux",
    "shipping": false,
    "frame": "carbone",
    "brakes": "disque",
    "groupset": "105-di2",
    "aero": true,
    "powerMeter": true,
    "wheelDepth": 50,
    "extensions": "oui",
    "condition": "tres-bon"
  }
]
```

- **Champs obligatoires** : `id`, `source`, `url`, `title`, `brand`, `model`,
  `year`, `size`, `price`, `city`, `frame`, `brakes`, `groupset`.
- `source` : `leboncoin`, `troc-velo` ou `decathlon`.
- `groupset` : `dura-ace-di2`, `ultegra-di2`, `105-di2`, `ultegra`, `105`,
  `sram-axs`, `grx` ou `autre`.
- `city` doit figurer dans `src/data/cities.ts`, sinon la distance est inconnue.
- Une entrée déjà analysée (même `id`) n'est jamais retraitée : inutile de
  vider le fichier.
