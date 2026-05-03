# Spec — Site vitrine Audencia Junior Conseil

**Date :** 2026-05-03  
**Objectif :** Site vitrine 4 pages ciblant les clients entreprises (PME, startups, grandes entreprises)  
**Stack :** HTML/CSS/JS statique + Formspree + Google Fonts/Maps  
**Hébergement :** Oracle Cloud Free Tier ou OVH, déploiement FTP  

---

## Architecture des fichiers

```
Audencia Junior Conseil/
│   index.html
│   la-je.html
│   prestations.html
│   contact.html
│   style.css                  ← CSS partagé (une seule source)
│
├── photos/
│   ├── accueil/
│   │   └── hero.jpg
│   └── equipe/
│       ├── bureau/
│       │   ├── president.jpg
│       │   ├── vice-president.jpg
│       │   ├── secretaire.jpg
│       │   └── tresorier.jpg
│       └── chefs-projet/
│           ├── cdp-01.jpg … cdp-N.jpg
│
└── contenu/
    ├── equipe.json
    ├── prestations.json
    ├── temoignages.json
    └── clients.json
```

---

## Charte graphique (inchangée)

- **Couleurs :** marine `#1A2744`, rose `#BE315B`, blanc `#FFFFFF`, gris bg `#F7F8FA`, gris texte `#6B7280`
- **Typographie :** Montserrat (Google Fonts) — weights 300/400/600/700/800
- **Rayon :** 3–8px selon composant
- **Boutons :** outline marine, solid marine, rose (3 variants)

---

## CSS partagé — style.css

Toutes les règles communes (reset, variables CSS, header, footer, boutons, responsive) sont extraites dans un seul `style.css` importé par les 4 pages. Chaque page HTML ne contient que les styles spécifiques à ses sections.

---

## Page 1 — index.html (Accueil)

Sections dans l'ordre :

1. **Header fixe** — logo réel (SVG/PNG), nav avec dropdowns, bouton "Nous contacter", effet scroll
2. **Hero** — fond marine, texte gauche, photo équipe/campus droite, badge ISO 9001, badge "45 ans", 2 CTAs (Demander un devis / La Junior-Entreprise)
3. **Valeurs** — split 50/50 : visuel marine à gauche + "Nos Atouts" (3 items numérotés) à droite
4. **Chiffres clés** — 4 compteurs animés (études réalisées, années d'expérience, ans ISO 9001, étudiants Audencia)
5. **Expertise** — 5 cards + 1 card "Autre ?" → lien vers prestations.html
6. **Pourquoi nous choisir** — 3 colonnes (Qualité ISO, Tarifs compétitifs, Suivi rigoureux)
7. **Méthodologie** — 4 étapes horizontales (Prise de contact → Proposition → Réalisation → Livraison)
8. **Témoignages** — carousel auto (Bagelstein, GRDF, Vinci, Saint-Gobain)
9. **Ils nous ont fait confiance** — logos clients en chips (vrais noms)
10. **Nos Partenaires** — logos partenaires en chips
11. **Pre-footer CTA** — bandeau "Besoin d'un accompagnement ?"
12. **CTA finale** — fond marine, "Prêt à accélérer votre projet ?" + bouton rose
13. **Footer** — 3 colonnes (contact, Google Maps embed, mentions légales + liens JE) + copyright

**Menu mobile :** hamburger visible < 900px, ouvre un drawer plein écran avec navigation.

---

## Page 2 — la-je.html (La Junior-Entreprise)

1. **Header** + sous-nav sticky (Qu'est-ce qu'une JE ? / Notre équipe / Nous contacter)
2. **Hero banner** marine — titre + sous-titre
3. **Qu'est-ce qu'une JE ?** — texte + photo campus, citation CNJE, 3 cards atouts, stats mouvement (200+ JE, 20 000 JE, 9,45M€, 1967), bloc CNJE, bloc Code de Déontologie
4. **Notre Équipe**
   - Bureau (4 membres) : photo depuis `photos/equipe/bureau/`, nom/rôle/desc depuis `contenu/equipe.json`
   - Responsables de pôles (4 membres) : même source
   - 24 Chefs de projets : photos depuis `photos/equipe/chefs-projet/`, données depuis `contenu/equipe.json`
   - CTA "Rejoindre AJC"
5. **CTA finale** + Footer simplifié

---

## Page 3 — prestations.html (Nos Prestations) — Design innovant

**Concept : navigation progressive sur une seule page, zéro page supplémentaire.**

### Structure visuelle

```
┌────────────────────────────────────────────────────┐
│  Hero — "Nos Prestations"                          │
├────────────────────────────────────────────────────┤
│  5 tuiles de domaine (sticky en haut lors du scroll)│
│  [Marketing] [Communication] [RSE] [Big Data] [Finance] │
├────────────────────────────────────────────────────┤
│  Section active — accordéon :                      │
│  • Description courte (visible immédiatement)      │
│  • En scrollant → exemples de missions (reveal)    │
│  • En scrollant → mini-méthodologie spécifique     │
│  • CTA "Demander un devis pour ce domaine"         │
│    → contact.html?domaine=marketing                │
└────────────────────────────────────────────────────┘
```

### Comportement

- Au chargement : Marketing actif par défaut, son contenu déployé
- Clic sur une tuile : smooth scroll vers la section + contenu qui s'ouvre (height transition CSS)
- Un seul domaine ouvert à la fois (accordéon)
- Les détails (exemples, méthodologie) sont masqués initialement et révélés par IntersectionObserver au scroll dans la section
- Pas de React — HTML/CSS/JS pur

### Données

Le contenu (description, sous-missions, exemples) vient de `contenu/prestations.json` — chargé par un petit script JS au démarrage.

### Contenu par domaine (5 domaines)

Chaque domaine expose :
- Titre + icône SVG
- Description courte (2–3 phrases)
- 4–6 tags de sous-missions
- 2–3 exemples de missions réelles (client, contexte, livrable)
- CTA devis pré-rempli

---

## Page 4 — contact.html (Nous contacter)

1. **Hero** — "Parlons de votre projet"
2. **Formulaire Formspree** :
   - Prénom / Nom
   - Email professionnel
   - Nom de l'entreprise
   - Type de projet (select : Marketing / Communication / RSE / Big Data / Finance / Autre) — pré-rempli si `?domaine=X` dans l'URL
   - Description du projet (textarea)
   - Bouton "Envoyer ma demande"
   - Message de confirmation après envoi (sans rechargement)
3. **Bloc contact direct** — email, téléphone, adresse Audencia
4. **Google Maps iframe** — Audencia Business School, Nantes
5. **Footer**

---

## Système no-code

### Photos — convention de nommage

Remplacer un fichier = le site se met à jour. Noms de fichiers fixes documentés :

| Fichier | Contenu |
|---------|---------|
| `photos/accueil/hero.jpg` | Photo hero page d'accueil |
| `photos/equipe/bureau/president.jpg` | Photo de la présidente |
| `photos/equipe/bureau/vice-president.jpg` | Photo VP |
| `photos/equipe/bureau/secretaire.jpg` | Photo SG |
| `photos/equipe/bureau/tresorier.jpg` | Photo trésorier |
| `photos/equipe/chefs-projet/cdp-01.jpg` … | Photos CDP (numérotées) |

### Textes — fichiers JSON

Modifier un texte = ouvrir le bon JSON, changer la valeur, sauvegarder.

**contenu/equipe.json** — noms, rôles, descriptions, LinkedIn de tous les membres  
**contenu/prestations.json** — descriptions, sous-missions, exemples par domaine  
**contenu/temoignages.json** — citations, auteurs, rôles pour le carousel  
**contenu/clients.json** — liste des logos clients et partenaires  

### Ce qui reste dans le HTML (non modifiable sans coder)

- Structure des sections (header, footer, ordre des blocs)
- Chiffres clés (modifiables via `data-target` dans index.html, 1 ligne chacun)
- Textes de structure fixes (titres de sections, labels)

---

## Améliorations vs mockups

| Élément | Mockups | Site final |
|---------|---------|------------|
| CSS | ~1000 lignes par page | 1 fichier style.css partagé |
| Menu mobile | Nav cachée | Hamburger + drawer |
| Logo | Carré AJC texte | Vrai logo PNG/SVG |
| Photos | Placeholders | Vraies photos dans `photos/` |
| Contact | Lien mailto | Formspree (formulaire fonctionnel) |
| Carte | Placeholder | Google Maps iframe |
| Prestations | Page React CDN | HTML pur, accordéon progressif |
| Données | Codées en dur | JSON séparés (no-code) |

---

## Hors scope

- CMS ou back-office web
- Blog ou actualités
- Espace membre
- Multilingue
