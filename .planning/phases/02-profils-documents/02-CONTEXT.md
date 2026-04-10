---
phase: "02"
phase_name: "Profils & Documents"
created: "2026-04-10"
status: complete
---

# Phase 02 Context — Profils & Documents

## Domain

Chaque utilisateur peut gérer son profil complet (données de base + données sensibles chiffrées) et déposer ses 5 types de documents personnels via Supabase Storage privé. L'admin peut consulter et modifier le profil de n'importe quel membre.

## Decisions

### Layout de la page profil
- **Onglets Infos / Documents** — deux onglets distincts sur la page profil
- Onglet "Informations" : données de base (prénom, nom, portable, promo, adresse, ville, pôle) + données sensibles (NSS, IBAN masqués)
- Onglet "Documents" : les 5 types de documents avec statut uploadé/manquant

### Avatar
- **Upload photo** — l'utilisateur peut uploader une photo de profil
- Stocker dans un bucket Supabase Storage dédié (`avatars`) distinct de `documents-personnes`
- Fallback : initiales auto (prénom[0] + nom[0]) si pas de photo

### Données sensibles (NSS / IBAN)
- Affichage masqué `****` avec bouton "Modifier"
- Modification via modal de confirmation (pas inline) → appel API Route serveur → chiffrement AES-256-GCM via `lib/encryption.ts` existant
- Feedback visuel "Enregistré" après succès

### Documents
- Upload via bouton classique (pas drag-and-drop) — 5 slots fixes, un par type
- Aperçu inline si image, lien de téléchargement si PDF — URL signée 1h (DOCS-05)
- Bouton "Ajouter filigrane" → ouvre https://filigrane.beta.gouv.fr dans nouvel onglet (DOCS-06)
- Taille max : 10 Mo par fichier

### Vue admin
- L'admin accède aux profils membres via une liste → détail (Phase 6 pour la liste complète)
- En Phase 2 : l'admin peut accéder au profil d'un membre via URL directe `/dashboard/profil/[userId]`
- L'admin peut modifier les données de base mais PAS les données sensibles (NSS/IBAN) d'un autre utilisateur — sécurité

## Canonical Refs

- `.planning/REQUIREMENTS.md` — PROF-01 à PROF-06, DOCS-01 à DOCS-06, SEC-01 à SEC-03
- `.planning/phases/02-profils-documents/02-CONTEXT.md` (ce fichier)
- `lib/encryption.ts` — chiffrement AES-256-GCM existant à réutiliser
- `lib/supabase/server.ts`, `lib/supabase/admin.ts` — clients Supabase SSR existants
- `components/ui/` — Card, Form, Input, Button, Avatar, Skeleton, Badge disponibles

## Assets Réutilisables (Phase 1)

- `lib/encryption.ts` — encrypt/decrypt AES-256-GCM, prêt à l'emploi
- `lib/supabase/server.ts` — client serveur SSR
- `lib/supabase/admin.ts` — client admin (service_role_key) pour Storage privé
- `hooks/useUser.ts` — hook user avec profil et rôle
- `types/database.types.ts` — types à étendre pour profils et documents
- `components/ui/form.tsx`, `input.tsx`, `button.tsx` — formulaires
- `components/ui/avatar.tsx` — composant Avatar shadcn/ui
- `components/ui/skeleton.tsx` — états de chargement

## Deferred Ideas

Aucun.
