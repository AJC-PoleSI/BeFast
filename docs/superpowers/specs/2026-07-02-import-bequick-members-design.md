# Import des membres Be Quick → Be Fast — Design

Date : 2026-07-02
Statut : approuvé (design), plan à venir

## Contexte & objectif

Migrer les ~657 membres de l'ancienne plateforme **Be Quick** (export CSV) vers
**Be Fast** (Next.js + Supabase). Chaque membre doit devenir :

- un utilisateur **Supabase Auth** (`auth.users`) — car `personnes.id` est une FK
  vers `auth.users.id` ;
- une ligne **`public.personnes`** avec ses infos (dont PII chiffrées) et son rôle.

Les mots de passe ne sont **pas** connus. On crée les comptes avec un mot de passe
aléatoire jetable, puis (plus tard) chaque membre reçoit un lien sécurisé « définir
mon mot de passe ». **Aucun mot de passe en clair n'est jamais transmis ni stocké.**

Contrainte forte : **rien ne doit être envoyé** (aucun email) tant que l'utilisateur
ne le déclenche pas explicitement. Le flux email est construit mais dormant.

## Source de données

- Fichier : `~/Downloads/export_etudiants (1).csv` (657 lignes ; la variante sans
  `(1)` en compte 655 — on prend la plus récente).
- Séparateur `;`, champs éventuellement entre guillemets → **parser CSV robuste
  obligatoire** (`csv-parse`), pas de découpage manuel.
- Le fichier reste **en local** sur la machine. Le script le lit sur disque et ne
  parle qu'à Supabase. Il ne doit être uploadé nulle part.

Colonnes : `id, image_url, civilite, etat_id, etat_nom, email, prenom, nom,
adresse, ville, code_postal, num_secu, portable, promo, poste_id, poste_intitule,
admin_validated, competences, business_units`.

Profil des données (parser quote-aware) :
- `email` : 607 `@audencia.com`, 28 `@ajc-mail.com`, ~20 perso (gmail/icloud/…),
  **1 doublon** (`teo.fayon@audencia.com`), **1 domaine malformé** (`@audencialcom`).
- `num_secu` renseigné sur ~542 lignes.
- `civilite` propre (M./Mlle/Mme/vide), `admin_validated` ∈ {0,1}.
- `business_units` : **vide partout** → ignoré. `competences` : 6 lignes seulement.

## Renommage de rôle préalable : `membre_agc` → `membre_ajc`

Le rôle de base seedé s'appelle `membre_agc` / « Membre AGC ». On le renomme en
`membre_ajc` / « Membre AJC » (slug + libellé). `ancien_membre_agc` **n'est pas**
renommé (hors périmètre demandé).

Blast radius (références en dur à corriger) :
- `supabase/migrations/001_init_schema.sql` (seed) — via nouvelle migration `UPDATE`,
  on ne modifie pas l'ancienne migration.
- `app/(dashboard)/missions/[missionId]/page.tsx` — L92 accepte déjà les deux ;
  L98 ne teste que `membre_agc` → ajouter `membre_ajc`.
- `app/api/tresorerie/validate/route.ts` — liste de rôles.
- `app/api/storage/download/route.ts` — check `isPrivileged`.
- `app/api/download/[type]/[id]/route.ts` — check `isPrivileged`.
- `lib/auth/permissions.test.ts` — slug par défaut du helper de test.

Approche : migration SQL `UPDATE profils_types SET slug='membre_ajc',
nom='Membre AJC' WHERE slug='membre_agc';` + remplacement des références code par
`membre_ajc`. Les JWT existants portant `app_role='membre_agc'` se rafraîchissent à
la prochaine connexion ; pendant la transition, garder l'acceptation des deux slugs
là où c'est trivial n'est pas nécessaire (peu d'utilisateurs actifs actuellement).

## Mapping des champs (CSV → `personnes` / Auth)

| CSV | Cible | Traitement |
|---|---|---|
| `email` | `auth.users.email` + `personnes.email` | trim + lowercase ; dédoublonnage |
| `prenom`, `nom` | `personnes.prenom/nom` | clair |
| `portable` | `personnes.portable` | clair |
| `promo` | `personnes.promo` | clair |
| `num_secu` | `personnes.nss_encrypted` (+ iv/auth_tag) | **chiffré** |
| `adresse` | `personnes.adresse_encrypted` (+ iv/auth_tag) | **chiffré** |
| `ville` | `personnes.ville_encrypted` (+ iv/auth_tag) | **chiffré** |
| `code_postal` | `personnes.code_postal_encrypted` (+ iv/auth_tag) | **chiffré** |
| `civilite` | `personnes.civilite` (nouvelle colonne) | clair |
| `competences` | `personnes.competences` (nouvelle colonne) | clair |
| `id` (Be Quick) | `personnes.legacy_bequick_id` (nouvelle colonne) | clé d'idempotence |
| `image_url` | — | ignoré (asset Be Quick, avatar par défaut) |
| `business_units` | — | ignoré (vide partout) |
| `etat_nom`, `admin_validated` | `personnes.account_status` / `actif` | voir ci-dessous |
| `poste_intitule` | rôle de base + poste | voir table des rôles |

Chiffrement : AES-256-GCM, clé dérivée par `pbkdf2(masterKey, salt, 100000, 32,
sha256)`, un **`encryption_salt` par personne** — identique à `lib/crypto.ts` pour
que l'app puisse déchiffrer. `ENCRYPTION_MASTER_KEY` lu depuis l'environnement.

## Mapping des rôles

Rôle de base (`personnes.profil_type_id`) + postes (`personne_postes`) :

| `poste_intitule` | # | rôle de base | poste |
|---|---|---|---|
| Administrateur | 9 | `administrateur` | — |
| Chef de Projet | 12 | `membre_ajc` | — |
| 1A (mandat entrant) | 13 | `membre_ajc` | — |
| Pôle RH | 6 | `membre_ajc` | `pole_rh` |
| Pôle Trésorerie | 4 | `membre_ajc` | `tresorier` |
| Intervenant (BA) | 602 | `intervenant` | — |
| *(vide)* | 11 | `intervenant` | — |

Statut du compte :
- `Radié` (etat_nom) → `actif = false` (données conservées, pas d'accès).
- `Candidats` (etat_nom) → `account_status = 'pending_validation'`.
- `Membres` (etat_nom) → `account_status` selon `admin_validated`
  (`1` → `validated`, `0` → `pending_validation`).

Un compte non validé sur Be Quick **n'est pas** validé sur Be Fast : il repasse
comme un nouvel inscrit en attente de validation admin.

## Migration schéma

Nouvelle migration `042_import_members_columns.sql` (idempotente) :
- `ALTER TABLE personnes ADD COLUMN IF NOT EXISTS legacy_bequick_id INTEGER` +
  index unique partiel (`WHERE legacy_bequick_id IS NOT NULL`).
- `ADD COLUMN IF NOT EXISTS civilite TEXT`.
- `ADD COLUMN IF NOT EXISTS competences TEXT`.
- `UPDATE profils_types SET slug='membre_ajc', nom='Membre AJC' WHERE slug='membre_agc';`
- `NOTIFY pgrst, 'reload schema';`
- Ajout du bloc correspondant à `MIGRATIONS_A_APPLIQUER.sql` (workflow manuel du projet).

## Script d'import (autonome)

`scripts/import-bequick-members.ts`, exécuté via `tsx` avec l'environnement chargé
(`SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `ENCRYPTION_MASTER_KEY`).
Dépendances dev ajoutées : `tsx`, `csv-parse`.

Comportement :
- **Dry-run par défaut** : lit + parse + mappe le CSV, produit un **rapport** (total,
  répartition par rôle/poste/statut, doublons, anomalies : domaine malformé, email
  manquant, poste inconnu) et n'écrit **rien**.
- **`--commit`** : exécute réellement les créations.
- **Idempotent** : pour chaque ligne, si `legacy_bequick_id` déjà importé ou email
  déjà présent dans `auth.users` → mise à jour de la ligne `personnes` (rôle,
  postes, PII) sans recréer l'utilisateur. Sinon `auth.admin.createUser({ email,
  email_confirm: true, password: <random 32o>, user_metadata: { prenom, nom } })`.
- Création utilisateur : le trigger `handle_new_user` crée la ligne `personnes` de
  base ; le script complète ensuite (PII chiffrées, rôle, postes, statut, colonnes
  legacy).
- Postes écrits dans `personne_postes` (résolution slug→id des postes en début de run).
- Le rapport final est aussi écrit dans un fichier local (`scripts/out/import-report-<ts>.json`)
  — **jamais commité** (ajouter `scripts/out/` au `.gitignore`).

Anomalies (non bloquantes, listées dans le rapport, non importées tant que non
corrigées) : email malformé `@audencialcom`, ligne sans email exploitable, poste
non reconnu.

## Flux email « définir mon mot de passe » (construit, dormant)

- Template `passwordSetupEmail({ prenom, link })` dans `lib/email/templates.ts`
  (charte existante), CTA vers le lien de recovery.
- Script séparé `scripts/send-password-setup.ts` (dry-run par défaut, `--commit`
  pour envoyer) qui, pour chaque membre importé, génère un lien via
  `auth.admin.generateLink({ type: 'recovery', email })` et l'envoie via `sendEmail`.
- **Aucun envoi** dans le cadre de cette tâche. Le script existe mais n'est lancé
  par personne. Gating explicite : refuse de tourner sans `--commit`.

## Hors périmètre (non-goals)

- Migration des avatars/images.
- Migration d'autres entités Be Quick (missions, études, documents…).
- Envoi effectif des emails.
- Renommage de `ancien_membre_agc`.
- UI d'import dans l'app (script CLI uniquement).

## Sécurité

- Fichier CSV : **local uniquement**, jamais uploadé.
- `SUPABASE_SERVICE_ROLE_KEY` et `ENCRYPTION_MASTER_KEY` : lus depuis l'env local,
  jamais logués ni écrits dans le rapport.
- Le rapport ne contient **aucune PII en clair** (pas de NSS, pas d'adresse) — seulement
  compteurs, emails, `legacy_bequick_id` et décisions de mapping.
- NSS chiffré sous `ENCRYPTION_MASTER_KEY` : si cette clé doit être tournée, le faire
  **avant** l'import (re-chiffrer serait coûteux ensuite).
