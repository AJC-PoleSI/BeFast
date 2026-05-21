# Photos — Convention de nommage

## Modifier une photo = remplacer le fichier, même nom, même dossier.

### Accueil
- `accueil/hero.jpg` → Grande photo hero de la page d'accueil (ratio 5:4, min 1200px large)

### Équipe — Bureau
- `equipe/bureau/president.jpg`
- `equipe/bureau/vice-president.jpg`
- `equipe/bureau/secretaire.jpg`
- `equipe/bureau/tresorier.jpg`

### Équipe — Chefs de projets
- `equipe/chefs-projet/cdp-01.jpg` … `cdp-24.jpg`
  Numéros dans le même ordre que dans contenu/equipe.json

### Logos Partenaires
- `partenaires/pwc.png`
- `partenaires/lcl.png`
- `partenaires/cgi.png`
- `partenaires/mantu.png`
- `partenaires/je-france.png`
- `partenaires/training-you.png`
- `partenaires/centrale-nantes.png`

Pour ajouter un nouveau partenaire :
1. Dépose son logo ici : `partenaires/nom-partenaire.png`
2. Ajoute une ligne dans `contenu/clients.json` :
   `{ "nom": "Nom Partenaire", "logo": "photos/partenaires/nom-partenaire.png" }`

### Logos Clients
- `clients/grdf.png`, `clients/lvmh.png`, etc.
- `grdf.png`
- `lvmh.png`
- `vinci.png`
- `bnp-paribas`
- `total-energies.png`
- `bagelstein.png`

## Format recommandé
- JPEG ou WebP pour les photos
- **PNG avec fond transparent pour les logos** (clients et partenaires)
- Bureau : ratio 3:4 (portrait), min 400×530px
- CDP : ratio 3:4, min 300×400px
- Hero : ratio 5:4, min 1200×960px
- Logos : hauteur max 80px recommandée, fond transparent
