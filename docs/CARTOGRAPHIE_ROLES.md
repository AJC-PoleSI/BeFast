# Cartographie des rôles, postes et permissions — Be Fast

_Relevé du 2026-09-12. Source de vérité exécutable : [`lib/auth/access-map.ts`](../lib/auth/access-map.ts)
(carte des surfaces protégées) et [`lib/auth/permissions.ts`](../lib/auth/permissions.ts)
(résolution des droits). Les deux sont verrouillées par [`lib/auth/access-map.test.ts`](../lib/auth/access-map.test.ts)._

## 1. Le modèle

Une personne porte **un rôle de base** (`personnes.profil_type_id`) et **zéro ou plusieurs postes**
bureau/pôles (`personne_postes`). Les permissions effectives sont l'**union clé par clé** de toutes
ces sources. L'administrateur passe partout ; un compte non validé est ramené à son profil et à ses
documents.

```mermaid
flowchart TD
    A[Requête] --> B{Authentifié ?}
    B -- non --> L[/login]
    B -- oui --> C{account_status = deleted ?}
    C -- oui --> L2[/login?compte=supprime]
    C -- non --> D{rôle = administrateur ?}
    D -- oui --> OK[Accès accordé]
    D -- non --> E{account_status = validated ?}
    E -- non --> R[Permissions réduites à<br/>profil + documents]
    E -- oui --> F[Permissions effectives =<br/>rôle de base ∪ postes]
    R --> G
    F --> G{La surface exige-t-elle<br/>une clé détenue ?}
    G -- non --> KO[Accès refusé]
    G -- oui --> H{RLS Postgres<br/>has_permission uid, clé}
    H -- refus --> KO
    H -- ok --> OK
```

Quatre couches appliquent la même décision :

| Couche | Fichier | Effet d'un refus |
|---|---|---|
| Page | `layout.tsx` + `lib/auth/page-guards.ts` | le segment n'est **pas rendu** (aucune donnée chargée) |
| API | `lib/auth/api-guards.ts` | `401` / `403` |
| Server action | `lib/auth/action-guards.ts` | `{ error: "…" }` |
| RLS Postgres | `public.has_permission(uuid, text)` | erreur SQL / 0 ligne |

## 2. Les profils en base

### Rôles de base (un seul par personne)

| Rôle | Permissions |
|---|---|
| **Administrateur** | toutes (contournement par slug) |
| **Membre AJC** | dashboard, profil, missions, etudes, documents, statistiques, nouvelle_mission |
| **Intervenant** _(défaut)_ | dashboard, profil, missions, documents |
| **Candidat** | profil, documents |

### Postes bureau (cumulables)

| Poste | Permissions |
|---|---|
| **Présidente** | administration, membres, parametres_structure, voir_factures, signer_documents, signer_ba, prospection, statistiques, etudes, missions, documents, dashboard, profil, nouvelle_mission |
| **Trésorier·ère** | voir_factures, voir_rib, signer_documents, signer_ba |
| **Secrétaire Général** | administration, prospection, statistiques, etudes, missions, documents, dashboard, profil, nouvelle_mission |
| **Vice-Présidente** | _aucune_ |

### Postes pôles (cumulables)

| Poste | Permissions |
|---|---|
| **Pôle Ressources Humaines** | membres, voir_documents_membres, voir_nss, selectionner_candidats, assigner_intervenants |
| **Responsable RH** | idem + valider_comptes, changer_roles, signer_ba, etudes, missions, documents, dashboard, profil |
| **Pôle Trésorerie** | voir_factures, voir_rib, membres, parametres_structure, publier_etudes, publier_missions, etudes, missions, documents, statistiques, dashboard, profil, nouvelle_mission |
| **Pôle Systèmes d'Information** | modifier_etudes, publier_etudes, publier_missions |
| **Pôle Marketing** | publier_etudes, publier_missions |
| **Pôle Audit Qualité** | _aucune_ |
| **Pôle Développement Commercial** | _aucune_ |

## 3. Catalogue des permissions et point d'application

| Clé | Ce qu'elle ouvre | Où elle est appliquée |
|---|---|---|
| `dashboard` | page d'accueil | page (sinon redirection vers le profil) |
| `profil` | son propre profil | page |
| `missions` | catalogue et fiches missions | page |
| `documents` | ses propres justificatifs | page |
| `etudes` | études, et espace signatures | page + action signature |
| `prospection` | prospection, propositions | page + 6 server actions |
| `statistiques` | statistiques financières | page + `getStats` |
| `administration` | espace admin, explorateur/exports, modèles | page + API + actions |
| `membres` | liste et fiches membres, rôles | page + `getAllMembers` / `getAllRoles` |
| `nouvelle_mission` | créer une étude / une mission | `createEtude`, `createMission` |
| `voir_documents_membres` | justificatifs des autres membres | 4 routes API |
| `voir_nss` | NSS déchiffré d'un membre | `getDecryptedProfile` (champ par champ) |
| `voir_rib` | IBAN déchiffré d'un membre | `getDecryptedProfile` (champ par champ) |
| `selectionner_candidats` | accepter/refuser une candidature | action + RLS `candidatures` |
| `assigner_intervenants` | idem (voie RH) + affectation directe d'un intervenant sans candidature | `repondreCandidature`, `affecterIntervenant` |
| `modifier_etudes` | modifier/supprimer toute étude | `canEditEtude` + RLS `etudes`/`missions` |
| `publier_etudes` | publier une étude | `toggleEtudePublished` |
| `publier_missions` | publier une mission | `toggleMissionPublished` + RLS |
| `parametres_structure` | paramètres globaux, pôles | page + API + 4 actions + RLS `parametres` |
| `gerer_parametres` | modèles, balises, champs, phases | API + 4 actions + RLS `document_templates` |
| `voir_factures` | trésorerie complète | page + 5 routes API + 11 actions + RLS |
| `valider_bv` | bulletins de versement seuls | 4 actions trésorerie |
| `valider_comptes` | valider/refuser une inscription | `PATCH /api/admin/personnes/[id]` |
| `changer_roles` | changer le rôle de base d'un membre (Intervenant → Membre AJC…) ; jamais vers/depuis Administrateur ni son propre rôle | `updateMemberRole` (`canChangeMemberRole`) |
| `signer_documents` | file de signature du bureau | `getSignaturesAccess`, `listBureauQueue` |
| `signer_ba` | signature des bulletins d'adhésion | idem + sélection du signataire |

## 4. Règles à respecter en développement

1. **Toute nouvelle clé** doit apparaître dans `ALL_PERMISSION_KEYS`, dans `PERM_LABELS`
   (écran Droits) **et** ouvrir au moins une surface déclarée dans `access-map.ts` —
   les tests échouent sinon (clé morte).
2. **Toute nouvelle page** protégée se garde par un `layout.tsx` appelant `checkPageAccess`,
   jamais par un simple masquage de lien dans la sidebar.
3. **Toute server action** qui écrit passe par `requireActionPermission`, et toute route API
   par `requireApiPermission` / `requireApiAnyPermission`.
4. Une action qui utilise `createAdminClient()` **contourne la RLS** : la permission
   applicative est alors le seul contrôle, elle est obligatoire.
5. Une entrée de sidebar doit porter les mêmes clés que le garde de sa page cible
   (vérifié par les tests).

## 5. Migration associée

`supabase/migrations/069_rls_parametres_et_templates_par_permission.sql` aligne la RLS des tables
`parametres` et `document_templates` sur les permissions applicatives. **À appliquer manuellement**
dans le SQL Editor Supabase (les migrations ne sont pas jouées automatiquement sur ce projet).
