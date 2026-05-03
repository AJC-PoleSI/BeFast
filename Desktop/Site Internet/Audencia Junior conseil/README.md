# Audencia Junior Conseil — Site vitrine

Site statique 4 pages pour Audencia Junior Conseil, la Junior-Entreprise d'Audencia Business School à Nantes.

## Lancer en local

```bash
npx serve .
```

Ouvrir http://localhost:PORT dans le navigateur.

> ⚠️ Ouvrir les fichiers HTML directement (double-clic) ne fonctionne **pas** — les fichiers JSON ne se chargent pas en protocole `file://`. Toujours utiliser un serveur HTTP local.

## Structure du projet

```
├── index.html          → Page d'accueil
├── la-je.html          → La Junior-Entreprise + équipe
├── prestations.html    → Nos prestations (accordéon)
├── contact.html        → Nous contacter (formulaire Formspree)
├── style.css           → CSS partagé (ne pas modifier sans raison)
│
├── contenu/            → MODIFIER ICI pour mettre à jour les textes
│   ├── equipe.json         → Membres du bureau, pôles, chefs de projets
│   ├── prestations.json    → Descriptions des 5 domaines d'expertise
│   ├── temoignages.json    → Citations clients pour le carousel
│   └── clients.json        → Logos clients et partenaires
│
└── photos/             → MODIFIER ICI pour mettre à jour les photos
    ├── README.md            → Convention de nommage des fichiers
    ├── accueil/
    │   └── hero.jpg         → Photo hero page d'accueil
    └── equipe/
        ├── bureau/          → Photos du bureau (president.jpg, etc.)
        └── chefs-projet/    → Photos CDP (cdp-01.jpg … cdp-24.jpg)
```

## Modifier le contenu (sans toucher au code)

### Changer une photo

1. Ouvre le bon dossier dans `photos/`
2. Supprime l'ancienne photo
3. Glisse la nouvelle photo avec **exactement le même nom de fichier**
4. C'est tout — le site se met à jour automatiquement

Voir `photos/README.md` pour la liste complète des noms de fichiers.

### Changer un texte

Ouvre le fichier JSON correspondant dans `contenu/` et modifie la valeur :

| Ce que tu veux changer | Fichier à ouvrir |
|------------------------|------------------|
| Nom, rôle, description d'un membre | `contenu/equipe.json` |
| Description d'une prestation | `contenu/prestations.json` |
| Témoignage client | `contenu/temoignages.json` |
| Logos clients / partenaires | `contenu/clients.json` |

### Changer les chiffres clés (page d'accueil)

Dans `index.html`, cherche `data-target=` et modifie les valeurs :
- `data-target="28"` → nombre d'études réalisées
- `data-target="45"` → années d'expérience
- `data-target="5"` → années certification ISO 9001
- `data-target="6000"` → nombre d'étudiants Audencia

## Formulaire de contact (Formspree)

Le formulaire utilise [Formspree](https://formspree.io). Pour l'activer :

1. Crée un compte sur formspree.io
2. Crée un nouveau formulaire
3. Dans `contact.html`, remplace `https://formspree.io/f/XXXXXXXX` par ton vrai endpoint

## Déploiement (OVH / Oracle Cloud)

Uploader **tous les fichiers et dossiers** via FTP à la racine du serveur web :

```
index.html
la-je.html
prestations.html
contact.html
style.css
contenu/
photos/
```

Le site fonctionne sur n'importe quel hébergement web statique (OVH, Oracle, GitHub Pages, Netlify, Vercel…).
