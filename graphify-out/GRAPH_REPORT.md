# Graph Report - Befast  (2026-07-07)

## Corpus Check
- 318 files · ~190,659 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1871 nodes · 3409 edges · 116 communities (109 shown, 7 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 92 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e2557275`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 73|Community 73]]
- [[_COMMUNITY_Community 74|Community 74]]
- [[_COMMUNITY_Community 79|Community 79]]
- [[_COMMUNITY_Community 81|Community 81]]
- [[_COMMUNITY_Community 82|Community 82]]
- [[_COMMUNITY_Community 83|Community 83]]
- [[_COMMUNITY_Community 85|Community 85]]
- [[_COMMUNITY_Community 88|Community 88]]
- [[_COMMUNITY_Community 90|Community 90]]
- [[_COMMUNITY_Community 91|Community 91]]
- [[_COMMUNITY_Community 92|Community 92]]
- [[_COMMUNITY_Community 93|Community 93]]
- [[_COMMUNITY_Community 94|Community 94]]
- [[_COMMUNITY_Community 97|Community 97]]
- [[_COMMUNITY_Community 98|Community 98]]
- [[_COMMUNITY_Community 101|Community 101]]
- [[_COMMUNITY_Community 102|Community 102]]
- [[_COMMUNITY_Community 104|Community 104]]
- [[_COMMUNITY_Community 105|Community 105]]
- [[_COMMUNITY_Community 107|Community 107]]
- [[_COMMUNITY_Community 108|Community 108]]
- [[_COMMUNITY_Community 109|Community 109]]
- [[_COMMUNITY_Community 110|Community 110]]
- [[_COMMUNITY_Community 111|Community 111]]
- [[_COMMUNITY_Community 112|Community 112]]
- [[_COMMUNITY_Community 113|Community 113]]
- [[_COMMUNITY_Community 117|Community 117]]
- [[_COMMUNITY_Community 118|Community 118]]
- [[_COMMUNITY_Community 119|Community 119]]
- [[_COMMUNITY_Community 121|Community 121]]
- [[_COMMUNITY_Community 122|Community 122]]
- [[_COMMUNITY_Community 123|Community 123]]
- [[_COMMUNITY_Community 124|Community 124]]

## God Nodes (most connected - your core abstractions)
1. `createClient` - 155 edges
2. `createAdminClient()` - 115 edges
3. `cn()` - 38 edges
4. `Button` - 25 edges
5. `requireApiAdmin()` - 21 edges
6. `sendBA()` - 21 edges
7. `useUser()` - 20 edges
8. `PersonneWithRole` - 20 edges
9. `getCachedProfile()` - 19 edges
10. `Input` - 18 edges

## Surprising Connections (you probably didn't know these)
- `ProfileHeaderProps` --references--> `PersonneWithRole`  [EXTRACTED]
  app/(dashboard)/dashboard/profil/_components/profile-header.tsx → types/database.types.ts
- `ProfileInfoCardProps` --references--> `PersonneWithRole`  [EXTRACTED]
  app/(dashboard)/dashboard/profil/_components/profile-info-card.tsx → types/database.types.ts
- `SensitiveFieldCardProps` --references--> `PersonneWithRole`  [EXTRACTED]
  app/(dashboard)/dashboard/profil/_components/sensitive-field-card.tsx → types/database.types.ts
- `ProfilPage()` --calls--> `useUser()`  [INFERRED]
  app/(dashboard)/dashboard/profil/page.tsx → hooks/useUser.tsx
- `GET()` --calls--> `requireApiAdmin()`  [INFERRED]
  app/api/admin/custom-fields/route.ts → lib/auth/api-guards.ts

## Import Cycles
- None detected.

## Communities (116 total, 7 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.16
Nodes (18): PATCH(), sendEmail(), accountCreatedUserEmail(), accountValidatedEmail(), brandedEmail(), bulletinAdhesionEmail(), documentToSignEmail(), esc() (+10 more)

### Community 1 - "Community 1"
Cohesion: 0.19
Nodes (18): listBureauQueue(), GET(), GET(), GET(), GET(), fetchProfile(), getCachedProfile(), ALL_PERMISSION_KEYS (+10 more)

### Community 2 - "Community 2"
Cohesion: 0.12
Nodes (20): createRole(), deleteRole(), getAllMembers(), getAllRoles(), getCallerRole(), getPostesCatalog(), setPersonnePostes(), updateMemberRole() (+12 more)

### Community 3 - "Community 3"
Cohesion: 0.11
Nodes (27): deleteGeneratedDocument(), listMissionIntervenants(), listTemplates(), FIELD_CONFIG, SensitiveEditModalProps, FIELD_LABELS, SensitiveFieldModalProps, DocumentViewer() (+19 more)

### Community 4 - "Community 4"
Cohesion: 0.06
Nodes (37): 5 document types (CNI, carte etudiante, vitale, Lydia, RIB), createAdminClient (service_role_key), documents-personnes bucket (private), documents_personnes table + RLS, lib/encryption.ts (AES-256-GCM module), Phase 2: Profils & Documents, Rationale: private buckets need service_role or RLS, Rationale: store encrypted value as TEXT (iv:tag:ciphertext) (+29 more)

### Community 5 - "Community 5"
Cohesion: 0.06
Nodes (50): Plan 01-01: scaffolding Next.js, design system, Supabase, encryption, migrations SQL, custom_access_token_hook (rôle dans claims JWT), lib/encryption.ts (encrypt/decrypt server-only), Migrations SQL (profils_types, personnes, RLS, JWT hook), Active, BeFast — Odensia Junior Conseil, Constraints, Context (+42 more)

### Community 6 - "Community 6"
Cohesion: 0.07
Nodes (32): DashboardShell(), DashboardShellProps, UserContext, UseUserReturn, AppSidebar(), AppSidebarProps, IconType, labelVariants (+24 more)

### Community 7 - "Community 7"
Cohesion: 0.06
Nodes (36): dependencies, @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, class-variance-authority, clsx, docx-preview, docxtemplater, exceljs (+28 more)

### Community 8 - "Community 8"
Cohesion: 0.13
Nodes (15): DOC_ICONS, DocumentsGrid(), DocumentsGridProps, StatusBadgeProps, ACCEPTED_FILE_TYPES, CustomFieldFormValues, DOC_TYPE_ICONS, DOC_TYPE_LABELS (+7 more)

### Community 9 - "Community 9"
Cohesion: 0.08
Nodes (32): Admin Client for Storage (createAdminClient), POST /api/profil/avatar, /api/profil/documents (upload/list/delete/signed-url), PATCH /api/profil (basic profile CRUD), POST /api/profil/sensitive (NSS/IBAN encryption), documents_personnes Table + RLS, Migration 004_documents_personnes.sql, server-only Guard + Auth-First Pattern (+24 more)

### Community 10 - "Community 10"
Cohesion: 0.08
Nodes (31): AES-256-GCM Encryption Utilities, BeFast Design System, Custom JWT Access Token Hook, Manual Scaffolding over create-next-app, Next.js 14 App Router Project, Phase 01 Plan 01: Foundation, server-only Import Guard Pattern, SQL Schema (profils_types, personnes) (+23 more)

### Community 11 - "Community 11"
Cohesion: 0.12
Nodes (10): getProposal(), saveProposal(), GANTT_COLORS, getNextMonday(), PhaseCatalogue, phasesFallback, ProposalForm(), mockSavedPropales (+2 more)

### Community 12 - "Community 12"
Cohesion: 0.18
Nodes (12): audit_logs table, BeFast Security Fixes Implementation Plan, Phase 1: Critical Fixes, Phase 2: High Priority Fixes (audit logging), Phase 3: Medium Priority (encryption + docs), lib/supabase-security.ts utilities, HIGH: etudes/clients missing ownership check, HIGH: missing RLS on mission_intervenants (+4 more)

### Community 13 - "Community 13"
Cohesion: 0.12
Nodes (23): createClient_(), createEtude(), deleteEcheancierBloc(), deleteEtude(), getAllParametres(), _getAllParametresCached, getEcheancierBlocs(), getEtude() (+15 more)

### Community 14 - "Community 14"
Cohesion: 0.08
Nodes (28): Candidature, CandidatureStatut, CandidatureWithMission, CandidatureWithPersonne, Client, ClientType, CustomFieldType, CustomFieldValue (+20 more)

### Community 15 - "Community 15"
Cohesion: 0.07
Nodes (38): Cartographie des bases de données BeFast, Convention JEH (unité de facturation), Principe directeur: clarté et intégrité avant optimisation, Redondance R5: client dénormalisé sur proposals, Redondance R1: JEH éclaté sur 6 tables, Redondance R4: TVA recalculée en dur, Table budget_etude, Table etudes (+30 more)

### Community 16 - "Community 16"
Cohesion: 0.09
Nodes (21): 1. Contexte, 2. Objectifs, 3. Décisions validées (défauts confirmés), 4.1 Hub à onglets (`/signatures`), 4.2 Découpage en phases, 4. Architecture, 5.1 Migration `038_signature_ba.sql`, 5.2 Extension du client LiveConsent (+13 more)

### Community 17 - "Community 17"
Cohesion: 0.12
Nodes (18): CaParEtude, createFacture(), deleteFacture(), FactureRow, getEtudesForFactureSelect(), getTresorerieData(), marquerFacturePaiement(), marquerMissionPaiement() (+10 more)

### Community 18 - "Community 18"
Cohesion: 0.13
Nodes (23): buildPersonnePatch(), clean(), dedupeByEmail(), MappedMember, mapPoste(), MapResult, mapRow(), mapStatus() (+15 more)

### Community 19 - "Community 19"
Cohesion: 0.12
Nodes (16): getMargesRecommandees(), getParametres(), _readMarges, _readParametres, saveMargesRecommandees(), saveParametres(), FieldDef, SectionDef (+8 more)

### Community 20 - "Community 20"
Cohesion: 0.09
Nodes (7): ADMIN_NAV_LINKS, AdminSidebar(), LEGACY_ACTIVE, RoleGuard(), RoleGuardProps, PermissionKey, Skeleton()

### Community 21 - "Community 21"
Cohesion: 0.13
Nodes (13): CustomField, DynamicFieldsCard(), DynamicFieldsCardProps, ProfileHeader(), DEFAULT_POLES, FIELD_CONFIG, ProfileInfoCard(), ProfileInfoCardProps (+5 more)

### Community 22 - "Community 22"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 23 - "Community 23"
Cohesion: 0.17
Nodes (19): collectStaffEmails(), issueVerification(), notifyAccountOpened(), resendVerification(), resetPassword(), signIn(), signOut(), signUp() (+11 more)

### Community 24 - "Community 24"
Cohesion: 0.05
Nodes (64): buildBvContext(), buildFactureContext(), buildIntervenantContext(), buildJuniorAlias(), buildMentionAvenant(), buildOrganigramme(), buildPhasesContext(), buildSignataire() (+56 more)

### Community 25 - "Community 25"
Cohesion: 0.12
Nodes (16): aliases, components, hooks, lib, ui, utils, rsc, $schema (+8 more)

### Community 26 - "Community 26"
Cohesion: 0.12
Nodes (20): getProposalBudget(), BudgetSheet(), BudgetSheetMeta, BudgetBreakdown, BudgetInput, BudgetPhaseInput, BudgetPhaseLine, computeBudget() (+12 more)

### Community 27 - "Community 27"
Cohesion: 0.24
Nodes (10): getStats(), fmt(), metadata, StatistiquesPage(), COLOR_MAP, KpiCard(), StatistiquesClient(), StatsData (+2 more)

### Community 28 - "Community 28"
Cohesion: 0.17
Nodes (11): File Structure, Import des membres Be Quick → Be Fast — Implementation Plan, Ordre d'exécution réel (hors code, côté utilisateur), Task 1: Dépendances & gitignore, Task 2: Migration 042 (colonnes legacy + rename rôle), Task 3: Corriger les références `membre_agc` dans le code, Task 4: Module de mapping pur (TDD), Task 5: Mini-loader d'environnement (+3 more)

### Community 29 - "Community 29"
Cohesion: 0.24
Nodes (10): candidaterMission(), createMission(), getCandidaturesMission(), getMission(), repondreCandidature(), updateMissionStatut(), missionAssignedEmail(), CANDIDATURES_TAG() (+2 more)

### Community 30 - "Community 30"
Cohesion: 0.13
Nodes (14): 10. Risques / points d'attention, 1. Contexte & existant, 2. Décisions validées, 3.1 `profils_types` — ajout d'une colonne `categorie`, 3.2 `personne_postes` — table de liaison (cumul), 3.3 Seed des postes AJC (migration), 3. Modèle de données, 4. Résolution des permissions (+6 more)

### Community 31 - "Community 31"
Cohesion: 0.14
Nodes (18): GET(), PATCH(), PATCH(), GET(), GET(), ApiGuardResult, requireApiAdmin(), requireApiUser() (+10 more)

### Community 32 - "Community 32"
Cohesion: 0.04
Nodes (44): 1. Next.js 14 App Router + Supabase Auth SSR (`@supabase/ssr`), 2. Row Level Security (RLS) — Role-Based Permissions, 3. Supabase Storage — Private Buckets + Signed URLs in Next.js, 4. AES-256-GCM Encryption in Node.js — Sensitive Fields (NSS, IBAN), 5. Server-Only Route Handlers with `service_role_key`, 6. Environment Variables Summary, 7. Recommended Project Structure, 8. Key Warnings Summary (+36 more)

### Community 33 - "Community 33"
Cohesion: 0.05
Nodes (42): Add avatar_url to personnes, Anti-Patterns to Avoid, Architecture Patterns, Avatar Upload with Fallback, Claude's Discretion, Code Examples, Common Pitfalls, Core (already installed) (+34 more)

### Community 34 - "Community 34"
Cohesion: 0.15
Nodes (13): devDependencies, autoprefixer, csv-parse, eslint, eslint-config-next, postcss, tailwindcss, tsx (+5 more)

### Community 35 - "Community 35"
Cohesion: 0.14
Nodes (13): Prérequis, Rôles & Postes (Phase 1 — Infrastructure) Implementation Plan, Self-review (rempli par l'auteur du plan), Task 0: Branche de travail, Task 1: Migration SQL — colonne `categorie`, table `personne_postes`, seed des postes AJC, Task 2: Types — nouvelles permissions, `categorie`, postes sur `PersonneWithRole`, Task 3: Résolveur de permissions effectives (TDD), Task 4: Charger les postes dans le profil en cache (+5 more)

### Community 36 - "Community 36"
Cohesion: 0.06
Nodes (35): 1. shadcn/ui Theming — Custom Palette with CSS Variables, 2. Kanban Board — @dnd-kit/core, 3. Gantt / Timeline Scheduler — @dnd-kit/sortable, 4. Role-Based Sidebar Navigation, 5.1 Data Tables (TanStack Table + shadcn/ui), 5.2 Form Wizards (Multi-Step), 5.3 Modal Dialogs, 5.4 Accordion Forms (Settings Pages) (+27 more)

### Community 37 - "Community 37"
Cohesion: 0.27
Nodes (10): BaFieldValues, BA_REQUIRED_DOC_TYPES, BA_REQUIRED_PROFILE_FIELDS, buildBaFieldValues(), emailLocalPart(), frDate(), fullAddress(), MemberData (+2 more)

### Community 38 - "Community 38"
Cohesion: 0.20
Nodes (9): name, private, scripts, build, dev, lint, start, test (+1 more)

### Community 40 - "Community 40"
Cohesion: 0.24
Nodes (6): inter, manrope, metadata, ThemeProvider(), Toaster(), ToasterProps

### Community 41 - "Community 41"
Cohesion: 0.22
Nodes (10): getMissions(), useUrlFilters(), CLASSES, FILTER_KEYS, MISSION_TYPES, MissionsClient(), TYPE_COLORS, typeLabel() (+2 more)

### Community 42 - "Community 42"
Cohesion: 0.06
Nodes (33): BeFast, BeFast, BeFast (main worktree), Code Created, Commits Made, 🎯 Deliverables by Project, Effort Tracking, Expected Deliverables (+25 more)

### Community 43 - "Community 43"
Cohesion: 0.33
Nodes (7): Composant AppSidebar, Composant Button, Couleur Navy marque (#00236f), Couleur Or accent (#C9A84C), Charte graphique Be Fast, Règle d'or: une entité = un composant partout, Typographie Inter / Manrope

### Community 44 - "Community 44"
Cohesion: 0.33
Nodes (6): AvatarUpload(), AvatarUploadProps, ProfileHeaderProps, Avatar, AvatarFallback, AvatarImage

### Community 45 - "Community 45"
Cohesion: 0.42
Nodes (7): escapeXml(), fixBrokenTags(), generateBudgetTableXml(), generateGanttTableXml(), POST(), replacePlaceholderShapeWithTable(), setShapeText()

### Community 46 - "Community 46"
Cohesion: 0.21
Nodes (10): ChampsTab(), CustomFieldForm, CustomField, CustomFieldModal(), CustomFieldModalProps, CustomFieldsTable(), CustomFieldsTableProps, TYPE_LABELS (+2 more)

### Community 51 - "Community 51"
Cohesion: 0.67
Nodes (3): config, middleware(), readSessionExpiry()

### Community 53 - "Community 53"
Cohesion: 0.17
Nodes (11): Contexte & objectif, Flux email « définir mon mot de passe » (construit, dormant), Hors périmètre (non-goals), Import des membres Be Quick → Be Fast — Design, Mapping des champs (CSV → `personnes` / Auth), Mapping des rôles, Migration schéma, Renommage de rôle préalable : `membre_agc` → `membre_ajc` (+3 more)

### Community 54 - "Community 54"
Cohesion: 0.12
Nodes (17): MissionCardProps, createClient(), SupportReport, STATUS_STYLES, Button, ButtonProps, buttonVariants, Card (+9 more)

### Community 56 - "Community 56"
Cohesion: 0.11
Nodes (26): BAMemberRow, BureauQueueRow, delegateToTresorier(), getBaAdminSettings(), getBaEligibleSigners(), getPosteHolderUserId(), getSignatureConfig(), getSignaturesAccess() (+18 more)

### Community 57 - "Community 57"
Cohesion: 0.50
Nodes (3): POST(), ReportData, reportSchema

### Community 58 - "Community 58"
Cohesion: 0.22
Nodes (14): refreshSignatureStatus(), sendDocumentForSignature(), GET(), safeEqual(), abandonRequest(), CreateSignatureOpts, createSignatureRequest(), DEFAULT_SIGNATURE_POS (+6 more)

### Community 61 - "Community 61"
Cohesion: 0.39
Nodes (5): POST(), CuratedDocument, provisionRhCandidate(), pushDocumentsToRh(), POST()

### Community 62 - "Community 62"
Cohesion: 0.19
Nodes (9): CAND_STATUT_COLORS, CAND_STATUT_LABELS, STATUT_COLORS, STATUT_LABELS, Badge(), BadgeProps, badgeVariants, Textarea (+1 more)

### Community 63 - "Community 63"
Cohesion: 0.33
Nodes (5): POST(), scalewayS3, buildMissionDocPath(), buildPersonneDocPath(), sanitize()

### Community 65 - "Community 65"
Cohesion: 0.39
Nodes (6): getEtudes(), getMesCandidatures(), getMyPendingSignature(), MemberSignatureBanner(), DashboardPage(), STATUT_BADGE

### Community 66 - "Community 66"
Cohesion: 0.20
Nodes (9): getClients(), _getClientsCached, getMembers(), _getMembersCached, toggleEtudePublished(), updateEtude(), STATUT_CONFIG, STATUT_ORDER (+1 more)

### Community 68 - "Community 68"
Cohesion: 0.17
Nodes (18): createPhaseDefaut(), getCaller(), getMyPhasePermissions(), getPhasesDefaut(), getPhasesStats(), getPrixNetMoyenParPhase(), getSuggestedPhases(), integrateSuggestedPhase() (+10 more)

### Community 71 - "Community 71"
Cohesion: 0.50
Nodes (3): buildCommand, crons, outputDirectory

### Community 72 - "Community 72"
Cohesion: 0.06
Nodes (33): BeFast, Checklist Items, Code Changes, Commits, ⚠️ Critical Path, Deliverables, Documentation, Effort Tracking (+25 more)

### Community 73 - "Community 73"
Cohesion: 0.07
Nodes (29): 1.1 Expand Column Protection on `personnes`, 1.2 Fix `budget_etude` RLS, 1.3 Fix `factures` RLS, 1.4 Fix `etudes` & `clients` RLS, 1. **ESCALADE DE PRIVILÈGES SUR `personnes` TABLE** (PARTIELLEMENT FIXÉE), 2.1 Add RLS to `mission_intervenants`, 2.2 Add Server-Side Permission Checks, 2.3 Update API Routes to Use Permission Checks (+21 more)

### Community 74 - "Community 74"
Cohesion: 0.07
Nodes (28): Accent Reserved For (Phase 2 additions), Avatar Upload Flow, Checker Sign-Off, Color, Component Inventory (Phase 2), Copywriting Contract, Custom components (built in Phase 2), /dashboard/profil (own profile) (+20 more)

### Community 79 - "Community 79"
Cohesion: 0.24
Nodes (5): ExplorateurTab(), EXPORTABLE, ExportTab(), TabKey, TABS

### Community 90 - "Community 90"
Cohesion: 0.08
Nodes (24): 60/30/10 Allocation, Accent Reserved For (exact list — no other elements), /attente, Auth Flow State Machine, Checker Sign-Off, Color, Component Inventory (Phase 1), Copywriting Contract (+16 more)

### Community 91 - "Community 91"
Cohesion: 0.08
Nodes (23): 1. Inventaire par domaine, 2. Redondances identifiées 🔴, 3. Données exploitées vs. exploitables (générables), 4. Tables à intégrer (propositions) 🟢, Cartographie des bases de données — BeFast, 💼 Commercial / CRM, Déjà exploitées, 💰 Finance (+15 more)

### Community 92 - "Community 92"
Cohesion: 0.11
Nodes (24): ProfilPage(), FIELD_CONFIG, ProfileInfoForm(), ProfileInfoFormProps, EtudeDetailPage(), GANTT_COLORS, MISSION_STATUT_COLORS, MISSION_STATUT_LABELS (+16 more)

### Community 93 - "Community 93"
Cohesion: 0.09
Nodes (22): 1.1 Deploy SQL Migration (1 hour), 1.2 Add Server-Side Security Library (30 min), 1.3 Update API Routes (2-3 hours), 2.1 Add Audit Logging Table (1 hour), 2.2 Add RLS to `mission_intervenants` (30 min), 2.3 Add Permission Checks to Sensitive Server Actions (1.5 hours), 2.4 Test All Changes (1 hour), 3.1 Encrypt Sensitive Fields (2-3 hours) (+14 more)

### Community 94 - "Community 94"
Cohesion: 0.09
Nodes (22): Administration — Droits, Administration — Membres, Administration — Paramètres Structure, Administration — Templates Documents, Authentification & Accès, Design & UX, Documents Personnels, Infrastructure & Sécurité (+14 more)

### Community 97 - "Community 97"
Cohesion: 0.17
Nodes (21): GET(), SIGNED_STATUSES, signatureReminderEmail(), BaSettings, checkMemberComplete(), CompletenessResult, dec(), ENCRYPTED_COLS (+13 more)

### Community 98 - "Community 98"
Cohesion: 0.11
Nodes (17): 1. Flux inscription complet, 2. Flux connexion → dashboard avec role, 3. Comportement middleware (redirect non-authentifie), 4. RoleGuard — acces refuse, Anti-Patterns Found, Behavioral Spot-Checks, Data-Flow Trace (Level 4), Gaps Summary (+9 more)

### Community 101 - "Community 101"
Cohesion: 0.15
Nodes (12): Accomplishments, Auto-fixed Issues, Decisions Made, Deviations from Plan, Files Created/Modified, Issues Encountered, Next Phase Readiness, Performance (+4 more)

### Community 102 - "Community 102"
Cohesion: 0.15
Nodes (12): Accomplishments, Auto-fixed Issues, Decisions Made, Deviations from Plan, Files Created/Modified, Issues Encountered, Next Phase Readiness, Performance (+4 more)

### Community 104 - "Community 104"
Cohesion: 0.17
Nodes (11): Assets Réutilisables (Phase 1), Avatar, Canonical Refs, Decisions, Deferred Ideas, Documents, Domain, Données sensibles (NSS / IBAN) (+3 more)

### Community 105 - "Community 105"
Cohesion: 0.09
Nodes (22): BudgetValidationRow, decideBudget(), deleteProposal(), GANTT_COLORS, getBudgetValidations(), getProposalClients(), getProposalMembers(), getProposals() (+14 more)

### Community 107 - "Community 107"
Cohesion: 0.20
Nodes (9): Auto-fixed Issues, Commits, Deviations from Plan, Known Stubs, Phase 02 Plan 01: Profile API and Encrypted Documents Summary, Self-Check: PASSED, Task 1: SQL migration + types + Zod schemas, Task 2: All API Routes (+1 more)

### Community 108 - "Community 108"
Cohesion: 0.20
Nodes (9): Accumulated Context, Blockers/Concerns, Current Position, Decisions, Pending Todos, Performance Metrics, Project Reference, Project State (+1 more)

### Community 109 - "Community 109"
Cohesion: 0.20
Nodes (9): 1. Verify Migration 035 SQL Syntax, Automated RLS Tests, Deployment to Staging, Next Steps After Phase 1 Passes, Phase 1 Security Testing Plan, Pre-flight Checks, Rollback Plan, Verification Checklist (+1 more)

### Community 110 - "Community 110"
Cohesion: 0.22
Nodes (8): 1. Couleurs, 2. Typographie, 3. Formes & profondeur, 4. Composants (à réutiliser tels quels), 5. Layout applicatif, 6. Dépendances de la charte, Charte graphique — Be Fast, Règles d'emploi

### Community 111 - "Community 111"
Cohesion: 0.25
Nodes (7): Manual-Only Verifications, Per-Task Verification Map, Phase 1 — Validation Strategy, Sampling Rate, Test Infrastructure, Validation Sign-Off, Wave 0 Requirements

### Community 112 - "Community 112"
Cohesion: 0.25
Nodes (7): Manual-Only Verifications, Per-Task Verification Map, Phase 02 — Validation Strategy, Sampling Rate, Test Infrastructure, Validation Sign-Off, Wave 0 Requirements

### Community 113 - "Community 113"
Cohesion: 0.25
Nodes (7): Expérience utilisateur, Logs — BeFast, Membres & administration, Module Propositions / Prospection (générateur de propositions commerciales), Pilotage & paramètres, Trésorerie, À venir / en cours

### Community 117 - "Community 117"
Cohesion: 0.33
Nodes (6): Migration 035 security_fix_critical.sql, HIGH: factures excessive read access, guard_personnes_protected_columns trigger, CRITICAL: Privilege Escalation on personnes, Rationale: RLS fixes are backwards compatible, app/api/profil/route.ts hardened

### Community 118 - "Community 118"
Cohesion: 0.33
Nodes (6): Security Audit & Implementation Progress, Phase A: Migration 035 Validated, Phase B: 3 API Routes Hardened, Phase C: RH Manager Anti Audit (in progress), app/api/tresorerie/validate/route.ts hardened, app/api/upload/frais/route.ts hardened

### Community 119 - "Community 119"
Cohesion: 0.33
Nodes (6): Manual Testing with API Routes, Test 1: User A cannot read all budgets, Test 2: User A cannot modify taux_horaire, Test 3: User A cannot read unassigned factures, Test 4: Admin CAN modify taux_horaire, Test Setup

### Community 121 - "Community 121"
Cohesion: 0.40
Nodes (5): Common Issues & Solutions, Issue: "function does not exist", Issue: "permission denied for schema public", Issue: "Policy does not exist" errors, Issue: "trigger already exists"

### Community 122 - "Community 122"
Cohesion: 0.50
Nodes (4): Budget validation (admin) feature, BeFast Feature Logs, CRITICAL: budget_etude readable by anyone, Automated RLS test suite (rls-security.test.sql)

### Community 123 - "Community 123"
Cohesion: 0.67
Nodes (3): Local Testing Workflow, Option A: Test with Supabase CLI (Recommended), Option B: Test with Docker Postgres (Manual)

### Community 124 - "Community 124"
Cohesion: 0.40
Nodes (5): Be Fast — CRM de la Junior-Entreprise Audencia (AJC), graphify, Règles importantes, Stack, Structure

## Knowledge Gaps
- **775 isolated node(s):** `ADMIN_NAV_LINKS`, `LEGACY_ACTIVE`, `CustomField`, `CustomFieldModalProps`, `TYPE_LABELS` (+770 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `createClient` connect `Community 13` to `Community 0`, `Community 1`, `Community 2`, `Community 3`, `Community 8`, `Community 11`, `Community 17`, `Community 19`, `Community 23`, `Community 24`, `Community 27`, `Community 29`, `Community 31`, `Community 41`, `Community 45`, `Community 56`, `Community 57`, `Community 58`, `Community 61`, `Community 63`, `Community 65`, `Community 66`, `Community 68`, `Community 69`, `Community 70`, `Community 105`?**
  _High betweenness centrality (0.056) - this node is a cross-community bridge._
- **Why does `createAdminClient()` connect `Community 68` to `Community 0`, `Community 1`, `Community 2`, `Community 8`, `Community 11`, `Community 13`, `Community 19`, `Community 23`, `Community 24`, `Community 26`, `Community 29`, `Community 31`, `Community 45`, `Community 56`, `Community 58`, `Community 61`, `Community 63`, `Community 65`, `Community 97`, `Community 105`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **Why does `cn()` connect `Community 6` to `Community 3`, `Community 105`, `Community 44`, `Community 20`, `Community 54`, `Community 56`, `Community 92`, `Community 62`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Are the 15 inferred relationships involving `createAdminClient()` (e.g. with `PATCH()` and `PATCH()`) actually correct?**
  _`createAdminClient()` has 15 INFERRED edges - model-reasoned connections that need verification._
- **What connects `ADMIN_NAV_LINKS`, `LEGACY_ACTIVE`, `CustomField` to the rest of the system?**
  _775 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.12121212121212122 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.11153846153846154 - nodes in this community are weakly interconnected._