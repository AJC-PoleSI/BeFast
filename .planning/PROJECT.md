# BeFast — Odensia Junior Conseil

## What This Is

BeFast est l'application web de gestion interne d'Odensia Junior Conseil, la Junior-Entreprise d'Audencia Business School. Elle centralise la gestion des membres, des missions, des études (projets clients), de la prospection commerciale, des documents administratifs et de l'administration de la structure. L'application est réservée aux membres AGC, intervenants et administrateurs — chaque rôle voyant uniquement ce qui lui est pertinent.

## Core Value

Un membre ou intervenant doit pouvoir accéder à ses missions, déposer ses documents et candidater à des projets en moins de 3 clics — tout le reste sert l'administration interne.

## Requirements

### Validated

(Aucun pour l'instant — à valider après livraison)

### Active

- [ ] Authentification par email/mot de passe (Supabase Auth) avec auto-inscription et assignation de rôle par l'admin
- [ ] Système de rôles et permissions par page (membre_agc, ancien_membre_agc, intervenant, administrateur)
- [ ] Profil utilisateur éditable avec données sensibles chiffrées (NSS, IBAN via AES-256-GCM)
- [ ] Upload et gestion de documents personnels (carte identité, carte étudiante, carte vitale, preuve Lydia, RIB) via Supabase Storage privé
- [ ] Gestion des missions : création, liste filtrée, détail, candidature (motivation + classe + langues)
- [ ] Gestion des études : liste, création, détail avec missions associées et échéancier Gantt drag-and-drop
- [ ] Pipeline de prospection Kanban avec colonnes par statut et cartes glissables
- [ ] Tableau de bord statistiques avec KPIs et graphiques (recharts)
- [ ] Administration : gestion des droits/profils, paramètres de la structure, templates de documents, gestion des membres
- [ ] Import/Export Excel des membres
- [ ] Interface 100% en français
- [ ] Design : bleu marine #0D1B2A + or #C9A84C, Playfair Display + DM Sans
- [ ] Compatibilité Docker (output standalone Next.js) pour migration future Oracle Cloud

### Out of Scope

- Paiement en ligne — la rétribution des intervenants se gère hors application (Lydia/virement)
- Email transactionnel automatique — pas de notifications automatiques par email dans la v1
- Application mobile native — web responsive uniquement
- Internationalisation — interface uniquement en français

## Context

- **Structure** : Junior-Entreprise étudiante, environ 50-200 membres et intervenants selon l'année académique
- **Utilisateurs** : membres du bureau (AGC), intervenants ponctuels (étudiants qui réalisent les missions), anciens membres
- **Création de comptes** : auto-inscription par l'utilisateur, puis l'admin assigne le rôle approprié (par défaut : aucun accès jusqu'à assignation)
- **Données sensibles** : NSS et IBAN chiffrés avec AES-256-GCM côté serveur, clé via `ENCRYPTION_KEY` en variable d'environnement uniquement
- **Supabase** : RLS activé sur toutes les tables, `service_role_key` uniquement côté serveur (API Routes), bucket Storage privé avec URLs signées
- **Hébergement actuel** : Vercel + Supabase cloud. Migration future envisagée vers Oracle Cloud Free Tier (Docker standalone)

## Constraints

- **Stack** : Next.js 14 App Router + TypeScript + Tailwind CSS + shadcn/ui — pas de déviation
- **Backend** : Supabase uniquement (PostgreSQL + Auth + Storage) — pas d'autre base de données
- **Sécurité** : Données sensibles jamais en clair en base. Mots de passe gérés exclusivement par Supabase Auth (bcrypt interne)
- **Langue UI** : 100% français — labels, messages d'erreur, textes
- **Compatibilité** : `output: 'standalone'` dans next.config.js pour Docker

## Key Decisions

| Décision | Rationale | Outcome |
|----------|-----------|---------|
| Auto-inscription + assignation admin | Simplifie l'onboarding initial sans bloquer sur la création de comptes | — Pending |
| Chiffrement AES-256-GCM côté applicatif + pgcrypto en base | Double couche : clé applicative + stockage BYTEA chiffré | — Pending |
| RLS Supabase comme couche de sécurité principale | Garantit l'isolation des données même en cas de fuite du client | — Pending |
| shadcn/ui + Tailwind pour le design system | Composants accessibles, personnalisables, maintenables | — Pending |
| @dnd-kit pour Gantt et Kanban | Meilleure performance et accessibilité que react-beautiful-dnd | — Pending |

## Evolution

Ce document évolue à chaque transition de phase et milestone.

**Après chaque phase :**
1. Requirements invalidés → Out of Scope (avec raison)
2. Requirements validés → Validated (avec référence phase)
3. Nouveaux requirements → Active
4. Décisions prises → Key Decisions

---
*Last updated: 2026-04-08 après initialisation*
