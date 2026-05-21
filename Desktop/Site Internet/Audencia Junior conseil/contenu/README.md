# Dossier `contenu/` — Modifier le site sans code

Tous les fichiers de ce dossier sont des fichiers **JSON**. Un JSON, c'est juste du texte avec des règles simples :

- Les textes vont entre guillemets `"..."`.
- Les éléments sont séparés par des **virgules** `,` (sauf le dernier d'une liste).
- Une **liste** est entourée de `[ ... ]`.
- Un **objet** est entouré de `{ ... }`.

Si tu te trompes (virgule manquante, guillemet en trop…), le site continuera d'afficher l'ancienne version et la console du navigateur affichera une erreur. Pour vérifier ton JSON avant publication : copie-colle-le sur [jsonlint.com](https://jsonlint.com).

---

## `config.json` — Paramètres généraux

| Champ | À quoi ça sert |
|---|---|
| `association.nom`, `sigle`, `slogan` | Identité affichée |
| `association.email`, `telephone` | Footer + page contact |
| `campus[].adresse`, `ville` | Adresse affichée |
| `reseaux_sociaux[].lien` | **URL LinkedIn et Instagram du footer** (mets l'URL réelle à la place de `#`) |
| `chiffres_cles.*` | Les 4 grands chiffres animés de la page d'accueil |

**Exemple — mettre à jour LinkedIn :**
```json
{
  "nom": "LinkedIn",
  "lien": "https://www.linkedin.com/company/audencia-junior-conseil/",
  ...
}
```

---

## `legal.json` — Mentions légales + Politique de confidentialité

Ce fichier alimente **deux pages** :

- `mentions-legales.html` (clé `mentions_legales`)
- `politique-confidentialite.html` (clé `politique_confidentialite`)

### Structure d'une page

```json
"politique_confidentialite": {
  "page_titre": "Politique de confidentialité",
  "page_eyebrow": "Vos données, votre confiance",
  "page_sous_titre": "Texte court sous le titre…",
  "derniere_maj": "Mars 2026",
  "sections": [
    {
      "titre": "1. Responsable du traitement",
      "paragraphes": ["Un paragraphe ici.", "Un autre paragraphe."],
      "liste": ["Item 1", "Item 2"],
      "paragraphes_apres": ["Texte qui vient après la liste."]
    }
  ]
}
```

### Comment ajouter / modifier une section

1. Ouvre `legal.json`.
2. Trouve la clé `mentions_legales` ou `politique_confidentialite`.
3. Dans `sections`, ajoute / modifie un objet :
   - `titre` : obligatoire.
   - `paragraphes` : liste de paragraphes affichés **avant** la liste à puces.
   - `liste` : optionnel. Crée des puces roses.
   - `paragraphes_apres` : optionnel. Paragraphes affichés **après** la liste.
4. Sauvegarde et recharge la page. Le sommaire en haut se met à jour automatiquement.

### Mettre un lien dans un paragraphe

Tu peux mettre du HTML dans les paragraphes, par exemple un lien email :

```json
"paragraphes": [
  "Écris-nous à <a href=\"mailto:contact@ajc-mail.com\">contact@ajc-mail.com</a>."
]
```

⚠️ Les guillemets à l'intérieur d'un texte JSON doivent être échappés avec `\"`.

### Changer la date de mise à jour

Modifie le champ `derniere_maj`, ex. `"Mai 2026"`.

---

## `clients.json` — Logos clients et partenaires

Voir le README dans `photos/` pour le format des images. Pour ajouter un client :

```json
{
  "nom": "Nom de l'entreprise",
  "logo": "photos/clients/mon-client.png",
  "lien": "https://exemple.com"
}
```

---

## `equipe.json`, `prestations.json`, `services.json`, `temoignages.json`

Même logique : on modifie le texte / on ajoute un objet dans la liste. Les pages correspondantes (`notre-equipe.html`, `prestations.html`, `service-detail.html`, `index.html`) reflètent les changements après rechargement.
