# Guide — Modifier "Nos réalisations" sans code

Tout passe par **un seul fichier** : `contenu/realisations.json`.

- Les **photos** sont dans `photos/realisations/` (voir le README de ce dossier).
- L'**ordre d'affichage** = ordre dans la liste `realisations` du JSON (par défaut). Les filtres "Plus récents / Plus anciens / Alpha" trient automatiquement à la volée.

---

## 1. Modifier l'en-tête de la page

```json
"page": {
  "titre": "Nos<strong>réalisations</strong>",
  "eyebrow": "Portfolio · 2020 — 2026",
  "intro": "Découvrez les missions menées par nos consultants juniors…",
  "stats": [
    { "valeur": "28",  "libelle": "Études réalisées" },
    { "valeur": "12",  "libelle": "Secteurs couverts" },
    { "valeur": "97%", "libelle": "Clients satisfaits" }
  ]
}
```

Pour mettre un mot en gras dans le titre, utilise `<strong>texte</strong>`.

---

## 2. Ajouter une nouvelle réalisation

Ajoute un objet dans `realisations` :

```json
{
  "slug": "nom-court-sans-accent",
  "client": "Nom du client",
  "client_initiale": "X.",
  "client_label": "Catégorie ou nom court (affiché sur la carte)",
  "annee": 2026,
  "expertise": ["marketing"],
  "secteur": "retail",
  "secteur_libelle": "Retail / E-commerce",
  "tags": ["Marketing", "Étude de marché"],
  "tags_detail": ["Marketing", "Étude de marché", "B2C"],
  "titre": "Titre court affiché sur la carte",
  "titre_detail": "Titre long<strong>de la page détail</strong>",
  "description": "1-2 phrases qui résument la mission.",
  "image": "photos/realisations/nom-court-sans-accent.jpg",
  "image_alt": "Photo du projet",
  "meta": {
    "duree":     "3 mois",
    "equipe":    "4 consultants",
    "livrables": "Rapport + soutenance"
  }
}
```

### Valeurs autorisées pour `expertise` (pour les filtres)
`marketing`, `communication`, `rse`, `bigdata`, `finance`
> Un projet peut en avoir plusieurs : `"expertise": ["marketing", "communication"]`.

### Valeurs autorisées pour `secteur` (filtre déroulant)
`retail`, `industrie`, `energie`, `luxe`, `tech`, `services`

---

## 3. Ajouter le contenu détaillé d'une réalisation

Pour avoir une **fiche détail riche** (sections contexte / approche / résultats / témoignage), ajoute ces blocs **optionnels** dans l'objet :

```json
"contexte": {
  "intro": "Premier paragraphe d'introduction.",
  "enjeu": "Le contexte et l'enjeu.",
  "defi":  "Une phrase qui résume LE défi.",
  "objectifs": [
    { "num": "01 · Dimensionner", "texte": "Quantifier le marché à 12 mois" },
    { "num": "02 · Cartographier","texte": "Identifier les attentes cibles" },
    { "num": "03 · Recommander",  "texte": "Définir un pricing optimal" }
  ]
},
"approche": {
  "intro": "Phrase d'intro de la méthodo.",
  "etapes": [
    { "step": "Cadrage",   "titre": "Immersion et brief",         "description": "..." },
    { "step": "Collecte",  "titre": "Étude quanti & quali",       "description": "..." },
    { "step": "Analyse",   "titre": "Modélisation et benchmark",  "description": "..." },
    { "step": "Livrables", "titre": "Recommandations finales",    "description": "..." }
  ]
},
"resultats": {
  "intro": "Phrase d'intro qui peut contenir un <strong>chiffre clé</strong>.",
  "kpis": [
    { "libelle": "Répondants",     "valeur": "420" },
    { "libelle": "Intention",       "valeur": "+38%", "highlight": true },
    { "libelle": "Segments",        "valeur": "3" },
    { "libelle": "Prix psycho",     "valeur": "€8,90" }
  ],
  "outcomes": [
    { "titre": "Lancement réussi",     "texte": "..." },
    { "titre": "Déploiement national", "texte": "..." },
    { "titre": "Partenariat continu",  "texte": "..." }
  ]
},
"temoignage": {
  "quote":  "Le verbatim du client.",
  "auteur": "Marie D.",
  "role":   "Responsable Marketing · Bagelstein"
}
```

**Tu n'es pas obligé(e) de remplir tous les blocs.** Un bloc absent → la section correspondante est cachée automatiquement sur la fiche détail. Seul le bloc hero (client + meta) est obligatoire.

---

## 4. Supprimer une réalisation

Retire son objet de la liste `realisations`. Les "cas similaires" se recalculent automatiquement.

---

## 5. Témoignages de la page "Nos réalisations"

Bloc `temoignages` (3 cartes affichées en bas de la page index) :

```json
"temoignages": [
  { "quote": "...", "auteur": "Marie D.",  "role": "Responsable Marketing · Restauration" },
  { "quote": "...", "auteur": "Pierre L.", "role": "Directeur RSE · Industrie" },
  { "quote": "...", "auteur": "Sophie M.", "role": "Directrice Com · Luxe" }
]
```

---

## 6. Tester ses modifications

Sauvegarde le fichier, recharge `realisations.html` dans le navigateur (Cmd+R). Si rien ne s'affiche : copie-colle ton JSON dans [jsonlint.com](https://jsonlint.com) — il te dira sur quelle ligne se trouve l'erreur (souvent une virgule oubliée ou en trop).
