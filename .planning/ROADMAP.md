# Roadmap: BeFast — Odensia Junior Conseil

## Overview

BeFast est construit en 6 phases qui livrent des capacités complètes et vérifiables. La Phase 1 pose les fondations (authentification, rôles, design system) sur lesquelles toutes les autres reposent. Les Phases 2 à 6 livrent chacune un domaine fonctionnel complet : profils et documents personnels, missions et candidatures, études avec Gantt, prospection Kanban et statistiques, puis administration avancée. Chaque phase est livrable et testable indépendamment des suivantes.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Fondation** - Projet Next.js 14, Supabase, authentification email/mot de passe, système de rôles, design system, layout sidebar
- [ ] **Phase 2: Profils & Documents** - Profil utilisateur éditable, chiffrement AES-256-GCM (NSS/IBAN), upload de 5 types de documents via bucket Supabase Storage privé
- [ ] **Phase 3: Missions** - Liste filtrée des missions, page détail, système de candidature, gestion des candidatures par les membres AGC
- [ ] **Phase 4: Études** - Liste et création d'études, page détail avec missions associées, échéancier Gantt drag-and-drop
- [ ] **Phase 5: Prospection & Statistiques** - Pipeline Kanban de prospection, tableau de bord avec KPIs et graphiques recharts
- [ ] **Phase 6: Administration** - Gestion des rôles/permissions, paramètres structure, templates documents, gestion des membres avec import/export Excel

## Phase Details

### Phase 1: Fondation
**Goal**: Les utilisateurs peuvent créer un compte, se connecter et accéder à une interface personnalisée selon leur rôle
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07, AUTH-08, ROLE-01, ROLE-02, ROLE-03, ROLE-04, ROLE-05, ROLE-06, UX-01, UX-02, UX-03, UX-04, UX-05, UX-06, SEC-04, SEC-05, SEC-06
**Success Criteria** (what must be TRUE):
  1. Un utilisateur peut créer un compte, se connecter et se déconnecter avec email + mot de passe
  2. Un compte sans rôle assigné voit un écran d'attente explicite après connexion
  3. La sidebar affiche uniquement les items accessibles au rôle connecté
  4. Les routes protégées redirigent vers /login si l'utilisateur n'est pas authentifié
  5. L'interface est entièrement en français avec la palette #0D1B2A / #C9A84C et les fontes Playfair Display + DM Sans
**Plans:** 2 plans

Plans:
- [ ] 01-01-PLAN.md — Projet Next.js 14, design system BeFast, utilitaires Supabase, encryption, migrations SQL
- [ ] 01-02-PLAN.md — Auth (login, inscription, reset), middleware, sidebar, RoleGuard, ecran attente

**UI hint**: yes

### Phase 2: Profils & Documents
**Goal**: Les membres peuvent gérer leur profil complet et déposer leurs documents personnels de façon sécurisée
**Depends on**: Phase 1
**Requirements**: PROF-01, PROF-02, PROF-03, PROF-04, PROF-05, PROF-06, DOCS-01, DOCS-02, DOCS-03, DOCS-04, DOCS-05, DOCS-06, SEC-01, SEC-02, SEC-03
**Success Criteria** (what must be TRUE):
  1. Un utilisateur peut voir et modifier ses informations de base (prénom, nom, portable, promo, adresse, pôle)
  2. Les champs NSS et IBAN s'affichent masqués (****) et leur modification passe exclusivement par une API Route serveur avec chiffrement AES-256-GCM
  3. Un utilisateur peut uploader, visualiser et supprimer chacun des 5 types de documents via des URLs signées (expiration 1h)
  4. Les fichiers uploadés sont inaccessibles sans URL signée (bucket privé, RLS activé)
  5. L'admin peut consulter et modifier le profil de n'importe quel membre
**Plans**: TBD
**UI hint**: yes

### Phase 3: Missions
**Goal**: Les intervenants peuvent candidater à des missions ouvertes et les membres AGC peuvent gérer les candidatures reçues
**Depends on**: Phase 1
**Requirements**: MISS-01, MISS-02, MISS-03, MISS-04, MISS-05, MISS-06, MISS-07, MISS-08, MISS-09, MISS-10
**Success Criteria** (what must be TRUE):
  1. Tout utilisateur authentifié peut consulter la liste des missions ouvertes avec filtres par type, voie et classe
  2. Un intervenant peut candidater à une mission (motivation, classe, langues) et ne peut soumettre qu'une seule candidature par mission
  3. Un intervenant peut suivre le statut de ses candidatures depuis son espace
  4. Un membre AGC peut voir toutes les candidatures reçues pour une mission et accepter ou refuser chacune
  5. Un membre AGC peut créer une mission depuis la page détail d'une étude
**Plans**: TBD
**UI hint**: yes

### Phase 4: Études
**Goal**: Les membres AGC peuvent gérer le cycle de vie complet d'une étude, de sa création à son échéancier détaillé
**Depends on**: Phase 3
**Requirements**: ETUD-01, ETUD-02, ETUD-03, ETUD-04, ETUD-05, ETUD-06, ETUD-07
**Success Criteria** (what must be TRUE):
  1. Un membre AGC peut voir la liste de toutes les études avec filtres par statut
  2. Un membre AGC peut créer une étude (nom, numéro unique, client, suiveur, budget, commentaire) et lui assigner un statut parmi les 5 définis
  3. La page détail d'une étude affiche les informations générales, les missions associées et un échéancier
  4. L'échéancier Gantt permet de créer, déplacer et redimensionner des blocs (nom, semaine de début, durée, JEH) par drag-and-drop
**Plans**: TBD
**UI hint**: yes

### Phase 5: Prospection & Statistiques
**Goal**: Les membres AGC autorisés peuvent piloter la prospection commerciale et consulter les indicateurs de performance de la structure
**Depends on**: Phase 4
**Requirements**: PROS-01, PROS-02, PROS-03, PROS-04, PROS-05, STAT-01, STAT-02, STAT-03, STAT-04, STAT-05
**Success Criteria** (what must be TRUE):
  1. Les membres AGC avec permission "prospection" voient un pipeline Kanban avec les 7 colonnes de statut et peuvent déplacer les cartes entre colonnes
  2. Un membre peut créer un nouveau prospect via un formulaire et le voir apparaître immédiatement dans la colonne appropriée
  3. Le tableau de bord statistiques affiche les KPIs (intervenants sélectionnés ce mois, missions/études actives), un camembert AO/CS/Prospection et un graphique CA réalisé vs prévisionnel
**Plans**: TBD
**UI hint**: yes

### Phase 6: Administration
**Goal**: Les administrateurs peuvent configurer l'ensemble de la structure, gérer les membres et maintenir les templates de documents
**Depends on**: Phase 2
**Requirements**: ADM-01, ADM-02, ADM-03, ADM-04, ADM-05, ADM-06, ADM-07, ADM-08, ADM-09, ADM-10, ADM-11, ADM-12, ADM-13, ADM-14, ADM-15, ADM-16
**Success Criteria** (what must be TRUE):
  1. L'admin peut créer et modifier des profils de rôle avec des permissions par page configurables via des toggles
  2. L'admin peut configurer l'identité juridique, la numérotation automatique, les dirigeants, les données financières et les coordonnées de la structure
  3. L'admin peut créer, modifier et supprimer des templates de documents avec balises {{variable}} et voir la liste des balises disponibles
  4. L'admin peut voir tous les membres, modifier leur rôle, activer/désactiver leur compte, importer une liste via .xlsx avec prévisualisation avant confirmation, et exporter en Excel
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Fondation | 0/2 | Not started | - |
| 2. Profils & Documents | 0/TBD | Not started | - |
| 3. Missions | 0/TBD | Not started | - |
| 4. Études | 0/TBD | Not started | - |
| 5. Prospection & Statistiques | 0/TBD | Not started | - |
| 6. Administration | 0/TBD | Not started | - |
