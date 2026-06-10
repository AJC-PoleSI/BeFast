# Guide de modification du site AJC

> Ce guide explique comment modifier le site sans toucher au code.
> Tous les contenus éditables sont dans le dossier **`contenu/`** et **`photos/`**.

**Changement majeur (mai 2025)**: La page "La Junior-Entreprise" a été divisée en deux pages séparées :
- **Qu'est-ce qu'une JE ?** → `qu-est-ce-une-je.html`
- **Notre Équipe** → `notre-equipe.html`

---

## 📁 Structure des fichiers importants

```
Site Internet/
├── contenu/
│   ├── config.json          → Infos générales du site (téléphone, email, réseaux, photos)
│   ├── equipe.json          → Membres de l'équipe (bureau + chefs de projets)
│   ├── prestations.json     → Domaines + services (Marketing, Finance, etc.)
│   └── services.json        → Pages détaillées de chaque service
├── photos/
│   ├── logo.png             → Logo AJC
│   ├── photo-equipe.jpg     → Photo d'équipe (fond du héros)
│   ├── equipe/              → Photos des membres de l'équipe
│   └── partenaires/         → Logos des partenaires
├── index.html               → Page d'accueil
├── prestations.html         → Page "Nos Prestations"
├── service-detail.html      → Page de détail d'un service (générée dynamiquement)
├── qu-est-ce-une-je.html    → Page "Qu'est-ce qu'une JE ?"
├── notre-equipe.html        → Page "Notre Équipe"
└── contact.html             → Page de contact
```

---

## 👥 Équipe — Ajouter / Modifier / Supprimer un membre

Tout se passe dans **`contenu/equipe.json`**.

### Modifier un membre existant

Trouve le membre par son nom et change les champs voulus :

```json
{
  "prenom": "Prénom",
  "nom": "Nom",
  "poste": "Président(e)",
  "description": "Texte de présentation...",
  "photo": "photos/equipe/prenom-nom.jpg",
  "linkedin": "https://linkedin.com/in/profil"
}
```

**Pour changer la photo :** dépose la nouvelle image dans `photos/equipe/` et mets à jour le champ `"photo"`.

### Ajouter un membre

Copie-colle un bloc existant dans le tableau `"bureau"` ou `"chefs_de_projets"` et remplis les infos :

```json
"chefs_de_projets": [
  { ... membre existant ... },
  {
    "prenom": "Nouveau",
    "nom": "Membre",
    "poste": "Chef de projets",
    "photo": "photos/equipe/nouveau-membre.jpg",
    "linkedin": ""
  }
]
```

### Supprimer un membre

Supprime simplement son bloc `{ ... }` du tableau (et la virgule avant ou après).

---

## 🗂️ Prestations — Ajouter / Modifier un domaine ou un service

### Modifier la description d'un domaine (Marketing, Finance…)

Dans **`contenu/prestations.json`**, trouve le domaine et modifie :

- `"description"` → texte affiché sous le titre du domaine
- `"exemples"` → les cartes "Exemples de missions réalisées"
- `"methodologie"` → les étapes "Notre approche"

### Ajouter un service (bouton cliquable)

Dans **`contenu/prestations.json`**, ajoute le nom dans `"tags"` :

```json
"tags": ["Étude de marché", "Segmentation client", "Nouveau service"]
```

Ensuite dans **`contenu/services.json`**, ajoute un bloc pour ce service :

```json
{
  "id": "nouveau-service",
  "domain": "marketing",
  "titre": "Nouveau service",
  "accroche": "Phrase d'accroche courte.",
  "description": "Description longue du service...",
  "approche": [
    { "titre": "Étape 1", "texte": "Description de l'étape..." },
    { "titre": "Étape 2", "texte": "Description de l'étape..." }
  ],
  "livrables": [
    { "titre": "Livrable 1", "texte": "Ce que le client reçoit..." },
    { "titre": "Livrable 2", "texte": "Ce que le client reçoit..." }
  ]
}
```

> **⚠️ Important :** L'`"id"` doit correspondre au nom du service en minuscules, sans accents, avec des tirets à la place des espaces.
> Ex : "Étude de marché" → `"etude-de-marche"`

### Supprimer un service

1. Retire son nom du tableau `"tags"` dans `prestations.json`
2. Supprime son bloc dans `services.json`

### Ajouter un domaine entier (ex: "Design")

Dans **`contenu/prestations.json`**, ajoute un bloc complet :

```json
{
  "id": "design",
  "titre": "Design",
  "icone": "",
  "description": "Description du domaine...",
  "tags": ["Identité visuelle", "UX Design"],
  "exemples": [
    { "client": "Nom client", "contexte": "Mission réalisée", "livrable": "Ce qui a été livré" }
  ],
  "methodologie": ["Étape 1", "Étape 2", "Étape 3"]
}
```

Puis ajoute les blocs services correspondants dans `services.json`.

---

## 🖼️ Photos de l'équipe

### Photos individuelles (bureau + chefs de projets)

1. **Prépare la photo** : format JPG ou PNG, idéalement carré (400×400 px minimum), fond neutre
2. **Dépose-la** dans le dossier `photos/equipe/`
3. **Nomme-la** de façon cohérente : `prenom-nom.jpg` (tout en minuscules, sans accents)
4. **Mets à jour** le champ `"photo"` dans `contenu/equipe.json`

```json
"photo": "photos/equipe/felix-pitz.jpg"
```

### Photo d'équipe (fond de la page "Notre Équipe")

La photo d'équipe s'affiche en arrière-plan du héros de la page "Notre Équipe".

1. **Prépare la photo** : format JPG ou PNG, large (min. 1200×600 px), paysage
2. **Dépose-la** dans le dossier `photos/` en la nommant : `photo-equipe.jpg`
3. **C'est tout !** La photo est automatiquement chargée par le site depuis `contenu/config.json`

Pour **changer la photo** : remplace simplement le fichier `photos/photo-equipe.jpg` par une nouvelle version, le site rechargera automatiquement.

---

## 🏷️ Logo du site (header + favicon)

Le logo affiché en haut de toutes les pages (et dans l'onglet du navigateur) est :
**`photos/logo.png`**

### Changer l'image du logo
1. Prépare un **PNG à fond transparent** (sinon un vilain pavé blanc apparaîtra
   sur les fonds foncés)
2. Remplace le fichier `photos/logo.png` — même nom, même dossier
3. C'est tout, il s'applique partout automatiquement

> 💾 L'ancien logo (fond blanc + traits de coupe) est conservé dans
> `photos/logo-original.png` au cas où.

### Changer la taille du logo
Ouvre **`logo-config.css`** (à la racine du site) et modifie une seule valeur :

```css
:root {
  --logo-height: 40px;   /* 32px = discret · 40px = normal · 48px = grand */
}
```

---

## ⚙️ Infos générales — Téléphone, email, réseaux sociaux

Dans **`contenu/config.json`** :

```json
{
  "contact": {
    "telephone": "+33 7 69 44 78 99",
    "email": "contact@ajc-mail.com",
    "adresse": "8 route de la Jonelière, 44312 Nantes Cedex 3"
  },
  "reseaux": {
    "linkedin": "https://linkedin.com/company/...",
    "instagram": "https://instagram.com/..."
  }
}
```

---

## 🚀 Publier les modifications sur le site

Après chaque modification, ouvre un terminal dans le dossier du site et lance :

```bash
vercel --prod
```

Le site est mis à jour en production en moins d'une minute.

---

## 📊 Suivi des visites (Analytics)

> À venir — voir avec l'équipe pour connecter Google Analytics ou Vercel Analytics.

---

## ❓ Aide

En cas de doute, ne modifie que les fichiers `.json` dans `contenu/` et les images dans `photos/`.
**Ne touche pas** aux fichiers `.html`, `.css` ou `.js` sans assistance technique.
