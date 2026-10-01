# Be Fast — CRM de la Junior-Entreprise Audencia (AJC)

Application interne de gestion pour Audencia Junior Conseil : membres, études/missions, intervenants, trésorerie, génération de documents (RDM, conventions…), signatures électroniques et statistiques.

## Stack

- **Next.js 14 (App Router)** + React 18 + TypeScript, Tailwind CSS + Radix UI, déployé sur Vercel
- **Supabase** : auth + Postgres + RLS, via `@supabase/ssr` (`lib/supabase/`)
- **Scaleway S3** pour le stockage d'objets (uploads privés, presigned URLs)
- **docxtemplater + pizzip** pour la génération de documents Word
- Tests : `npm run test` (vitest) · Lint : `npm run lint` · Dev : `npm run dev`

## Structure

- `app/(auth)/`, `app/(dashboard)/` — pages ; le dashboard couvre administration, études, missions, trésorerie, documents, signatures, prospection, statistiques
- `app/api/` — routes API (documents, intégration RH, SSO, onboarding…)
- `lib/actions/` — server actions par domaine (members, etudes, missions, tresorerie, documents…) : logique métier principale
- `lib/auth/api-guards.ts` — **toute nouvelle route API admin doit passer par `requireApiAdmin`** (helper partagé, ne pas réimplémenter la vérification)
- `lib/docx/template-engine.ts` + `lib/document-fields.ts` — moteur de templates et carte des placeholders `{mission.x}`, `{etude.x}`…
- `lib/crypto.ts` / `lib/encryption.ts` — chiffrement des PII (NSS, etc.) ; **deux formats de chiffrement coexistent en base**, toujours passer par les helpers existants pour lire/écrire
- `supabase/migrations/` — migrations SQL numérotées

## Règles importantes

- **Migrations** : elles ne s'appliquent pas automatiquement. Créer le fichier numéroté dans `supabase/migrations/` et signaler à Felix qu'il doit l'appliquer manuellement (dashboard Supabase).
- **Permissions** : rôles de base + postes (bureau/pôles) cumulés, migration 039. Source de vérité : `lib/auth/permissions.ts` (`ALL_PERMISSION_KEYS`, `resolveEffectivePermissions`, `hasPermission`, `hasAnyPermission`). Cartographie complète : `docs/CARTOGRAPHIE_ROLES.md` + `lib/auth/access-map.ts`, verrouillés par `lib/auth/access-map.test.ts`.
  - Gardes à réutiliser (ne pas réimplémenter) : `lib/auth/page-guards.ts` (`checkPageAccess` dans un `layout.tsx`), `lib/auth/api-guards.ts` (`requireApiPermission` / `requireApiAnyPermission`), `lib/auth/action-guards.ts` (`requireActionPermission`).
  - Une nouvelle clé doit être ajoutée à `ALL_PERMISSION_KEYS`, à `PERM_LABELS` (écran Droits) **et** ouvrir une surface déclarée dans `access-map.ts` — sinon les tests échouent (clé morte).
  - Une page ne se protège jamais par le seul masquage du lien dans la sidebar ; une action qui utilise `createAdminClient()` contourne la RLS, la permission applicative y est obligatoire.
- **Supabase client** : utiliser `createClient` de `lib/supabase/` (`@supabase/ssr`). `createClientComponentClient` (auth-helpers) est déprécié dans ce projet.
- **Numérotation des documents** : par catégorie ; `{mission.numero_etude}` renvoie les deux derniers chiffres uniquement.
- **LiveConsent** (signature électronique) : intégration gatée par variable d'env ; ne pas activer sans validation.
- **Sécurité** : uploads Scaleway privés (jamais d'ACL public), pas de secrets en dur, PII toujours chiffrées.
- Réponses et UI en **français**.

## graphify

Ce projet a un graphe de connaissance graphify dans `graphify-out/`.

- Avant de répondre à une question d'architecture, lire `graphify-out/GRAPH_REPORT.md` (god nodes, communautés)
- Si `graphify-out/wiki/index.md` existe, naviguer par le wiki plutôt que lire les fichiers bruts
- Après modification de code dans la session, exécuter :
  `$(cat graphify-out/.graphify_python) -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"`
  (graphify est installé via pipx, pas le `python3` système ; le chemin de l'interpréteur est dans `graphify-out/.graphify_python`)
