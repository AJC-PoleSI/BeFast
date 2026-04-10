# Requirements: BeFast — Odensia Junior Conseil

**Défini :** 2026-04-08
**Valeur core :** Un membre ou intervenant doit pouvoir accéder à ses missions, déposer ses documents et candidater à des projets en moins de 3 clics.

## v1 Requirements

### Authentification & Accès

- [ ] **AUTH-01** : L'utilisateur peut créer un compte avec email et mot de passe (auto-inscription)
- [ ] **AUTH-02** : L'administrateur assigne un rôle à un compte nouvellement créé
- [ ] **AUTH-03** : Un compte sans rôle assigné voit un écran d'attente après connexion
- [ ] **AUTH-04** : L'utilisateur peut se connecter avec email + mot de passe
- [ ] **AUTH-05** : L'utilisateur peut réinitialiser son mot de passe par email
- [ ] **AUTH-06** : La session persiste entre les rechargements de page
- [ ] **AUTH-07** : Les routes protégées redirigent vers /login si non authentifié
- [ ] **AUTH-08** : L'email de confirmation Supabase peut être désactivé (admin crée manuellement ou auto-inscription avec validation admin)

### Rôles & Permissions

- [ ] **ROLE-01** : 4 rôles par défaut existent : membre_agc, ancien_membre_agc, intervenant, administrateur
- [ ] **ROLE-02** : Chaque rôle a des permissions par page (booléen par page)
- [ ] **ROLE-03** : L'admin peut créer des rôles personnalisés avec permissions configurables
- [ ] **ROLE-04** : L'admin peut modifier les permissions d'un rôle existant
- [ ] **ROLE-05** : La sidebar affiche uniquement les items accessibles selon le rôle de l'utilisateur connecté
- [ ] **ROLE-06** : Un composant RoleGuard bloque l'accès aux pages non autorisées côté client

### Profil Utilisateur

- [ ] **PROF-01** : L'utilisateur peut voir et modifier ses informations de base (prénom, nom, portable, promo, adresse, ville…)
- [ ] **PROF-02** : Les données sensibles (NSS, IBAN) sont affichées masquées (****) avec bouton "Modifier"
- [ ] **PROF-03** : La modification NSS/IBAN passe par une API Route serveur (chiffrement AES-256-GCM)
- [ ] **PROF-04** : NSS et IBAN sont stockés chiffrés en BYTEA via pgcrypto en base
- [ ] **PROF-05** : L'utilisateur peut indiquer son pôle d'appartenance (pour membres AGC)
- [ ] **PROF-06** : L'admin peut voir et modifier le profil de n'importe quel membre

### Documents Personnels

- [ ] **DOCS-01** : L'utilisateur peut uploader 5 types de documents : carte identité, carte étudiante, carte vitale, preuve Lydia, RIB
- [ ] **DOCS-02** : Chaque document affiche son statut (uploadé / manquant) avec aperçu
- [ ] **DOCS-03** : L'utilisateur peut supprimer un document uploadé
- [ ] **DOCS-04** : Les fichiers sont stockés dans un bucket Supabase Storage privé
- [ ] **DOCS-05** : Les URLs d'accès sont des URLs signées avec expiration (1h)
- [ ] **DOCS-06** : Un bouton "Ajouter filigrane" ouvre https://filigrane.beta.gouv.fr dans un nouvel onglet

### Missions

- [ ] **MISS-01** : Tout utilisateur authentifié peut voir la liste des missions ouvertes
- [ ] **MISS-02** : Les missions peuvent être filtrées par type (chef de projet / intervenant), voie, classe
- [ ] **MISS-03** : L'utilisateur peut voir le détail d'une mission (description, dates, rémunération, JEH, critères)
- [ ] **MISS-04** : Un intervenant peut candidater à une mission (motivation, classe, langues si requises)
- [ ] **MISS-05** : Un utilisateur ne peut candidater qu'une seule fois à une mission donnée
- [ ] **MISS-06** : Un intervenant peut voir le statut de ses candidatures
- [ ] **MISS-07** : Un membre AGC peut voir toutes les candidatures reçues pour une mission
- [ ] **MISS-08** : Un membre AGC peut accepter ou refuser une candidature
- [ ] **MISS-09** : Un membre AGC peut créer une mission depuis la page d'une étude
- [ ] **MISS-10** : Les statuts de mission sont : ouverte, pourvue, terminée, annulée

### Études

- [ ] **ETUD-01** : Un membre AGC peut voir la liste de toutes les études avec filtres par statut
- [ ] **ETUD-02** : Un membre AGC peut créer une nouvelle étude (nom, numéro unique, client, suiveur, budget, commentaire)
- [ ] **ETUD-03** : La page détail d'une étude affiche les informations générales, missions associées et échéancier
- [ ] **ETUD-04** : L'échéancier est un Gantt simplifié avec blocs drag-and-drop (@dnd-kit)
- [ ] **ETUD-05** : Chaque bloc d'échéancier contient : nom, semaine de début, durée en semaines, JEH
- [ ] **ETUD-06** : Les statuts d'étude sont : prospection, en_cours_prospection, signée, en_cours, terminée
- [ ] **ETUD-07** : Une étude est liée à un client (AO, CS, ou prospection)

### Prospection

- [ ] **PROS-01** : Les membres AGC avec permission "prospection" voient un pipeline Kanban
- [ ] **PROS-02** : Les colonnes Kanban correspondent aux statuts : à contacter, contacté, relancé, RDV pris, proposition envoyée, gagné, perdu
- [ ] **PROS-03** : Les cartes sont glissables entre colonnes (@dnd-kit)
- [ ] **PROS-04** : Un membre peut créer un nouveau prospect (formulaire client)
- [ ] **PROS-05** : Chaque prospect affiche : nom, statut, responsable, prochaine action

### Statistiques

- [ ] **STAT-01** : Les admins et membres AGC autorisés voient le tableau de bord statistiques
- [ ] **STAT-02** : KPIs affichés : intervenants sélectionnés ce mois, nombre de missions/études actives
- [ ] **STAT-03** : Graphique camembert : répartition AO / CS / Prospection (recharts)
- [ ] **STAT-04** : Graphique barres : CA réalisé vs CA prévisionnel (recharts)
- [ ] **STAT-05** : Affichage de la rétribution payée (JEH × rémunération)

### Administration — Droits

- [ ] **ADM-01** : L'admin voit un tableau des profils avec leurs permissions (toggle par page)
- [ ] **ADM-02** : L'admin peut créer un nouveau profil personnalisé
- [ ] **ADM-03** : L'admin peut modifier les permissions d'un profil via des toggles

### Administration — Paramètres Structure

- [ ] **ADM-04** : L'admin peut configurer l'identité juridique (raison sociale, tribunal, statuts…)
- [ ] **ADM-05** : L'admin peut configurer la numérotation automatique (factures, missions, BV, avenants)
- [ ] **ADM-06** : L'admin peut configurer les dirigeants (nom + genre pour chaque rôle : président, VP, trésorier, SG, RH, etc.)
- [ ] **ADM-07** : L'admin peut configurer les données financières (frais structure, rémunération défaut, coordonnées bancaires)
- [ ] **ADM-08** : L'admin peut configurer les coordonnées de la structure et informations administratives (SIRET, TVA, URSSAF…)

### Administration — Templates Documents

- [ ] **ADM-09** : L'admin peut voir la liste des templates de documents
- [ ] **ADM-10** : L'admin peut créer/modifier/supprimer un template avec balises {{variable}}
- [ ] **ADM-11** : La liste des balises disponibles est affichée à côté de l'éditeur

### Administration — Membres

- [ ] **ADM-12** : L'admin peut voir tous les membres, intervenants, anciens, personnes en mandat
- [ ] **ADM-13** : L'admin peut modifier le rôle (profil_type) d'un utilisateur
- [ ] **ADM-14** : L'admin peut activer/désactiver un compte
- [ ] **ADM-15** : L'admin peut importer des membres via fichier .xlsx (parse → prévisualisation → confirmation → insertion)
- [ ] **ADM-16** : L'admin peut exporter les membres en fichier Excel

### Infrastructure & Sécurité

- [ ] **SEC-01** : RLS activé sur toutes les tables Supabase
- [ ] **SEC-02** : Le service_role_key n'est utilisé que côté serveur (API Routes), jamais côté client
- [ ] **SEC-03** : Bucket Storage `documents-personnes` configuré en privé
- [ ] **SEC-04** : Le middleware Next.js protège toutes les routes dashboard
- [ ] **SEC-05** : La clé ENCRYPTION_KEY n'est jamais exposée au client (pas de NEXT_PUBLIC_)
- [ ] **SEC-06** : next.config.js inclut `output: 'standalone'` pour compatibilité Docker

### Design & UX

- [ ] **UX-01** : Interface 100% en français (labels, messages d'erreur, textes)
- [ ] **UX-02** : Palette : bleu marine #0D1B2A + or #C9A84C + blanc cassé #F5F0E8 + bleu interactif #4A90D9
- [ ] **UX-03** : Fonts : Playfair Display (titres) + DM Sans (corps) via next/font
- [ ] **UX-04** : Sidebar avec items actifs surlignés en or #C9A84C, icônes Lucide
- [ ] **UX-05** : Badges statuts colorés : ouverte (vert), en_cours (bleu), terminée (gris), annulée (rouge), en_attente (orange)
- [ ] **UX-06** : Design responsive (mobile et desktop)

## v2 Requirements

### Notifications

- **NOTF-01** : Email automatique à l'intervenant lors de l'acceptation/refus d'une candidature
- **NOTF-02** : Rappel automatique pour les prochaines actions de prospection

### Signature électronique

- **SIGN-01** : Génération de contrats/BV depuis les templates avec remplissage automatique des variables
- **SIGN-02** : Signature électronique des documents (intégration YouSign ou DocuSign)

### Tableau de bord avancé

- **DASH-01** : Export PDF du tableau de bord statistiques

## Out of Scope

| Fonctionnalité | Raison |
|----------------|--------|
| Paiement en ligne | Rétribution gérée hors application (Lydia/virement manuel) |
| Email transactionnel v1 | Complexité supplémentaire, reporté en v2 |
| Application mobile native | Web responsive uniquement pour la v1 |
| Internationalisation | Interface uniquement en français |
| Inscription sans validation admin | L'admin assigne les rôles — un compte sans rôle voit un écran d'attente |

## Traçabilité

| Requirement | Phase | Statut |
|-------------|-------|--------|
| AUTH-01 à AUTH-08 | Phase 1 | En attente |
| ROLE-01 à ROLE-06 | Phase 1 | En attente |
| UX-01 à UX-06 | Phase 1 | En attente |
| SEC-04 à SEC-06 | Phase 1 | En attente |
| PROF-01 à PROF-06 | Phase 2 | En attente |
| DOCS-01 à DOCS-06 | Phase 2 | En attente |
| SEC-01 à SEC-03 | Phase 2 | En attente |
| MISS-01 à MISS-10 | Phase 3 | En attente |
| ETUD-01 à ETUD-07 | Phase 4 | En attente |
| PROS-01 à PROS-05 | Phase 5 | En attente |
| STAT-01 à STAT-05 | Phase 5 | En attente |
| ADM-01 à ADM-16 | Phase 6 | En attente |
| ADM-15 à ADM-16 | Phase 6 | En attente |

**Couverture :**
- v1 requirements : 62 total
- Mappés aux phases : 62
- Non mappés : 0 ✓

---
*Requirements définis : 2026-04-08*
*Dernière mise à jour : 2026-04-08 après initialisation*
