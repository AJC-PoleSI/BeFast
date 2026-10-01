# Audit de sécurité et de fonctionnement — 2 octobre 2026

Périmètre : l'arbre de travail complet (Phase 2 des permissions non déployée + PII), toutes les routes API, toutes les server actions, la couche auth/stockage/documents, et **les policies RLS telles qu'elles sont réellement en production** (`pg_policies` relu en direct, pas seulement les fichiers de migration). Cinq revues indépendantes, puis vérification de chaque point avant correction.

État avant / après :

| Vérification | Avant | Après |
|---|---|---|
| `tsc --noEmit` | OK | OK |
| `vitest` | 361 tests | 376 tests (26 fichiers) |
| `next build` | OK | OK |
| `npm audit` (prod) | 9 avis | 7 avis, tous sans correctif non cassant (voir §5) |

## 1. Failles corrigées dans le code (déployées au prochain push)

### Hautes

**A. Contexte des documents exposé comme server action** — `buildTemplateContext` vivait dans `lib/actions/documents.ts` (module `"use server"`), donc appelable par tout compte authentifié. Son seul garde (`etudes` ou `missions`) laissait passer les 600 intervenants ; elle lisait en client admin la ligne `personnes` de n'importe quel id et renvoyait adresse, date de naissance, téléphone, email déchiffrés, et le NSS sur simple option `includeNss`. Le scope `personne` renvoyait la ligne brute (chiffrés, sel, jetons).
Correctif : déplacée dans `lib/documents/context.ts` (`server-only`, jamais une action), scope `personne` supprimé, et un `intervenant_id` explicite doit être rattaché à la mission ou à l'étude (`estIntervenantDeLaMission` / `estIntervenantDeLEtude`, même source de vérité que le sélecteur de l'UI). Verrouillé par `lib/documents/context.test.ts`.

**B. `POST /api/documents/generate`** — aucun contrôle sur le scope `personne`, et `intervenant_id` jamais vérifié : un membre AJC générait un RDM avec les coordonnées déchiffrées de n'importe quel membre. Scope `personne` refusé (400), intervenant rattaché ou 403.

### Moyennes

**C. Affectation de masse** — `createEtude`, `updateEtude`, `createMission`, `createClient_`, `updateClient_` recopiaient l'objet reçu du client. Un suiveur pouvait se mettre `created_by` (puis supprimer l'étude), publier sans `publier_etudes`, affecter un `intervenant_id`. Listes blanches de colonnes.

**D. Lectures en client admin sans permission** — `getMembers`, `getClients` (annuaire et contacts clients), `getMargesRecommandees`, `getPrixNetMoyenParPhase`, `getPhasesStats`, `getSuggestedPhases` : ouverts à tout compte, candidats non validés compris. Gardés par les clés des écrans qui s'en servent.

**E. `getEtudes` / `getEtude` / `getEtudesRaw`** — auth seule, alors que la RLS laisse lire toute étude publiée (budget, marge, client) à n'importe quel compte. Clé `etudes` exigée.

**F. Échéancier** — `upsertEcheancierBloc` / `deleteEcheancierBloc` : tout membre interne modifiait les lignes (prix, JEH) de toutes les études. Même règle que l'étude (`canEditEtude`), étude de rattachement relue en base.

**G. `signProposal`** — créait étude, missions et factures en client admin sans clé `prospection`. Gardée.

**H. `POST /api/generate-ppt`** — auth seule, lisait téléphone et email de n'importe quel `cdp_id`. Clé `prospection`.

**I. Lien « définir mon mot de passe »** — `/api/password-reset/verify` générait la session recovery sur `personnes.email`, colonne que son propriétaire pouvait modifier via PostgREST : avec un jeton valide, prise de contrôle d'un autre compte (dont un administrateur). L'adresse vient désormais du compte Auth, et la colonne est protégée par trigger (migration 078).

### Basses

- `getAllMembers` renvoyait `select *` (chiffrés, sel, jetons, PII en clair historiques) : colonnes explicites.
- `getPostesCatalog` : aucune authentification. Clé `membres`.
- `refreshSignatureStatus` : même périmètre que la liste des signatures.
- Cache du profil (5 min) jamais invalidé lors d'une rétrogradation (changement de rôle, de statut, de permissions d'un poste) : invalidation ajoutée.
- `getDecryptedProfile` déchiffrait NSS/IBAN avec un seul des deux formats (échouait sur tous les NSS actuels) et renvoyait la ligne brute : `lireSecret`, jetons retirés.
- `saveTagsDictionary` : garde `gerer_parametres` mais écriture en client utilisateur refusée par la RLS 069. Client admin.
- `GET /api/admin/parametres` lisait en client utilisateur (la policy de lecture devient restreinte).
- Migration 058 : `handle_new_user` recréée sans `SET search_path` (un replay après 076 l'aurait perdu). Corrigé dans le fichier.

## 2. Failles corrigées en base — migration `078_audit_securite_rls_2026_10.sql` (À APPLIQUER)

Le mode automatique de la session a refusé l'application en production. Le fichier `MIGRATIONS_A_APPLIQUER_2026-10.sql` contient **069 puis 078**, à coller dans le SQL Editor. Les deux sont idempotentes.

Constats faits sur les policies **réellement en prod** :

| Table | Problème | Gravité |
|---|---|---|
| `budget_etude` | `auth all budget_etude` : `USING (true) WITH CHECK (true)` pour tout compte authentifié (migration 029, jamais retirée ; déjà signalé critique dans `SECURITY_AUDIT.md` du 10/06) | Haute |
| `mission_collaborations` | `chef_projet manage` (025) : tout compte s'insère comme collaborateur de n'importe quelle mission et devient « intervenant » pour les helpers RLS (documents générés dont les BV avec NSS, notes de frais, étude) | Haute |
| `candidatures` | insert sans contrainte de `statut` : un intervenant s'insère une candidature « acceptee » (= affecté, payé) | Haute |
| `personnes` | `email`, `email_verified`, jetons de vérification, sel… modifiables par le propriétaire (chaîne de prise de compte avec I) | Haute |
| `signature_requests` | `USING (true)` (037) : noms, emails, identifiants LiveConsent de toutes les demandes | Moyenne |
| `notes_de_frais` | le déposant pouvait se passer en `valide` / `paye` | Moyenne |
| `parametres` | RIB, IBAN, n° URSSAF, taux lisibles par tout compte | Basse |
| `marges_recommandees` | lisible par tout compte | Basse |
| `support_tickets` | `utilisateur_id` libre : demande de suppression de compte au nom d'un autre | Basse |
| `custom_fields` | lisible sans connexion (policy `TO public`) | Basse |

La 078 corrige tout cela et ajoute, en défense en profondeur, un trigger sur `etudes` / `missions` (`published`, `created_by`, `intervenant_id` ne s'écrivent qu'avec la permission), une policy d'échéancier alignée sur la 070, et un index unique sur `lower(email)` (aucun doublon constaté).

## 3. Régressions fonctionnelles de la Phase 2 corrigées

- `/administration` refusait le Pôle RH, le Responsable RH et le Secrétaire général (page d'entrée = Paramètres) : redirection vers la première section ouverte.
- Un intervenant avait un lien « Étude … » vers une page qui le refuse : lien masqué sans la clé `etudes`.
- Boutons Valider / Rejeter / Supprimer affichés à tout porteur de `membres` alors que l'API exige `valider_comptes` (que **personne** ne porte aujourd'hui) ou administrateur : boutons conditionnés.
- « Déléguer au trésorier » affiché à la présidente alors que l'action est admin-only : bouton admin-only.
- Pilotage des prix (trésorier) et textes par défaut des propositions (secrétaire général) : formulaire affiché, enregistrement refusé. `saveParametres` accepte ces deux sous-ensembles de clés avec les clés de leurs écrans.
- Onglet Données affiché au secrétaire général avec des 403 à chaque chargement : réservé aux administrateurs (page et lien).
- Fiche d'un membre : layout aligné sur la page et l'API (`voir_nss`, `voir_rib` ajoutés).
- `createMission` / suiveurs : pas de régression, `membre_ajc` porte `nouvelle_mission` et l'action n'a aucun appelant (la page étude insère directement).

## 4. Points à trancher par Felix (non modifiés)

1. **Dépôt GitHub `AJC-PoleSI/BeFast` toujours public**, avec la clé `service_role` dans l'historique (voir mémoire) : passer en privé et **faire tourner la clé**. C'est le point le plus urgent.
2. **Prospection** fermée aux `membre_ajc` sans poste par la Phase 2 (seuls Présidente et Secrétaire général portent `prospection`). Les propositions existantes ont été créées par des administrateurs ; si des chefs de projet rédigent des propales, donner `prospection` à un pôle.
3. **`valider_comptes`** : aucun poste ne la porte ; le Pôle RH ne peut donc pas valider les comptes (il voit la liste sans les boutons). À accorder à `pole_rh` / `responsable_rh` dans Administration ▸ Droits si c'est voulu.
4. Comptes non validés : la restriction « profil + documents » s'applique désormais aussi aux API et actions, plus seulement aux liens. Effectifs en base au 02/10 :

   | Rôle | Statut | Comptes |
   |---|---|---|
   | candidat | en attente de validation | 139 |
   | intervenant | en attente de validation | 8 |
   | intervenant | rejeté | 26 |
   | intervenant | validé | 598 |
   | membre_ajc | validé | 40 |
   | administrateur | validé | 3 |
5. `etudes read` laisse toute étude publiée lisible en direct via PostgREST (budget, marge) par un intervenant : corrigé côté application, résiduel côté base (il faudrait une vue réduite pour l'embed `missions → etudes`).
6. `LIVECONSENT_WEBHOOK_SECRET` à définir en prod pour signer le webhook.
7. Protection « mots de passe compromis » de Supabase Auth : désactivée (réglage du dashboard).
8. Les 10 avertissements « SECURITY DEFINER exécutable par authenticated » du Security Advisor sont voulus (helpers RLS, cf. 076).

## 5. Dépendances

`npm audit fix` (non cassant) a mis à jour `ws` et `postcss-selector-parser`. Restent : `next` 14 (DoS, correctif = Next 16, migration majeure à planifier), `postcss` embarqué par Next (build uniquement), `uuid` via `exceljs` (correctif = downgrade cassant), `vitest`/`vite`/`eslint-config-next` (outillage de dev).

## 6. Procédure de mise en production

1. Appliquer `MIGRATIONS_A_APPLIQUER_2026-10.sql` (069 + 078) dans le SQL Editor.
2. `git push origin main` (deux commits : Phase 2 + audit).
3. Vérifier le déploiement Vercel, puis lancer la reprise des PII : `POST /api/admin/pii/reprise` en `chiffrer` (simulation puis `ecrire: true`), vérifier, puis `vider`.
4. Facultatif : `npm run lint` n'a pas de configuration ESLint (prompt interactif) ; à initialiser.
