# AJC Website Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete 4-page static website for Audencia Junior Conseil, with shared CSS, JSON-driven content, accordéon prestations page, Formspree contact form, and a no-code folder system for images and text.

**Architecture:** All pages share `style.css` for common styles. Dynamic content (team, testimonials, clients, prestations) lives in `contenu/*.json` files loaded by inline JS. Photos are referenced by convention from `photos/` subdirectories — replacing a file updates the site instantly.

**Tech Stack:** HTML5, CSS3, Vanilla JS (ES6), Formspree, Google Fonts (Montserrat), Google Maps iframe

**Reference mockups location:** `/Users/felixpitz/Downloads/Audencia Junior Cnseil/`  
(index.html, La Junior-Entreprise.html, Nos Prestations.html, Nous contacter.html)

---

## File Map

| File | Role |
|------|------|
| `style.css` | Shared CSS: variables, reset, header, hamburger drawer, footer, buttons, responsive |
| `index.html` | Homepage — all sections, loads temoignages.json + clients.json |
| `la-je.html` | La JE + Équipe page — loads equipe.json |
| `prestations.html` | Accordéon prestations — loads prestations.json |
| `contact.html` | Contact form (Formspree) + Google Maps |
| `contenu/equipe.json` | Team data: bureau, pôles, chefs de projets |
| `contenu/prestations.json` | 5 domains with descriptions, tags, examples |
| `contenu/temoignages.json` | Carousel testimonials |
| `contenu/clients.json` | Client logos + partner logos |
| `photos/` | Image directories (see no-code system) |

---

## Task 1 — Folder structure

**Files:**
- Create: `contenu/` directory
- Create: `photos/accueil/`, `photos/equipe/bureau/`, `photos/equipe/chefs-projet/`
- Create: `photos/README.md`

- [ ] **Step 1: Create all directories**

```bash
cd "/Users/felixpitz/Desktop/Site Internet/Audencia Junior conseil"
mkdir -p contenu
mkdir -p photos/accueil
mkdir -p photos/equipe/bureau
mkdir -p photos/equipe/chefs-projet
```

- [ ] **Step 2: Write photos README**

Create `photos/README.md`:

```markdown
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

## Format recommandé
- JPEG ou WebP
- Bureau : ratio 3:4 (portrait), min 400×530px
- CDP : ratio 3:4, min 300×400px
- Hero : ratio 5:4, min 1200×960px
```

- [ ] **Step 3: Copy Photo folder from existing project**

```bash
cp -r "/Users/felixpitz/Desktop/Site Internet/Audencia Junior conseil/Photo/"* \
      "/Users/felixpitz/Desktop/Site Internet/Audencia Junior conseil/photos/" 2>/dev/null || true
```

- [ ] **Step 4: Commit**

```bash
cd "/Users/felixpitz/Desktop/Site Internet/Audencia Junior conseil"
git add photos/ contenu/
git commit -m "feat: create photo and content directory structure"
```

---

## Task 2 — JSON data files

**Files:**
- Create: `contenu/equipe.json`
- Create: `contenu/prestations.json`
- Create: `contenu/temoignages.json`
- Create: `contenu/clients.json`

- [ ] **Step 1: Write contenu/equipe.json**

```json
{
  "bureau": [
    {
      "nom": "Émilie Munsch",
      "role": "Présidente",
      "description": "Émilie élabore la stratégie et s'assure de sa bonne mise en œuvre avec le soutien du bureau. En tant que représentante pénale de la Junior, elle coordonne l'ensemble des 24 chefs de projets tout en étant gardienne de la cohésion du mandat.",
      "photo": "photos/equipe/bureau/president.jpg",
      "linkedin": "#"
    },
    {
      "nom": "Pierrick Rimaudière",
      "role": "Vice-Président",
      "description": "Pierrick s'occupe de développer les partenariats avec les différentes parties-prenantes d'AJC. Il pilote l'efficacité des processus et contribue à leur amélioration continue en suivant les indicateurs de risques et de performances.",
      "photo": "photos/equipe/bureau/vice-president.jpg",
      "linkedin": "#"
    },
    {
      "nom": "Clara Chiche",
      "role": "Secrétaire Générale",
      "description": "Premier point de contact entre vous et Audencia Junior Conseil, Clara relaie vos besoins à nos chefs de projet afin d'établir la rédaction d'un devis. Elle veille aussi au bon fonctionnement administratif de la structure.",
      "photo": "photos/equipe/bureau/secretaire.jpg",
      "linkedin": "#"
    },
    {
      "nom": "Arthur Robin",
      "role": "Trésorier",
      "description": "Arthur est au cœur du fonctionnement interne de la structure. Il est en charge de la partie financière des études et de la structure, effectue l'ensemble des paiements et s'assure du contrôle interne du pôle Trésorerie.",
      "photo": "photos/equipe/bureau/tresorier.jpg",
      "linkedin": "#"
    }
  ],
  "poles": [
    { "nom": "Victoire Gorrioux", "role": "Responsable Développement Commercial", "photo": "photos/equipe/bureau/resp-dev-commercial.jpg", "linkedin": "#" },
    { "nom": "Anna Von Borowski", "role": "Responsable Ressources Humaines", "photo": "photos/equipe/bureau/resp-rh.jpg", "linkedin": "#" },
    { "nom": "Clémence Defosseux", "role": "Responsable Audit-Qualité", "photo": "photos/equipe/bureau/resp-audit.jpg", "linkedin": "#" },
    { "nom": "Esther Gesny", "role": "Responsable Marketing", "photo": "photos/equipe/bureau/resp-marketing.jpg", "linkedin": "#" }
  ],
  "chefs_projet": [
    { "nom": "Chef de Projet 1", "role": "Marketing", "photo": "photos/equipe/chefs-projet/cdp-01.jpg", "linkedin": "#" },
    { "nom": "Chef de Projet 2", "role": "Communication", "photo": "photos/equipe/chefs-projet/cdp-02.jpg", "linkedin": "#" },
    { "nom": "Chef de Projet 3", "role": "Finance", "photo": "photos/equipe/chefs-projet/cdp-03.jpg", "linkedin": "#" },
    { "nom": "Chef de Projet 4", "role": "RSE", "photo": "photos/equipe/chefs-projet/cdp-04.jpg", "linkedin": "#" },
    { "nom": "Chef de Projet 5", "role": "Big Data", "photo": "photos/equipe/chefs-projet/cdp-05.jpg", "linkedin": "#" },
    { "nom": "Chef de Projet 6", "role": "Études", "photo": "photos/equipe/chefs-projet/cdp-06.jpg", "linkedin": "#" },
    { "nom": "Chef de Projet 7", "role": "Digital", "photo": "photos/equipe/chefs-projet/cdp-07.jpg", "linkedin": "#" },
    { "nom": "Chef de Projet 8", "role": "Stratégie", "photo": "photos/equipe/chefs-projet/cdp-08.jpg", "linkedin": "#" }
  ]
}
```

- [ ] **Step 2: Write contenu/prestations.json**

```json
{
  "domaines": [
    {
      "id": "marketing",
      "titre": "Marketing",
      "icone": "chart",
      "description": "Nos consultants réalisent des études de marché approfondies et des analyses stratégiques pour vous aider à comprendre votre environnement, vos clients et vos concurrents.",
      "tags": ["Étude de marché", "Segmentation client", "Analyse concurrentielle", "Lancement produit", "Stratégie de marque"],
      "exemples": [
        { "client": "Bagelstein", "contexte": "Lancement d'un nouveau produit sur le marché nantais", "livrable": "Étude de marché complète + recommandations stratégiques" },
        { "client": "Leroy Merlin", "contexte": "Analyse de la satisfaction client en magasin", "livrable": "Rapport d'analyse + plan d'actions prioritaires" }
      ],
      "methodologie": ["Cadrage du besoin", "Collecte de données (quali/quanti)", "Analyse et benchmark", "Livrables et recommandations"]
    },
    {
      "id": "communication",
      "titre": "Communication",
      "icone": "megaphone",
      "description": "De la stratégie éditoriale à l'identité de marque, nous vous aidons à construire une communication cohérente, efficace et adaptée à vos cibles.",
      "tags": ["Stratégie éditoriale", "Identité de marque", "Plan media", "Community management", "Communication digitale"],
      "exemples": [
        { "client": "PME Nantaise", "contexte": "Refonte de l'identité visuelle et stratégie social media", "livrable": "Charte graphique + calendrier éditorial 6 mois" },
        { "client": "Association sportive", "contexte": "Lancement de campagne de communication", "livrable": "Plan de communication complet + supports" }
      ],
      "methodologie": ["Audit de l'existant", "Définition des cibles", "Élaboration de la stratégie", "Création des supports"]
    },
    {
      "id": "rse",
      "titre": "RSE",
      "icone": "leaf",
      "description": "Nous accompagnons les entreprises dans leur transition vers des pratiques plus responsables : diagnostics, bilans carbone, stratégies RSE et rapports extra-financiers.",
      "tags": ["Diagnostic RSE", "Bilan carbone", "Stratégie développement durable", "Rapport extra-financier", "CSRD"],
      "exemples": [
        { "client": "GRDF", "contexte": "Diagnostic RSE et stratégie de transition énergétique", "livrable": "Rapport RSE complet + feuille de route" },
        { "client": "Vinci Energies", "contexte": "Bilan carbone et plan de réduction des émissions", "livrable": "Bilan carbone certifié + recommandations" }
      ],
      "methodologie": ["Diagnostic initial", "Collecte des données", "Analyse des impacts", "Plan d'action RSE"]
    },
    {
      "id": "bigdata",
      "titre": "Big Data",
      "icone": "bars",
      "description": "Transformez vos données brutes en insights actionnables. Nos consultants maîtrisent l'analyse de données, la data visualisation et la modélisation prédictive.",
      "tags": ["Analyse de données", "Data visualisation", "Tableaux de bord", "Modélisation prédictive", "Business Intelligence"],
      "exemples": [
        { "client": "Groupe retail", "contexte": "Création d'un tableau de bord de suivi des KPIs commerciaux", "livrable": "Dashboard Power BI + documentation" },
        { "client": "Startup SaaS", "contexte": "Analyse des données d'usage et segmentation clients", "livrable": "Analyse statistique + recommandations produit" }
      ],
      "methodologie": ["Recueil et nettoyage des données", "Exploration et analyse", "Modélisation", "Visualisation et restitution"]
    },
    {
      "id": "finance",
      "titre": "Finance",
      "icone": "shield",
      "description": "Business plans, valorisations d'entreprise, analyses de rentabilité : nos consultants financiers vous accompagnent dans vos décisions stratégiques à fort enjeu.",
      "tags": ["Business plan", "Valorisation d'entreprise", "Analyse financière", "Étude de rentabilité", "Due diligence"],
      "exemples": [
        { "client": "Saint-Gobain", "contexte": "Analyse financière et business plan pour une nouvelle activité", "livrable": "Business plan complet + modèle financier Excel" },
        { "client": "Start-up deeptech", "contexte": "Valorisation pré-levée de fonds", "livrable": "Note de valorisation + pitch deck financier" }
      ],
      "methodologie": ["Analyse de l'existant", "Modélisation financière", "Tests de sensibilité", "Synthèse et recommandations"]
    }
  ]
}
```

- [ ] **Step 3: Write contenu/temoignages.json**

```json
{
  "temoignages": [
    {
      "quote": "Une Junior-Entreprise professionnelle et efficace. L'équipe a su s'adapter à nos contraintes et livrer un travail de qualité dans les délais impartis.",
      "auteur": "Bagelstein",
      "mission": "Étude Marketing — Lancement produit"
    },
    {
      "quote": "Nous avons été bluffés par la rigueur et la créativité des consultants d'AJC. Le rapport rendu dépassait nos attentes, tant en fond qu'en forme.",
      "auteur": "GRDF",
      "mission": "Diagnostic RSE — Transition énergétique"
    },
    {
      "quote": "AJC a réalisé pour nous une étude de marché complète avec une réactivité remarquable. Je recommande vivement cette Junior-Entreprise à toute organisation ambitieuse.",
      "auteur": "Vinci Energies",
      "mission": "Étude de marché — Expansion régionale"
    },
    {
      "quote": "Le sérieux, l'implication et la qualité des livrables nous ont convaincus de retravailler avec AJC dès notre prochain projet de développement.",
      "auteur": "Saint-Gobain",
      "mission": "Analyse financière — Business plan"
    }
  ]
}
```

- [ ] **Step 4: Write contenu/clients.json**

```json
{
  "clients": ["GRDF", "LVMH", "Vinci", "Saint-Gobain", "Grant Thornton", "Leroy Merlin", "BNP Paribas", "TotalEnergies", "Bagelstein"],
  "partenaires": ["PwC", "LCL", "CGI", "Mantu", "JE France", "Training You", "Centrale Nantes Études"]
}
```

- [ ] **Step 5: Commit**

```bash
cd "/Users/felixpitz/Desktop/Site Internet/Audencia Junior conseil"
git add contenu/
git commit -m "feat: add JSON content files for no-code editing"
```

---

## Task 3 — style.css (shared stylesheet)

**Files:**
- Create: `style.css`

- [ ] **Step 1: Write style.css**

Create `style.css` with all shared styles. This file is imported by every page via `<link rel="stylesheet" href="style.css">`.

```css
/* ── RESET & VARIABLES ──────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --marine: #1A2744;
  --rose: #BE315B;
  --white: #FFFFFF;
  --gray-bg: #F7F8FA;
  --gray-text: #6B7280;
  --gray-border: #E5E7EB;
}

html { scroll-behavior: smooth; }
body { font-family: 'Montserrat', sans-serif; color: var(--marine); background: var(--white); overflow-x: hidden; }

/* ── HEADER ────────────────────────────────────────────────────── */
header {
  position: fixed; top: 0; left: 0; right: 0; z-index: 200;
  background: var(--white); border-bottom: 1px solid transparent;
  padding: 0 48px; height: 68px; display: flex; align-items: center;
  transition: border-color 0.3s, box-shadow 0.3s;
}
header.scrolled { border-color: var(--gray-border); box-shadow: 0 2px 16px rgba(26,39,68,0.06); }
.header-inner { width: 100%; display: flex; align-items: center; justify-content: space-between; }

/* Logo */
.logo { display: flex; align-items: center; gap: 10px; text-decoration: none; }
.logo-mark { width: 38px; height: 38px; background: var(--marine); display: flex; align-items: center; justify-content: center; border-radius: 4px; overflow: hidden; }
.logo-mark img { width: 100%; height: 100%; object-fit: contain; }
.logo-mark span { color: white; font-size: 13px; font-weight: 800; }
.logo-text { font-size: 13px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: var(--marine); line-height: 1.2; }
.logo-text small { display: block; font-size: 10px; font-weight: 400; letter-spacing: 2px; color: var(--gray-text); }

/* Desktop nav */
nav { display: flex; align-items: center; gap: 36px; position: absolute; left: 50%; transform: translateX(-50%); }
nav a { text-decoration: none; font-size: 13px; font-weight: 600; letter-spacing: 0.5px; color: var(--marine); opacity: 0.8; transition: opacity 0.2s; white-space: nowrap; }
nav a:hover, nav a.active { opacity: 1; }
nav a.active { border-bottom: 2px solid var(--rose); padding-bottom: 2px; }
.arr { font-size: 10px; margin-left: 3px; opacity: 0.5; }

/* Dropdown */
.nav-item { position: relative; }
.nav-item > a { display: flex; align-items: center; gap: 3px; padding: 8px 0; }
.dropdown {
  position: absolute; top: calc(100% + 8px); left: 50%;
  transform: translateX(-50%) translateY(6px);
  background: var(--white); border: 1px solid var(--gray-border);
  border-radius: 8px; box-shadow: 0 8px 32px rgba(26,39,68,0.12);
  min-width: 220px; padding: 8px 0;
  opacity: 0; visibility: hidden;
  transition: opacity 0.2s, transform 0.2s, visibility 0.2s; z-index: 300;
}
.nav-item:hover .dropdown { opacity: 1; visibility: visible; transform: translateX(-50%) translateY(0); }
.dropdown::before {
  content: ''; position: absolute; top: -5px; left: 50%;
  transform: translateX(-50%) rotate(45deg);
  width: 9px; height: 9px; background: var(--white);
  border-left: 1px solid var(--gray-border); border-top: 1px solid var(--gray-border);
}
.dropdown-item { display: flex; align-items: center; gap: 12px; padding: 10px 18px; text-decoration: none; transition: background 0.15s; }
.dropdown-item:hover { background: var(--gray-bg); }
.dropdown-item:hover .di-title { color: var(--rose); }
.di-icon { width: 32px; height: 32px; background: var(--gray-bg); border-radius: 5px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.di-icon svg { width: 15px; height: 15px; stroke: var(--marine); fill: none; stroke-width: 2; }
.di-title { display: block; font-size: 12px; font-weight: 700; color: var(--marine); }
.di-sub { display: block; font-size: 10px; color: var(--gray-text); margin-top: 1px; }
.dropdown-divider { height: 1px; background: var(--gray-border); margin: 6px 0; }

/* ── HAMBURGER ──────────────────────────────────────────────────── */
.hamburger {
  display: none; flex-direction: column; gap: 5px;
  cursor: pointer; padding: 8px; border: none; background: none;
  z-index: 210;
}
.hamburger span {
  display: block; width: 22px; height: 2px;
  background: var(--marine); border-radius: 2px;
  transition: transform 0.3s, opacity 0.3s;
}
.hamburger.open span:nth-child(1) { transform: translateY(7px) rotate(45deg); }
.hamburger.open span:nth-child(2) { opacity: 0; }
.hamburger.open span:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }

/* Mobile drawer */
.mobile-drawer {
  display: none; position: fixed; inset: 0; z-index: 205;
  background: var(--white); padding: 100px 40px 40px;
  flex-direction: column; gap: 8px;
  transform: translateX(100%); transition: transform 0.3s ease;
}
.mobile-drawer.open { transform: translateX(0); }
.mobile-drawer a {
  display: block; font-size: 20px; font-weight: 700;
  color: var(--marine); text-decoration: none; padding: 14px 0;
  border-bottom: 1px solid var(--gray-border);
}
.mobile-drawer a:hover { color: var(--rose); }
.mobile-drawer .drawer-cta { margin-top: 32px; }

/* ── BUTTONS ────────────────────────────────────────────────────── */
.btn-outline-marine {
  border: 2px solid var(--marine); background: transparent; color: var(--marine);
  padding: 9px 20px; font-family: 'Montserrat', sans-serif; font-size: 12px;
  font-weight: 700; letter-spacing: 1px; text-transform: uppercase;
  cursor: pointer; border-radius: 3px; transition: background 0.2s, color 0.2s;
  text-decoration: none; display: inline-block;
}
.btn-outline-marine:hover { background: var(--marine); color: white; }

.btn-solid-marine {
  border: 2px solid var(--marine); background: var(--marine); color: white;
  padding: 13px 28px; font-family: 'Montserrat', sans-serif; font-size: 12px;
  font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase;
  cursor: pointer; border-radius: 3px; transition: background 0.2s;
  text-decoration: none; display: inline-block;
}
.btn-solid-marine:hover { background: #243660; border-color: #243660; }

.btn-rose {
  border: 2px solid var(--rose); background: var(--rose); color: white;
  padding: 13px 28px; font-family: 'Montserrat', sans-serif; font-size: 12px;
  font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase;
  cursor: pointer; border-radius: 3px; transition: background 0.2s;
  text-decoration: none; display: inline-block;
}
.btn-rose:hover { background: #a8274e; border-color: #a8274e; }

.btn-hero-primary {
  background: white; color: var(--marine); border: 2px solid white;
  padding: 14px 32px; font-family: 'Montserrat', sans-serif; font-size: 12px;
  font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase;
  cursor: pointer; border-radius: 3px; transition: background 0.2s, color 0.2s;
  text-decoration: none; display: inline-block;
}
.btn-hero-primary:hover { background: transparent; color: white; }

.btn-hero-secondary {
  background: transparent; color: rgba(255,255,255,0.8); border: 2px solid rgba(255,255,255,0.3);
  padding: 14px 32px; font-family: 'Montserrat', sans-serif; font-size: 12px;
  font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase;
  cursor: pointer; border-radius: 3px; transition: border-color 0.2s, color 0.2s;
  text-decoration: none; display: inline-block;
}
.btn-hero-secondary:hover { border-color: white; color: white; }

/* ── SHARED SECTION STYLES ──────────────────────────────────────── */
.section-label { font-size: 11px; font-weight: 700; letter-spacing: 4px; text-transform: uppercase; color: var(--rose); margin-bottom: 16px; }
.section-title { font-size: 32px; font-weight: 800; letter-spacing: 3px; text-transform: uppercase; color: var(--marine); line-height: 1.15; margin-bottom: 16px; }
.section-title .thin { font-weight: 300; }
.section-accent { width: 40px; height: 3px; background: var(--rose); margin-bottom: 20px; }
.section-desc { font-size: 14px; color: var(--gray-text); line-height: 1.7; }

/* Page hero banner (inner pages) */
.page-hero { margin-top: 68px; background: var(--marine); padding: 80px 48px; position: relative; overflow: hidden; }
.page-hero::before { content: 'AJC'; position: absolute; right: -40px; top: 50%; transform: translateY(-50%); font-size: 280px; font-weight: 800; color: rgba(255,255,255,0.04); letter-spacing: -10px; pointer-events: none; }
.page-hero-inner { max-width: 1200px; margin: 0 auto; }
.page-hero-eyebrow { font-size: 11px; font-weight: 700; letter-spacing: 4px; text-transform: uppercase; color: var(--rose); margin-bottom: 16px; }
.page-hero-title { font-size: 52px; font-weight: 800; color: white; line-height: 1.1; margin-bottom: 16px; }
.page-hero-sub { font-size: 16px; color: rgba(255,255,255,0.55); max-width: 520px; line-height: 1.7; }

/* Logo chip (clients / partenaires) */
.logo-chip { padding: 14px 28px; background: var(--white); border: 1.5px solid var(--gray-border); border-radius: 6px; font-size: 13px; font-weight: 700; letter-spacing: 1px; color: var(--marine); transition: border-color 0.2s, box-shadow 0.2s; }
.logo-chip:hover { border-color: var(--marine); box-shadow: 0 2px 12px rgba(26,39,68,0.08); }
.logos-grid { display: flex; flex-wrap: wrap; gap: 16px; justify-content: center; align-items: center; }

/* Team card (CDP) */
.cdp-card { background: var(--white); border: 1.5px solid var(--gray-border); border-radius: 8px; overflow: hidden; transition: border-color 0.2s, transform 0.2s; }
.cdp-card:hover { border-color: var(--marine); transform: translateY(-2px); }
.cdp-photo img { width: 100%; aspect-ratio: 3/4; object-fit: cover; display: block; }
.cdp-photo .ph { border-radius: 0; aspect-ratio: 3/4; width: 100%; background: var(--gray-bg); display: flex; align-items: center; justify-content: center; }
.cdp-info { padding: 16px; }
.cdp-name { font-size: 13px; font-weight: 700; color: var(--marine); margin-bottom: 3px; }
.cdp-role { font-size: 11px; color: var(--gray-text); font-weight: 500; margin-bottom: 10px; }
.cdp-linkedin { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; background: #0077B5; border-radius: 4px; }
.cdp-linkedin svg { width: 14px; height: 14px; fill: white; }

/* ── FOOTER ─────────────────────────────────────────────────────── */
footer { background: #111D35; padding: 72px 48px 40px; color: rgba(255,255,255,0.6); }
.footer-inner { max-width: 1200px; margin: 0 auto; }
.footer-grid { display: grid; grid-template-columns: 1.2fr 1.4fr 1fr; gap: 64px; margin-bottom: 56px; }
.footer-col-title { font-size: 11px; font-weight: 700; letter-spacing: 4px; text-transform: uppercase; color: rgba(255,255,255,0.3); margin-bottom: 24px; }
.footer-contact-item { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 14px; font-size: 13px; line-height: 1.5; }
.footer-contact-item svg { width: 15px; height: 15px; stroke: var(--rose); fill: none; stroke-width: 2; flex-shrink: 0; margin-top: 2px; }
.footer-socials { display: flex; gap: 12px; margin-top: 24px; }
.social-btn { width: 36px; height: 36px; border: 1px solid rgba(255,255,255,0.15); border-radius: 4px; display: flex; align-items: center; justify-content: center; text-decoration: none; color: rgba(255,255,255,0.5); font-size: 13px; font-weight: 700; transition: border-color 0.2s, color 0.2s; }
.social-btn:hover { border-color: var(--rose); color: var(--rose); }
.footer-map iframe { width: 100%; aspect-ratio: 16/9; border-radius: 6px; border: 1px solid rgba(255,255,255,0.08); display: block; }
.footer-mentions a { display: block; font-size: 12px; color: rgba(255,255,255,0.35); text-decoration: none; margin-bottom: 10px; transition: color 0.2s; }
.footer-mentions a:hover { color: rgba(255,255,255,0.7); }
.footer-bottom { border-top: 1px solid rgba(255,255,255,0.08); padding-top: 28px; display: flex; align-items: center; justify-content: space-between; }
.footer-logo-ghost { font-size: 28px; font-weight: 800; letter-spacing: 4px; color: rgba(255,255,255,0.06); text-transform: uppercase; }
.footer-copyright { font-size: 11px; color: rgba(255,255,255,0.2); }

/* ── SHARED HEADER JS BEHAVIOUR (inline in each page) ── */
/* applied via JS: header.classList.toggle('scrolled', ...) */

/* ── RESPONSIVE ─────────────────────────────────────────────────── */
@media (max-width: 900px) {
  header { padding: 0 24px; }
  nav { display: none; }
  .hamburger { display: flex; }
  .mobile-drawer { display: flex; }
  .page-hero { padding: 60px 24px; }
  .page-hero-title { font-size: 36px; }
  .footer-grid { grid-template-columns: 1fr; gap: 40px; }
  footer { padding: 48px 24px 32px; }
}
```

- [ ] **Step 2: Verify file was written**

```bash
wc -l "/Users/felixpitz/Desktop/Site Internet/Audencia Junior conseil/style.css"
```
Expected: ~200+ lines

- [ ] **Step 3: Commit**

```bash
cd "/Users/felixpitz/Desktop/Site Internet/Audencia Junior conseil"
git add style.css
git commit -m "feat: add shared stylesheet with header, hamburger, footer, buttons"
```

---

## Task 4 — Shared HTML components (header + footer snippets)

These are copy-paste snippets used identically in all 4 pages. Document them here; implement them within each page task.

**Header HTML (same on every page):**
```html
<header id="main-header">
  <div class="header-inner">
    <a href="index.html" class="logo">
      <div class="logo-mark">
        <!-- If logo PNG exists: <img src="photos/logo.png" alt="AJC"> -->
        <span>AJC</span>
      </div>
      <div class="logo-text">Audencia <small>Junior Conseil</small></div>
    </a>
    <nav>
      <div class="nav-item">
        <a href="la-je.html">La Junior-Entreprise <span class="arr">▾</span></a>
        <div class="dropdown">
          <a href="la-je.html#qu-est-ce" class="dropdown-item">
            <div class="di-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16v.1"/></svg></div>
            <span><span class="di-title">Qu'est-ce qu'une JE ?</span><span class="di-sub">Le mouvement Junior-Entreprises</span></span>
          </a>
          <a href="la-je.html#equipe" class="dropdown-item">
            <div class="di-icon"><svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3a4 4 0 010 7.75"/></svg></div>
            <span><span class="di-title">Notre Équipe</span><span class="di-sub">Bureau et chefs de projets</span></span>
          </a>
          <div class="dropdown-divider"></div>
          <a href="contact.html" class="dropdown-item">
            <div class="di-icon"><svg viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 7l10 6 10-6"/></svg></div>
            <span><span class="di-title">Nous contacter</span><span class="di-sub">Demander un devis</span></span>
          </a>
        </div>
      </div>
      <div class="nav-item">
        <a href="prestations.html">Nos prestations <span class="arr">▾</span></a>
        <div class="dropdown">
          <a href="prestations.html#marketing" class="dropdown-item">
            <div class="di-icon"><svg viewBox="0 0 24 24"><path d="M3 18L9 12L13 16L18 9L22 13"/></svg></div>
            <span><span class="di-title">Marketing</span><span class="di-sub">Études de marché, stratégie</span></span>
          </a>
          <a href="prestations.html#communication" class="dropdown-item">
            <div class="di-icon"><svg viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg></div>
            <span><span class="di-title">Communication</span><span class="di-sub">Stratégie éditoriale, digital</span></span>
          </a>
          <a href="prestations.html#rse" class="dropdown-item">
            <div class="di-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 010 18"/><path d="M3 12h18"/></svg></div>
            <span><span class="di-title">RSE</span><span class="di-sub">Diagnostic, bilan carbone</span></span>
          </a>
          <a href="prestations.html#bigdata" class="dropdown-item">
            <div class="di-icon"><svg viewBox="0 0 24 24"><rect x="2" y="7" width="6" height="14" rx="1"/><rect x="9" y="3" width="6" height="18" rx="1"/><rect x="16" y="10" width="6" height="11" rx="1"/></svg></div>
            <span><span class="di-title">Big Data</span><span class="di-sub">Analyse, dataviz</span></span>
          </a>
          <a href="prestations.html#finance" class="dropdown-item">
            <div class="di-icon"><svg viewBox="0 0 24 24"><path d="M12 2L22 7L22 12C22 17.5 17.5 22 12 23C6.5 22 2 17.5 2 12L2 7Z"/><path d="M9 12l3 3 5-5"/></svg></div>
            <span><span class="di-title">Finance</span><span class="di-sub">Business plan, valorisation</span></span>
          </a>
        </div>
      </div>
      <a href="index.html#clients">Nos réalisations</a>
    </nav>
    <button class="hamburger" id="hamburger" aria-label="Menu">
      <span></span><span></span><span></span>
    </button>
    <a href="contact.html" class="btn-outline-marine" style="display:none;" id="desktop-cta">Nous contacter</a>
  </div>
</header>

<!-- Mobile drawer -->
<div class="mobile-drawer" id="mobile-drawer">
  <a href="index.html">Accueil</a>
  <a href="la-je.html">La Junior-Entreprise</a>
  <a href="prestations.html">Nos Prestations</a>
  <a href="index.html#clients">Nos Réalisations</a>
  <a href="contact.html" class="drawer-cta">Nous Contacter →</a>
</div>
```

**Header JS (same on every page, paste before `</body>`):**
```html
<script>
  // Header scroll effect
  const header = document.getElementById('main-header');
  window.addEventListener('scroll', () => {
    header.classList.toggle('scrolled', window.scrollY > 20);
  });
  // Show desktop CTA only on desktop
  const dtCta = document.getElementById('desktop-cta');
  function updateCtaVisibility() {
    dtCta.style.display = window.innerWidth >= 900 ? 'inline-block' : 'none';
  }
  updateCtaVisibility();
  window.addEventListener('resize', updateCtaVisibility);
  // Hamburger
  const burger = document.getElementById('hamburger');
  const drawer = document.getElementById('mobile-drawer');
  burger.addEventListener('click', () => {
    burger.classList.toggle('open');
    drawer.classList.toggle('open');
    document.body.style.overflow = drawer.classList.contains('open') ? 'hidden' : '';
  });
</script>
```

**Footer HTML (same on every page):**
```html
<footer>
  <div class="footer-inner">
    <div class="footer-grid">
      <div>
        <div class="footer-col-title">Contact</div>
        <div class="footer-contact-item">
          <svg viewBox="0 0 24 24"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>
          <span>+33 (0)2 40 37 34 34</span>
        </div>
        <div class="footer-contact-item">
          <svg viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 7 L12 13 L22 7"/></svg>
          <span>contact@audencia-junior-conseil.fr</span>
        </div>
        <div class="footer-contact-item">
          <svg viewBox="0 0 24 24"><path d="M12 2 C8 2 5 5.5 5 9.5 C5 15.5 12 22 12 22 S19 15.5 19 9.5 C19 5.5 16 2 12 2 Z"/><circle cx="12" cy="9.5" r="2.5"/></svg>
          <span>8 route de la Jonelière<br>44312 Nantes Cedex 3</span>
        </div>
        <div class="footer-socials">
          <a href="#" class="social-btn" aria-label="LinkedIn">in</a>
          <a href="#" class="social-btn" aria-label="Instagram">ig</a>
        </div>
      </div>
      <div class="footer-map">
        <div class="footer-col-title">Localisation</div>
        <iframe
          src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2711.3!2d-1.5897!3d47.2557!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x4805ef3e8b35ef6b%3A0xb0d17c2a6c9d6b1!2sAudencia%20Business%20School!5e0!3m2!1sfr!2sfr!4v1"
          allowfullscreen="" loading="lazy" referrerpolicy="no-referrer-when-downgrade"
          title="Audencia Business School — Nantes">
        </iframe>
      </div>
      <div>
        <div class="footer-col-title">Mentions légales</div>
        <div class="footer-mentions">
          <a href="#">Mentions légales</a>
          <a href="#">Politique de confidentialité</a>
          <a href="#">CGV</a>
          <a href="#">Plan du site</a>
        </div>
        <div style="margin-top:32px;">
          <div class="footer-col-title">La JE</div>
          <div class="footer-mentions">
            <a href="la-je.html">Qui sommes-nous ?</a>
            <a href="la-je.html#equipe">Notre équipe</a>
            <a href="contact.html">Nous contacter</a>
          </div>
        </div>
      </div>
    </div>
    <div class="footer-bottom">
      <div class="footer-logo-ghost">AJC</div>
      <div class="footer-copyright">© 2025 Audencia Junior Conseil — Tous droits réservés</div>
    </div>
  </div>
</footer>
```

- [ ] **Step 1: No file to commit here** — these snippets are implemented inline in Tasks 5–8. Mark complete after reviewing snippets.

---

## Task 5 — index.html (Homepage)

**Files:**
- Create: `index.html`
- Reference mockup: `/Users/felixpitz/Downloads/Audencia Junior Cnseil/index.html`

- [ ] **Step 1: Create index.html**

Start from the reference mockup. Apply these changes:

1. Replace `<style>` block content with: only page-specific CSS (hero, valeurs, chiffres, expertise, pourquoi, methodologie, carousel, pre-footer, cta-finale). Remove all shared styles (header, footer, buttons, variables) — they come from `style.css`.
2. Add `<link rel="stylesheet" href="style.css">` in `<head>` after Google Fonts.
3. Replace header HTML with the shared header snippet from Task 4.
4. Replace footer HTML with the shared footer snippet from Task 4.
5. In the hero section, replace the placeholder `<span>campus Audencia Business School</span>` with:
   ```html
   <img src="photos/accueil/hero.jpg" alt="Équipe Audencia Junior Conseil" style="width:100%;height:100%;object-fit:cover;">
   ```
   Wrap in a `<picture>` fallback:
   ```html
   <div class="hero-img-wrap">
     <img src="photos/accueil/hero.jpg" alt="Équipe AJC" style="width:100%;height:100%;object-fit:cover;"
          onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
     <span style="display:none;align-items:center;justify-content:center;width:100%;height:100%;color:rgba(255,255,255,0.3);font-size:12px;">Photo à venir</span>
   </div>
   ```
6. Replace links: `La Junior-Entreprise.html` → `la-je.html`, `Nos Prestations.html` → `prestations.html`, `Nous contacter.html` → `contact.html`.
7. Load testimonials and clients from JSON — replace hardcoded carousel slides and logo chips with JS-rendered content.

Add this script for JSON loading (before closing `</body>`, after header JS):

```html
<script>
  // Load testimonials from JSON
  async function loadTemoignages() {
    try {
      const res = await fetch('contenu/temoignages.json');
      const data = await res.json();
      const track = document.querySelector('.carousel-track');
      const dotsContainer = document.querySelector('.carousel-dots');
      track.innerHTML = '';
      dotsContainer.innerHTML = '';
      data.temoignages.forEach((t, i) => {
        track.innerHTML += `
          <div class="carousel-slide${i === 0 ? ' active' : ''}">
            <p class="carousel-quote">${t.quote}</p>
            <div class="carousel-author">${t.auteur}</div>
            <div class="carousel-role">${t.mission}</div>
          </div>`;
        dotsContainer.innerHTML += `<div class="carousel-dot${i === 0 ? ' active' : ''}" data-idx="${i}"></div>`;
      });
      initCarousel();
    } catch(e) { console.warn('temoignages.json non trouvé, contenu statique utilisé'); }
  }

  // Load clients/partners from JSON
  async function loadClients() {
    try {
      const res = await fetch('contenu/clients.json');
      const data = await res.json();
      const clientsGrid = document.getElementById('clients-grid');
      const partenairesGrid = document.getElementById('partenaires-grid');
      if (clientsGrid) clientsGrid.innerHTML = data.clients.map(c => `<div class="logo-chip">${c}</div>`).join('');
      if (partenairesGrid) partenairesGrid.innerHTML = data.partenaires.map(p => `<div class="logo-chip">${p}</div>`).join('');
    } catch(e) { console.warn('clients.json non trouvé'); }
  }

  loadTemoignages();
  loadClients();
</script>
```

Add `id="clients-grid"` to the `.logos-grid` inside `#clients` section, and `id="partenaires-grid"` to the `.logos-grid` inside `#partenaires`.

8. Update `initCarousel()` to work dynamically (move carousel JS into a named function called after JSON load).

- [ ] **Step 2: Open in browser and verify**

```bash
open "http://localhost:64334/index.html"
```

Check:
- Header renders, scroll effect works, hamburger appears at < 900px
- Hero image shows (or graceful fallback)
- Counters animate on scroll into view
- Carousel shows testimonials, auto-advances
- Footer map loads (iframe)

- [ ] **Step 3: Commit**

```bash
cd "/Users/felixpitz/Desktop/Site Internet/Audencia Junior conseil"
git add index.html
git commit -m "feat: build homepage with shared CSS, JSON-driven carousel and clients"
```

---

## Task 6 — la-je.html (La Junior-Entreprise)

**Files:**
- Create: `la-je.html`
- Reference mockup: `/Users/felixpitz/Downloads/Audencia Junior Cnseil/La Junior-Entreprise.html`

- [ ] **Step 1: Create la-je.html**

Start from the reference mockup. Apply these changes:

1. Add `<link rel="stylesheet" href="style.css">` after Google Fonts.
2. Remove all shared CSS from the `<style>` block (keep only page-specific: sub-nav, je-intro-grid, je-definition-block, bureau-grid, mouvement-grid, etc.).
3. Replace header with shared header snippet. Set `active` class on the "La Junior-Entreprise" nav link.
4. Replace footer with shared footer snippet.
5. Fix all internal links (`Nous contacter.html` → `contact.html`, `index.html#expertise` → `prestations.html`).
6. Replace all bureau photo placeholders with real images + onerror fallback:

For each bureau card, replace:
```html
<div class="ph" style="min-height:240px;"><span>photo Émilie Munsch</span></div>
```
With:
```html
<img src="photos/equipe/bureau/president.jpg" alt="Émilie Munsch"
     style="width:100%;min-height:240px;object-fit:cover;display:block;"
     onerror="this.outerHTML='<div class=ph style=min-height:240px;><span>Photo à venir</span></div>'">
```
Apply same pattern for: `vice-president.jpg`, `secretaire.jpg`, `tresorier.jpg`.

7. Replace hardcoded CDP placeholder grid with JSON-loaded team data. Change:
```html
<div class="cdp-grid" id="cdp-grid">
  <!-- Generated by JS -->
</div>
```

And replace the inline JS `cdps.forEach(...)` section with:
```html
<script>
  async function loadEquipe() {
    try {
      const res = await fetch('contenu/equipe.json');
      const data = await res.json();
      // Responsables de pôles
      const polesGrid = document.getElementById('poles-grid');
      if (polesGrid) {
        polesGrid.innerHTML = data.poles.map(p => `
          <div class="cdp-card">
            <div class="cdp-photo">
              <img src="${p.photo}" alt="${p.nom}" style="width:100%;aspect-ratio:3/4;object-fit:cover;display:block;"
                   onerror="this.outerHTML='<div class=ph style=aspect-ratio:3/4;><span>${p.nom}</span></div>'">
            </div>
            <div class="cdp-info">
              <div class="cdp-name">${p.nom}</div>
              <div class="cdp-role">${p.role}</div>
              <a href="${p.linkedin}" class="cdp-linkedin" target="_blank" rel="noopener">
                <svg viewBox="0 0 24 24" fill="white"><path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>
              </a>
            </div>
          </div>`).join('');
      }
      // Chefs de projets
      const cdpGrid = document.getElementById('cdp-grid');
      if (cdpGrid) {
        cdpGrid.innerHTML = data.chefs_projet.map(p => `
          <div class="cdp-card">
            <div class="cdp-photo">
              <img src="${p.photo}" alt="${p.nom}" style="width:100%;aspect-ratio:3/4;object-fit:cover;display:block;"
                   onerror="this.outerHTML='<div class=ph style=aspect-ratio:3/4;><span>${p.nom}</span></div>'">
            </div>
            <div class="cdp-info">
              <div class="cdp-name">${p.nom}</div>
              <div class="cdp-role">${p.role}</div>
              <a href="${p.linkedin}" class="cdp-linkedin" target="_blank" rel="noopener">
                <svg viewBox="0 0 24 24" fill="white"><path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>
              </a>
            </div>
          </div>`).join('');
      }
    } catch(e) { console.warn('equipe.json non trouvé'); }
  }
  loadEquipe();
</script>
```

Add `id="poles-grid"` to the responsables de pôles `.cdp-grid`.

- [ ] **Step 2: Open in browser and verify**

```bash
open "http://localhost:64334/la-je.html"
```

Check: sub-nav sticky works, team photos load (or fallback), LinkedIn buttons present, CTA links correct.

- [ ] **Step 3: Commit**

```bash
cd "/Users/felixpitz/Desktop/Site Internet/Audencia Junior conseil"
git add la-je.html
git commit -m "feat: build la-je page with JSON-driven team, real photos"
```

---

## Task 7 — prestations.html (Accordéon progressif)

**Files:**
- Create: `prestations.html` (new file — do NOT base on the React mockup)

- [ ] **Step 1: Create prestations.html**

Write the complete file from scratch:

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nos Prestations — Audencia Junior Conseil</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="style.css">
  <style>
    /* ── DOMAIN TILES (sticky selector) ── */
    .domain-selector {
      position: sticky; top: 68px; z-index: 100;
      background: var(--white); border-bottom: 1px solid var(--gray-border);
      padding: 0 48px;
    }
    .domain-selector-inner {
      max-width: 1200px; margin: 0 auto;
      display: flex; gap: 0; overflow-x: auto;
    }
    .domain-tab {
      display: flex; align-items: center; gap: 10px;
      padding: 20px 28px; cursor: pointer; white-space: nowrap;
      border-bottom: 3px solid transparent;
      font-size: 13px; font-weight: 700; color: var(--gray-text);
      transition: color 0.2s, border-color 0.2s;
      background: none; border-top: none; border-left: none; border-right: none;
      font-family: 'Montserrat', sans-serif;
    }
    .domain-tab:hover { color: var(--marine); }
    .domain-tab.active { color: var(--marine); border-bottom-color: var(--rose); }
    .domain-tab-icon { font-size: 18px; }
    .domain-tab-name { letter-spacing: 0.5px; }

    /* ── ACCORDÉON SECTIONS ── */
    .domains-container { max-width: 1200px; margin: 0 auto; padding: 0 48px 96px; }

    .domain-section {
      border-bottom: 1px solid var(--gray-border);
      overflow: hidden;
    }
    .domain-section:first-child { margin-top: 0; }

    .domain-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 48px 0 32px; cursor: pointer;
    }
    .domain-header-left { display: flex; align-items: center; gap: 24px; }
    .domain-icon-big {
      width: 64px; height: 64px; border-radius: 12px;
      background: var(--gray-bg); display: flex; align-items: center; justify-content: center;
      font-size: 28px; flex-shrink: 0;
      transition: background 0.2s;
    }
    .domain-section.active .domain-icon-big { background: var(--marine); }
    .domain-section.active .domain-icon-big .dicon svg { stroke: white; }
    .domain-h-eyebrow { font-size: 10px; font-weight: 700; letter-spacing: 4px; text-transform: uppercase; color: var(--rose); margin-bottom: 6px; }
    .domain-h-title { font-size: 26px; font-weight: 800; color: var(--marine); }
    .domain-chevron {
      width: 40px; height: 40px; border: 2px solid var(--gray-border);
      border-radius: 50%; display: flex; align-items: center; justify-content: center;
      transition: transform 0.35s, border-color 0.2s, background 0.2s; flex-shrink: 0;
    }
    .domain-chevron svg { width: 16px; height: 16px; stroke: var(--gray-text); fill: none; stroke-width: 2.5; transition: stroke 0.2s; }
    .domain-section.active .domain-chevron { transform: rotate(180deg); border-color: var(--marine); background: var(--marine); }
    .domain-section.active .domain-chevron svg { stroke: white; }

    /* Accordéon body */
    .domain-body {
      max-height: 0; overflow: hidden;
      transition: max-height 0.5s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .domain-section.active .domain-body { max-height: 2000px; }

    .domain-body-inner { padding: 0 0 56px; }

    /* Description + tags */
    .domain-desc { font-size: 16px; color: var(--gray-text); line-height: 1.8; max-width: 720px; margin-bottom: 28px; }
    .domain-tags { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 48px; }
    .domain-tag {
      background: var(--gray-bg); border: 1.5px solid var(--gray-border);
      border-radius: 20px; padding: 7px 16px;
      font-size: 12px; font-weight: 600; color: var(--marine); letter-spacing: 0.3px;
    }

    /* Examples & methodology revealed on scroll */
    .domain-reveal { opacity: 0; transform: translateY(24px); transition: opacity 0.5s ease, transform 0.5s ease; }
    .domain-reveal.visible { opacity: 1; transform: translateY(0); }

    .examples-title { font-size: 11px; font-weight: 700; letter-spacing: 4px; text-transform: uppercase; color: var(--rose); margin-bottom: 20px; }
    .examples-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 48px; }
    .example-card { background: var(--gray-bg); border-radius: 8px; padding: 24px 28px; border: 1.5px solid transparent; transition: border-color 0.2s; }
    .example-card:hover { border-color: var(--marine); }
    .example-client { font-size: 13px; font-weight: 800; color: var(--marine); margin-bottom: 6px; }
    .example-context { font-size: 12px; color: var(--gray-text); line-height: 1.6; margin-bottom: 10px; }
    .example-livrable { font-size: 11px; font-weight: 700; color: var(--rose); }
    .example-livrable::before { content: '→ '; }

    /* Methodology steps */
    .methodo-grid { display: flex; gap: 0; margin-bottom: 40px; position: relative; }
    .methodo-grid::before { content: ''; position: absolute; top: 20px; left: 20px; right: 20px; height: 1px; background: var(--gray-border); z-index: 0; }
    .methodo-step { flex: 1; text-align: center; padding: 0 12px; position: relative; z-index: 1; }
    .methodo-dot { width: 10px; height: 10px; background: var(--rose); border-radius: 50%; margin: 0 auto 12px; }
    .methodo-label { font-size: 11px; font-weight: 600; color: var(--marine); line-height: 1.4; }

    /* CTA devis */
    .domain-cta { display: flex; align-items: center; justify-content: space-between; background: var(--marine); border-radius: 8px; padding: 28px 36px; }
    .domain-cta p { font-size: 15px; font-weight: 700; color: white; }
    .domain-cta span { font-size: 13px; color: rgba(255,255,255,0.5); margin-top: 4px; display: block; }

    @media (max-width: 900px) {
      .domain-selector { padding: 0 16px; top: 68px; }
      .domain-tab { padding: 16px 16px; font-size: 11px; }
      .domain-tab-icon { display: none; }
      .domains-container { padding: 0 24px 64px; }
      .domain-header { padding: 32px 0 20px; }
      .domain-h-title { font-size: 20px; }
      .examples-grid { grid-template-columns: 1fr; }
      .methodo-grid { flex-wrap: wrap; gap: 16px; }
      .methodo-grid::before { display: none; }
      .domain-cta { flex-direction: column; gap: 16px; text-align: center; }
    }
  </style>
</head>
<body>

<!-- HEADER (shared) -->
<!-- [paste shared header snippet from Task 4, set active class on "Nos prestations" link] -->

<!-- HERO -->
<div class="page-hero" style="margin-top:68px;">
  <div class="page-hero-inner">
    <p class="page-hero-eyebrow">Ce que nous faisons</p>
    <h1 class="page-hero-title">Nos Prestations</h1>
    <p class="page-hero-sub">5 domaines d'expertise, des missions sur mesure réalisées par des consultants formés par Audencia Business School.</p>
  </div>
</div>

<!-- DOMAIN SELECTOR (sticky) -->
<div class="domain-selector">
  <div class="domain-selector-inner" id="domain-tabs">
    <!-- Rendered by JS from prestations.json -->
  </div>
</div>

<!-- DOMAINS ACCORDÉON -->
<div class="domains-container" id="domains-container">
  <!-- Rendered by JS from prestations.json -->
</div>

<!-- CTA FINALE -->
<section style="background:var(--marine);padding:80px 48px;">
  <div style="max-width:1200px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:40px;flex-wrap:wrap;">
    <div>
      <h2 style="font-size:36px;font-weight:800;color:white;margin-bottom:10px;">Votre projet ne rentre pas<br>dans une case ?</h2>
      <p style="font-size:14px;color:rgba(255,255,255,0.5);">Contactez-nous, nous trouverons une solution adaptée.</p>
    </div>
    <a href="contact.html" class="btn-rose" style="font-size:13px;padding:18px 40px;white-space:nowrap;">NOUS CONTACTER</a>
  </div>
</section>

<!-- FOOTER (shared) -->
<!-- [paste shared footer snippet from Task 4] -->

<script>
  // SVG icons per domain
  const ICONS = {
    chart: `<svg viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21 L10 14 L14 18 L20 10 L25 15"/><circle cx="25" cy="8" r="3"/></svg>`,
    megaphone: `<svg viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="22" height="16" rx="2"/><path d="M8 12 h4 M8 15 h8"/></svg>`,
    leaf: `<svg viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="2"><circle cx="14" cy="14" r="10"/><path d="M14 4 a10 10 0 0 1 0 20"/><path d="M4 14 h20"/></svg>`,
    bars: `<svg viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="8" width="7" height="16" rx="1"/><rect x="11" y="4" width="7" height="20" rx="1"/><rect x="19" y="12" width="7" height="12" rx="1"/></svg>`,
    shield: `<svg viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 4 L25 9 L25 14 C25 19.5 20.5 24 14 25 C7.5 24 3 19.5 3 14 L3 9 Z"/><path d="M10 14 l3 3 l6 -6"/></svg>`
  };

  async function buildPrestations() {
    const res = await fetch('contenu/prestations.json');
    const { domaines } = await res.json();

    // Build tabs
    const tabs = document.getElementById('domain-tabs');
    tabs.innerHTML = domaines.map((d, i) => `
      <button class="domain-tab${i === 0 ? ' active' : ''}" data-id="${d.id}" onclick="activateDomain('${d.id}')">
        <span class="domain-tab-icon">${ICONS[d.icone] ? '◆' : '◆'}</span>
        <span class="domain-tab-name">${d.titre}</span>
      </button>`).join('');

    // Build accordéon sections
    const container = document.getElementById('domains-container');
    container.innerHTML = domaines.map((d, i) => `
      <div class="domain-section${i === 0 ? ' active' : ''}" id="section-${d.id}">
        <div class="domain-header" onclick="toggleDomain('${d.id}')">
          <div class="domain-header-left">
            <div class="domain-icon-big dicon" style="color:var(--marine);">${ICONS[d.icone] || ''}</div>
            <div>
              <div class="domain-h-eyebrow">Domaine d'expertise</div>
              <div class="domain-h-title">${d.titre}</div>
            </div>
          </div>
          <div class="domain-chevron">
            <svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>
          </div>
        </div>
        <div class="domain-body">
          <div class="domain-body-inner">
            <p class="domain-desc">${d.description}</p>
            <div class="domain-tags">${d.tags.map(t => `<span class="domain-tag">${t}</span>`).join('')}</div>

            <div class="domain-reveal">
              <div class="examples-title">Exemples de missions réalisées</div>
              <div class="examples-grid">
                ${d.exemples.map(e => `
                  <div class="example-card">
                    <div class="example-client">${e.client}</div>
                    <div class="example-context">${e.contexte}</div>
                    <div class="example-livrable">${e.livrable}</div>
                  </div>`).join('')}
              </div>
              <div class="examples-title">Notre approche</div>
              <div class="methodo-grid">
                ${d.methodologie.map(m => `
                  <div class="methodo-step">
                    <div class="methodo-dot"></div>
                    <div class="methodo-label">${m}</div>
                  </div>`).join('')}
              </div>
              <div class="domain-cta">
                <div>
                  <p>Vous avez un projet en ${d.titre.toLowerCase()} ?</p>
                  <span>Réponse sous 48h. Sans engagement.</span>
                </div>
                <a href="contact.html?domaine=${d.id}" class="btn-hero-primary">Demander un devis</a>
              </div>
            </div>
          </div>
        </div>
      </div>`).join('');

    // IntersectionObserver for reveal elements
    const reveals = document.querySelectorAll('.domain-reveal');
    const revealObs = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); revealObs.unobserve(e.target); } });
    }, { threshold: 0.15 });
    reveals.forEach(el => revealObs.observe(el));

    // Activate first domain open by default
    activateDomain(domaines[0].id);
  }

  function activateDomain(id) {
    // Update tabs
    document.querySelectorAll('.domain-tab').forEach(t => t.classList.toggle('active', t.dataset.id === id));
    // Update sections
    document.querySelectorAll('.domain-section').forEach(s => s.classList.toggle('active', s.id === 'section-' + id));
    // Smooth scroll to section (if not first load)
    const section = document.getElementById('section-' + id);
    if (section) {
      const offset = section.getBoundingClientRect().top + window.scrollY - 140;
      window.scrollTo({ top: offset, behavior: 'smooth' });
    }
  }

  function toggleDomain(id) {
    const section = document.getElementById('section-' + id);
    const isActive = section.classList.contains('active');
    if (!isActive) activateDomain(id);
  }

  buildPrestations();

  // URL param: ?domaine=marketing opens that domain
  const params = new URLSearchParams(window.location.search);
  const preselect = params.get('domaine');
  if (preselect) window.addEventListener('load', () => activateDomain(preselect));
</script>

<!-- Header + shared JS -->
<!-- [paste shared header JS from Task 4] -->
</body>
</html>
```

- [ ] **Step 2: Open in browser and verify**

```bash
open "http://localhost:64334/prestations.html"
```

Check:
- 5 domain tabs visible and sticky when scrolling
- First domain open by default
- Clicking a tab scrolls and opens that domain
- Description + tags visible immediately
- Exemples and méthodologie reveal on scroll within the section
- CTA "Demander un devis" links to `contact.html?domaine=marketing` etc.
- Mobile: tabs scroll horizontally, accordéon works

- [ ] **Step 3: Commit**

```bash
cd "/Users/felixpitz/Desktop/Site Internet/Audencia Junior conseil"
git add prestations.html
git commit -m "feat: build accordéon prestations page, JSON-driven, reveal on scroll"
```

---

## Task 8 — contact.html (Formspree form)

**Files:**
- Create: `contact.html`
- Reference mockup: `/Users/felixpitz/Downloads/Audencia Junior Cnseil/Nous contacter.html`

- [ ] **Step 1: Create a Formspree endpoint**

Go to https://formspree.io → Sign up with pitz.felix@gmail.com → Create new form → Copy the form endpoint URL (looks like `https://formspree.io/f/XXXXXXXX`).

- [ ] **Step 2: Create contact.html**

Start from the reference mockup. Apply these changes:

1. Add `<link rel="stylesheet" href="style.css">`.
2. Remove shared CSS from `<style>`, keep only contact-specific styles.
3. Replace header + footer with shared snippets. Set `active` on "Nous contacter" (add it to nav or mark btn-outline-marine as active).
4. Replace the existing form (if any) with this Formspree-powered form. The full form section:

```html
<section style="padding:80px 48px;background:var(--white);">
  <div style="max-width:1200px;margin:0 auto;display:grid;grid-template-columns:1fr 1.2fr;gap:80px;align-items:start;">

    <!-- Left: contact info -->
    <div>
      <p class="section-label">Parlons de votre projet</p>
      <h2 class="section-title" style="font-size:28px;letter-spacing:2px;">Nous <span class="thin">contacter</span></h2>
      <div class="section-accent"></div>
      <p style="font-size:14px;color:var(--gray-text);line-height:1.8;margin-bottom:40px;">
        Que vous ayez un projet précis ou une simple question, notre équipe vous répondra sous 48 heures. Sans engagement.
      </p>
      <div style="display:flex;flex-direction:column;gap:20px;">
        <div style="display:flex;align-items:flex-start;gap:14px;">
          <div style="width:40px;height:40px;background:var(--gray-bg);border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--rose)" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 7l10 6 10-6"/></svg>
          </div>
          <div>
            <div style="font-size:12px;font-weight:700;color:var(--marine);margin-bottom:3px;">Email</div>
            <a href="mailto:contact@audencia-junior-conseil.fr" style="font-size:13px;color:var(--gray-text);text-decoration:none;">contact@audencia-junior-conseil.fr</a>
          </div>
        </div>
        <div style="display:flex;align-items:flex-start;gap:14px;">
          <div style="width:40px;height:40px;background:var(--gray-bg);border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--rose)" stroke-width="2"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>
          </div>
          <div>
            <div style="font-size:12px;font-weight:700;color:var(--marine);margin-bottom:3px;">Téléphone</div>
            <span style="font-size:13px;color:var(--gray-text);">+33 (0)2 40 37 34 34</span>
          </div>
        </div>
        <div style="display:flex;align-items:flex-start;gap:14px;">
          <div style="width:40px;height:40px;background:var(--gray-bg);border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--rose)" stroke-width="2"><path d="M12 2 C8 2 5 5.5 5 9.5 C5 15.5 12 22 12 22 S19 15.5 19 9.5 C19 5.5 16 2 12 2 Z"/><circle cx="12" cy="9.5" r="2.5"/></svg>
          </div>
          <div>
            <div style="font-size:12px;font-weight:700;color:var(--marine);margin-bottom:3px;">Adresse</div>
            <span style="font-size:13px;color:var(--gray-text);">8 route de la Jonelière<br>44312 Nantes Cedex 3</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Right: Formspree form -->
    <div style="background:var(--gray-bg);border-radius:12px;padding:40px;">
      <form id="contact-form" action="https://formspree.io/f/XXXXXXXX" method="POST">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
          <div>
            <label for="prenom" style="display:block;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--marine);margin-bottom:8px;">Prénom *</label>
            <input type="text" id="prenom" name="prenom" required
              style="width:100%;padding:12px 16px;border:1.5px solid var(--gray-border);border-radius:4px;font-family:'Montserrat',sans-serif;font-size:13px;color:var(--marine);background:white;outline:none;transition:border-color 0.2s;"
              onfocus="this.style.borderColor='var(--marine)'" onblur="this.style.borderColor='var(--gray-border)'">
          </div>
          <div>
            <label for="nom" style="display:block;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--marine);margin-bottom:8px;">Nom *</label>
            <input type="text" id="nom" name="nom" required
              style="width:100%;padding:12px 16px;border:1.5px solid var(--gray-border);border-radius:4px;font-family:'Montserrat',sans-serif;font-size:13px;color:var(--marine);background:white;outline:none;transition:border-color 0.2s;"
              onfocus="this.style.borderColor='var(--marine)'" onblur="this.style.borderColor='var(--gray-border)'">
          </div>
        </div>
        <div style="margin-bottom:16px;">
          <label for="email" style="display:block;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--marine);margin-bottom:8px;">Email professionnel *</label>
          <input type="email" id="email" name="email" required
            style="width:100%;padding:12px 16px;border:1.5px solid var(--gray-border);border-radius:4px;font-family:'Montserrat',sans-serif;font-size:13px;color:var(--marine);background:white;outline:none;transition:border-color 0.2s;"
            onfocus="this.style.borderColor='var(--marine)'" onblur="this.style.borderColor='var(--gray-border)'">
        </div>
        <div style="margin-bottom:16px;">
          <label for="societe" style="display:block;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--marine);margin-bottom:8px;">Entreprise / Organisation</label>
          <input type="text" id="societe" name="societe"
            style="width:100%;padding:12px 16px;border:1.5px solid var(--gray-border);border-radius:4px;font-family:'Montserrat',sans-serif;font-size:13px;color:var(--marine);background:white;outline:none;transition:border-color 0.2s;"
            onfocus="this.style.borderColor='var(--marine)'" onblur="this.style.borderColor='var(--gray-border)'">
        </div>
        <div style="margin-bottom:16px;">
          <label for="domaine" style="display:block;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--marine);margin-bottom:8px;">Type de projet</label>
          <select id="domaine" name="domaine"
            style="width:100%;padding:12px 16px;border:1.5px solid var(--gray-border);border-radius:4px;font-family:'Montserrat',sans-serif;font-size:13px;color:var(--marine);background:white;outline:none;appearance:none;cursor:pointer;">
            <option value="">Sélectionner un domaine</option>
            <option value="marketing">Marketing</option>
            <option value="communication">Communication</option>
            <option value="rse">RSE</option>
            <option value="bigdata">Big Data</option>
            <option value="finance">Finance</option>
            <option value="autre">Autre</option>
          </select>
        </div>
        <div style="margin-bottom:24px;">
          <label for="message" style="display:block;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--marine);margin-bottom:8px;">Description du projet *</label>
          <textarea id="message" name="message" required rows="5"
            style="width:100%;padding:12px 16px;border:1.5px solid var(--gray-border);border-radius:4px;font-family:'Montserrat',sans-serif;font-size:13px;color:var(--marine);background:white;outline:none;resize:vertical;transition:border-color 0.2s;"
            onfocus="this.style.borderColor='var(--marine)'" onblur="this.style.borderColor='var(--gray-border)'"
            placeholder="Décrivez votre besoin en quelques lignes..."></textarea>
        </div>
        <button type="submit" class="btn-solid-marine" style="width:100%;padding:16px;font-size:13px;letter-spacing:2px;">
          ENVOYER MA DEMANDE
        </button>
        <div id="form-success" style="display:none;margin-top:16px;padding:16px;background:#f0fdf4;border:1.5px solid #86efac;border-radius:6px;font-size:13px;color:#166534;font-weight:600;text-align:center;">
          ✓ Message envoyé ! Nous vous répondrons sous 48h.
        </div>
      </form>
    </div>
  </div>
</section>
```

5. Add URL param pre-fill script (paste before `</body>`):

```html
<script>
  // Pre-fill domaine select from URL param ?domaine=marketing
  const params = new URLSearchParams(window.location.search);
  const domaine = params.get('domaine');
  if (domaine) {
    const select = document.getElementById('domaine');
    if (select) select.value = domaine;
  }

  // Formspree AJAX submission (no page reload)
  const form = document.getElementById('contact-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type=submit]');
    btn.textContent = 'Envoi en cours…';
    btn.disabled = true;
    try {
      const res = await fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { 'Accept': 'application/json' }
      });
      if (res.ok) {
        form.reset();
        document.getElementById('form-success').style.display = 'block';
        btn.textContent = 'ENVOYER MA DEMANDE';
        btn.disabled = false;
      } else {
        btn.textContent = 'Erreur — réessayer';
        btn.disabled = false;
      }
    } catch {
      btn.textContent = 'Erreur — réessayer';
      btn.disabled = false;
    }
  });
</script>
```

- [ ] **Step 3: Open in browser and verify**

```bash
open "http://localhost:64334/contact.html"
```

Check:
- Form renders correctly
- All fields present
- `?domaine=marketing` in URL pre-fills the select
- Google Maps loads in footer

- [ ] **Step 4: Test Formspree submission**

Fill the form with test data, submit. Check pitz.felix@gmail.com for the email. Verify success message appears without page reload.

- [ ] **Step 5: Commit**

```bash
cd "/Users/felixpitz/Desktop/Site Internet/Audencia Junior conseil"
git add contact.html
git commit -m "feat: build contact page with Formspree form and URL param pre-fill"
```

---

## Task 9 — Cross-page validation

**Files:** No new files — verify all 4 pages.

- [ ] **Step 1: Verify all internal links**

Open each page and click every link. Expected targets:

| From | Link | Expected |
|------|------|----------|
| index.html | Logo | index.html |
| index.html | "La Junior-Entreprise" nav | la-je.html |
| index.html | "Nos prestations" nav | prestations.html |
| index.html | "Nos réalisations" | index.html#clients |
| index.html | "Nous contacter" btn | contact.html |
| index.html | Hero "Demander un devis" | contact.html |
| index.html | "Expertise" card links | prestations.html |
| la-je.html | CTA "Candidater" | contact.html |
| prestations.html | Domain "Demander un devis" | contact.html?domaine=X |
| prestations.html | Footer logo | index.html |

- [ ] **Step 2: Mobile responsiveness check**

In browser DevTools, test at 375px (iPhone SE) and 768px (tablet):

- Hamburger button visible, nav hidden
- Drawer opens/closes correctly
- Hero text readable (no overflow)
- prestations.html domain tabs scroll horizontally
- contact.html form stacks single-column
- Footer stacks single-column

- [ ] **Step 3: Check JSON loading works from file:// protocol**

Note: `fetch()` does not work from `file://` URLs in most browsers (CORS restriction). The site must be served via HTTP. With `npx serve .` running on port 64334, all JSON loading will work. Mention this in a `README.md`:

```bash
cat > "/Users/felixpitz/Desktop/Site Internet/Audencia Junior conseil/README.md" << 'EOF'
# Audencia Junior Conseil — Site vitrine

## Développement local
```
npx serve .
```
Ouvrir http://localhost:PORT dans le navigateur.

⚠️ Ouvrir les fichiers HTML directement (double-clic) ne fonctionne pas — les JSON ne se chargent pas en protocole file://. Toujours utiliser un serveur HTTP local.

## Modifier le contenu (no-code)
- **Textes équipe** : éditer `contenu/equipe.json`
- **Textes prestations** : éditer `contenu/prestations.json`
- **Témoignages** : éditer `contenu/temoignages.json`
- **Clients / Partenaires** : éditer `contenu/clients.json`
- **Photos** : voir `photos/README.md`

## Déploiement OVH / Oracle
Uploader tous les fichiers via FTP à la racine du serveur web.
EOF
```

- [ ] **Step 4: Final commit**

```bash
cd "/Users/felixpitz/Desktop/Site Internet/Audencia Junior conseil"
git add README.md
git add -u
git commit -m "feat: complete AJC website — 4 pages, no-code system, responsive"
```

---

## Self-review

**Spec coverage check:**

| Spec requirement | Task |
|-----------------|------|
| 4 HTML pages | Tasks 5–8 |
| Shared style.css | Task 3 |
| Mobile hamburger | Task 3 (CSS) + Tasks 5–8 (HTML) |
| Logo réel (photo/) | Tasks 5–6 |
| Photos réelles + fallback | Tasks 5–6 |
| Formspree contact | Task 8 |
| Google Maps footer | Tasks 5–8 (shared footer) |
| Prestations accordéon + reveal | Task 7 |
| Sticky domain tabs | Task 7 |
| URL param ?domaine= | Tasks 7–8 |
| JSON data files | Task 2 |
| photos/ folder convention | Task 1 |
| contenu/*.json no-code | Task 2 |
| Bureau photos from JSON | Task 6 |
| CDP photos from JSON | Task 6 |
| Clients/partenaires from JSON | Task 5 |
| Testimonials from JSON | Task 5 |
| README | Task 9 |
| All internal links updated | Task 9 |

**No placeholders found** — all code blocks are complete.

**Type consistency** — `domain.id` used consistently as `section-${d.id}` anchor and `contact.html?domaine=${d.id}`.
