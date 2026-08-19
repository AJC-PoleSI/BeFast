# Photos des réalisations

Chaque réalisation a **une seule image** affichée sur la carte (page index) et en cas similaire (page détail).

## Convention de nommage

Le nom du fichier = le `slug` dans `contenu/realisations.json`.

| Réalisation | Fichier attendu |
|---|---|
| Bagelstein | `bagelstein.jpg` |
| LVMH | `maison-luxe.jpg` |
| Saint-Gobain | `saint-gobain.jpg` |
| GRDF | `grdf.jpg` |
| Leroy Merlin | `leroy-merlin.jpg` |
| Vinci | `vinci.jpg` |
| Bouygues Telecom | `bouygues-telecom.jpg` |
| Sodexo | `sodexo.jpg` |
| Crédit Mutuel | `credit-mutuel.jpg` |

## Format recommandé

- **Ratio** : 16/9 (paysage)
- **Taille mini** : 800 × 450 px
- **Idéal** : 1200 × 675 px
- **Format** : JPG ou WebP

## Ajouter une nouvelle réalisation

1. Dépose ta photo dans ce dossier, ex. `mon-client.jpg`.
2. Dans `contenu/realisations.json`, ajoute un objet dans la liste `realisations` avec `"slug": "mon-client"` et `"image": "photos/realisations/mon-client.jpg"`.

## Si une image est manquante

La carte affichera un placeholder rayé avec le texte du champ `image_alt`. Aucun bug visuel.
