# Design — Rôles, postes (bureau/pôles) & permissions granulaires

Date : 2026-07-01
Statut : design validé (foundation + modèle), catalogue de permissions à compléter par Felix (Phase 2).

## 1. Contexte & existant

Befast possède **déjà** un système de rôles + permissions et son interface d'admin :

- Table `profils_types` : `id, nom, slug, permissions JSONB, est_defaut, timestamps`. Rôles seedés : `membre_agc`, `ancien_membre_agc`, `intervenant`, `chef_de_projet`, `administrateur`.
- `personnes.profil_type_id` → un rôle de base par personne. `personnes.pole` (texte libre) existe déjà.
- `permissions` = map plate `clé → bool` (ex. `{"dashboard":true,"voir_factures":true}`).
- UI `/administration/droits` : liste des rôles, **création** (`createRole`), **suppression** (`deleteRole`, admin protégé), **toggles par permission** (`updateRolePermissions`). `ALL_PERMS`/`PERM_LABELS` définissent le catalogue (14 clés).
- Enforcement réel : `components/layout/RoleGuard.tsx`, `app/(dashboard)/layout.tsx` (menu), routes API (`voir_factures`, `voir_documents_membres`, `assigner_intervenants`).
- Actions serveur : `lib/actions/members.ts` (`getAllRoles`, `createRole`, `deleteRole`, `updateRolePermissions`).

Le besoin (Felix) : des **sous-rôles au sein des membres** — bureau (Présidente, Vice-Présidente, Trésorier·ère, Secrétaire Général) et pôles (Audit Qualité, Dev Co, RH, SI, Marketing) — chacun porteur de permissions, verrouillables finement, gérables en UI, avec exemples : trésorerie = Présidente/Trésorier·ère/Admin ; assigner intervenants = RH ; signer docs = Présidente/Trésorier·ère ; signer BA = Présidente/pôle RH.

## 2. Décisions validées

1. **Modèle = rôle de base + postes cumulés.** Permissions effectives = `rôle_base.permissions ∪ (union des postes assignés.permissions)`.
2. **Plusieurs postes par personne** (table de liaison) : une personne peut porter p.ex. Présidente **et** pôle RH.
3. **Catalogue des types de permissions = défini en code** (chaque accès doit être branché à un garde réel). Felix dicte la liste des zones à verrouiller ; le branchement est codé. Création/suppression de **rôles/postes** et cochage des permissions = 100% UI.
4. Les **postes AJC standard sont seedés** (existent d'office). L'UI permet d'en créer/supprimer d'autres (réutilise l'UI rôles).

## 3. Modèle de données

### 3.1 `profils_types` — ajout d'une colonne `categorie`
```sql
ALTER TABLE public.profils_types
  ADD COLUMN categorie TEXT NOT NULL DEFAULT 'base'
  CHECK (categorie IN ('base','bureau','pole'));
```
- `base` : Membre AGC, Ancien membre, Intervenant, Chef de projet, Administrateur (assignés via `personnes.profil_type_id`, **un seul**).
- `bureau` : Présidente, Vice-Présidente, Trésorier·ère, Secrétaire Général.
- `pole` : Audit Qualité, Dev Co, RH, SI, Marketing.

### 3.2 `personne_postes` — table de liaison (cumul)
```sql
CREATE TABLE public.personne_postes (
  personne_id UUID NOT NULL REFERENCES public.personnes(id) ON DELETE CASCADE,
  poste_id    UUID NOT NULL REFERENCES public.profils_types(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (personne_id, poste_id)
);
-- RLS : lecture par l'intéressé + admins ; écriture réservée aux gardiens applicatifs (service_role).
```
Contrainte applicative : `poste_id` doit pointer une ligne `categorie IN ('bureau','pole')` (vérifiée côté action serveur).

### 3.3 Seed des postes AJC (migration)
Insère (categorie `bureau`) : Présidente, Vice-Présidente, Trésorier·ère, Secrétaire Général ; (categorie `pole`) : Audit Qualité, Développement Commercial, Ressources Humaines, Systèmes d'Information, Marketing. `permissions` initiales selon le tableau §5.

## 4. Résolution des permissions

Un helper unique, source de vérité, réutilisé partout :
```
lib/auth/permissions.ts
  resolveEffectivePermissions(baseRole, postes): Record<string, boolean>
    = OR logique, clé par clé, de base.permissions et de chaque poste.permissions
  hasPermission(profileWithPostes, key): boolean
```
- `lib/auth/cached-profile.ts` est étendu pour charger, en plus du rôle de base, les postes assignés (via `personne_postes` → `profils_types`) et exposer `permissionsEffectives`. Conserve le cache 5 min existant.
- `RoleGuard`, `app/(dashboard)/layout.tsx` et les gardes API consomment `permissionsEffectives` au lieu de `profils_types.permissions` seul. `administrateur` garde tous les droits (override existant conservé).
- JWT inchangé (l'enforcement lit la DB via le profil en cache, pas le JWT).

## 5. Catalogue de permissions

Existantes conservées (14) : `dashboard, profil, missions, etudes, prospection, statistiques, administration, membres, documents, nouvelle_mission, voir_documents_membres, assigner_intervenants, parametres_structure, voir_factures`.

Ajoutées en Phase 1 :

| Clé | Fonctionnalité | Défaut (postes/rôles) |
|---|---|---|
| `signer_documents` | Signer les documents classiques (file bureau) | Présidente, Trésorier·ère |
| `signer_ba` | Signer les bulletins d'adhésion | Présidente, pôle RH |

Réglages par défaut sur les postes seedés :
- **Présidente** : `signer_documents`, `signer_ba`, `voir_factures` (+ accès larges à définir avec Felix).
- **Trésorier·ère** : `signer_documents`, `voir_factures`.
- **pôle RH** : `signer_ba`, `assigner_intervenants`.
- **Admin** (base) : tout (override).

> **Phase 2 — à dicter par Felix** : liste exhaustive des zones à verrouiller/déverrouiller et le poste/rôle qui y a droit. Chaque entrée = 1 clé de permission + 1 garde posé sur la fonctionnalité. Tableau à compléter au fil de l'eau.

## 6. Réconciliation des signatures (Phase 2)

Aujourd'hui : `lib/signature/*` + `parametres` (`president_user_id`, `tresorier_user_id`, `rh_user_id`) + `bureauRoles()`.

Cible :
- **Accès** aux files de signature = permissions (`signer_documents`, `signer_ba`) au lieu d'un match d'ID utilisateur.
- **Signataire LiveConsent** (routage d'un lien vers 1 personne) = **le porteur du poste** : Présidente en priorité, Trésorier·ère en repli pour les docs classiques ; Présidente ou porteur du poste pôle RH pour les BA.
- Suppression des clés `parametres` `*_user_id` (remplacées par les postes). `getSignaturesAccess()` / `bureauRoles()` réécrits sur `hasPermission`.

## 7. Interface

- **`/administration/droits`** : liste groupée par `categorie` (Base / Bureau / Pôles), même éditeur de toggles + création/suppression. `PERM_LABELS` étendu avec les nouvelles clés.
- **`/administration/membres`** (édition d'une personne) : multi-select **« Postes (bureau/pôles) »** écrivant dans `personne_postes` via une nouvelle action serveur `setPersonnePostes(personneId, posteIds[])` (garde admin).

## 8. Découpage / phases

- **Phase 1 — Infrastructure** (indépendante de la liste de Felix) : migration (`categorie` + `personne_postes` + seed) ; `resolveEffectivePermissions`/`hasPermission` ; extension `cached-profile` + gardes ; UI Droits groupée + multi-select postes sur membres ; câblage des 4 permissions d'exemple (`voir_factures`, `assigner_intervenants`, `signer_documents`, `signer_ba`).
- **Phase 2 — Verrouillages précis** (nécessite la liste de Felix) : une clé + un garde par zone dictée ; bascule complète des signatures (§6) ; retrait des `parametres *_user_id`.

## 9. Migrations

Fichier `supabase/migrations/039_roles_postes.sql` + append dans `MIGRATIONS_A_APPLIQUER.sql` (pattern projet : application manuelle via Supabase SQL Editor). Aucune donnée à migrer (nouvelles structures).

## 10. Risques / points d'attention

- **Perf** : le profil en cache charge désormais les postes ; garder la requête ciblée et le cache 5 min.
- **RLS** : `personne_postes` et l'écriture des postes passent par le client `service_role` (gardiens applicatifs), cohérent avec le durcissement RLS (migration 034).
- **Cohérence signatures** : bien vérifier qu'au moins un porteur existe pour Présidente/pôle RH avant d'activer l'envoi auto des BA (sinon aucun signataire).
- **Migration 038 (BA)** : toujours à appliquer ; s'assurer que 039 vient après.
