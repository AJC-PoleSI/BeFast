# Photos — Convention de nommage

## La règle d'or : modifier une photo = remplacer le fichier, **même nom, même dossier**.

Tu n'as alors **rien** à modifier dans `contenu/`. Si tu utilises un nouveau nom de
fichier, il faut mettre à jour le chemin correspondant dans le JSON concerné.

> Les photos du site sont en **`.webp`** (format le plus léger, donc site plus rapide).
> `.jpg` et `.png` fonctionnent aussi, mais si tu changes l'extension, pense à la
> corriger dans le JSON. Pour convertir une image en webp : <https://squoosh.app>.

---

## Logo du site

| Fichier | Rôle |
|---|---|
| `logo.png` | Logo du bandeau de toutes les pages + icône de l'onglet. **PNG à fond transparent obligatoire**, sinon un rectangle blanc apparaît sur les fonds sombres. |
| `logo-original.png` | Sauvegarde du logo d'origine (fond blanc + traits de coupe). Ne pas supprimer. |

Pour changer la **taille** du logo : ouvre `logo-config.css` à la racine du site et
modifie la valeur de `--logo-height`.

---

## Accueil

- `accueil/hero.webp` → grande photo de la page d'accueil (ratio 5:4, min 1200 px de large)

---

## Équipe

### Bureau et responsables de pôle → `equipe/bureau/`

Les noms de fichiers décrivent le **poste**, pas la personne : au changement de mandat,
on remplace simplement le fichier.

```
president.webp                 vice-president.webp
secretaire.webp                tresorier.webp
vice-tresorier.webp            coordinateur-tresorerie.webp
resp-dev-commercial.webp       resp-rh.webp
resp-si.webp                   resp-audit.webp
resp-marketing.webp
```

### Chefs de projet → `equipe/chefs-projet/`

- `cdp-01.webp` … `cdp-13.webp`
- Les numéros suivent **l'ordre de la liste `chefs_projet` de `contenu/equipe.json`**.
  Si tu ajoutes un membre, prends le numéro suivant (`cdp-14.webp`).

### Photo d'équipe

- `equipe/photo-equipe.webp` → bandeau en haut de la page « Notre Équipe ».
  Format paysage, min. 1600 px de large. Son chemin est déclaré dans
  `contenu/config.json` → `pages.notre_equipe_photo`.

---

## Logos partenaires → `partenaires/`

```
audencia.png            pwc.png                 lcl.png
cgi.png                 mantu.png               je-france.png
jen.png                 training-you.png        centrale-nantes.png
planete-grande-ecole.png                        cnje.png
```

`cnje.png` est utilisé séparément sur les pages « Qu'est-ce qu'une JE ? » et « La JE ».

**Pour ajouter un partenaire :**

1. Dépose son logo ici : `partenaires/nom-partenaire.png` (minuscules, tirets à la place
   des espaces, pas d'accent)
2. Ajoute son bloc dans `contenu/clients.json`, liste `partenaires` :
   ```json
   { "nom": "Nom Partenaire", "logo": "photos/partenaires/nom-partenaire.png",
     "lien": "https://exemple.com", "description": "Ce que ce partenariat nous apporte." }
   ```

Voir `docs/GUIDE-MODIFICATION-SITE.md` § 5.1 pour le détail.

---

## Logos clients → `clients/`

```
grdf.png        lvmh.png            vinci.png       saint-gobain.png
grant-thornton.png                  leroy-merlin.png
bnp-paribas.png total-energies.png  bagelstein.png
```

Même méthode, dans la liste `clients` de `contenu/clients.json`.

⚖️ On n'affiche un logo client qu'avec son **accord écrit**.

---

## Réalisations → `realisations/`

Voir `photos/realisations/README.md` et `contenu/README-realisations.md`.

---

## Formats recommandés

| Usage | Ratio | Taille minimale | Format |
|---|---|---|---|
| Portrait bureau | 3:4 portrait | 600 × 800 px | webp / jpg |
| Portrait chef de projet | 3:4 portrait | 300 × 400 px | webp / jpg |
| Hero accueil | 5:4 | 1200 × 960 px | webp / jpg |
| Photo d'équipe | paysage | 1600 px de large | webp / jpg |
| Logos clients & partenaires | libre | hauteur ~80 px | **PNG fond transparent** |

Si une photo manque ou si son chemin est faux, le site affiche un rectangle gris hachuré
avec le nom de la personne ou de l'entreprise — c'est le signal qu'il y a une faute de
frappe dans le chemin.
