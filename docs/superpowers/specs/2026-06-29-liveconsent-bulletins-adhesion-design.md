# LiveConsent — Bulletins d'adhésion & file de signature du bureau

**Date :** 2026-06-29
**Statut :** Design validé (architecture + défauts confirmés par l'utilisateur)

## 1. Contexte

Be Fast possède déjà une intégration LiveConsent **manuelle et fonctionnelle** (env-gatée, à activer avec les 3 clés API) :

- `lib/signature/liveconsent.ts` — client REST : auth (token caché ~50 min), `createSignatureRequest` (1 seul destinataire codé en dur), `getRequestStatus`, `abandonRequest`.
- `lib/actions/signature.ts` — server actions `listSignatureRequests`, `sendDocumentForSignature`, `refreshSignatureStatus`.
- `app/api/signature/callback/route.ts` — webhook de statut (GET, re-demande le statut consolidé à l'API plutôt que de faire confiance au paramètre).
- `supabase/migrations/037_signature_requests.sql` — table `signature_requests` (RLS : SELECT authentifié, écritures via service role).
- `app/(dashboard)/signatures/SignaturesClient.tsx` — formulaire d'envoi + liste de suivi.
- `lib/email/templates.ts::documentToSignEmail` + `lib/email/send.ts` (Resend, best-effort).

Cette base est conservée intégralement. On l'étend.

### État du modèle de données pertinent

- `personnes` : membres. Colonnes utiles — `prenom`, `nom`, `email`, `portable`, `promo`, `adresse`, `ville`, `code_postal`, `pole`, `etablissement`, `scolarite`, `date_naissance`, PII chiffrée (`nss_encrypted`, `iban_encrypted`, `adresse_encrypted`…), `account_status` ('pending_validation'|'validated'|'rejected'), `profil_type_id` → `profils_types`.
- `profils_types` : rôles avec permissions JSONB. Admin = slug `administrateur`.
- **Président / Trésorier** : aujourd'hui de **simples champs texte** dans `parametres` (`president_nom`, `president_genre`, `tresorier_nom`…), **non reliés à un compte utilisateur**.
- `documents_personnes` : justificatifs uploadés (Scaleway S3). Types : `carte_identite`, `carte_etudiante`, `carte_vitale`, `preuve_lydia`, `rib`. Colonne `status` ('pending'|'approved'|'rejected').
- `notifications` (migration 007) : table **admin-only**, **globale**, **sans colonne destinataire**, et **aucune UI cloche** n'existe.
- Cron Vercel : `vercel.json` contient déjà `/api/health` (tous les 4 jours).
- **Pas de bibliothèque PDF** installée (seulement `docxtemplater` + `pizzip`, qui produisent du .docx).

## 2. Objectifs

1. Transformer `/signatures` en **hub à 3 onglets** : Demandes libres · Bulletins d'adhésion · À signer (bureau).
2. **Bulletins d'adhésion (BA)** : envoi du BA pré-rempli aux membres, en automatique (profil + documents complets) **ou** manuel par ligne, avec suivi (jours depuis envoi), relances avant expiration, et archivage automatique à la signature.
3. **File du bureau** : la **présidente** signe les documents (contre-signature ordonnée) ; le **trésorier** est un signataire de **repli** quand elle ne peut pas.
4. **Notification membre** : bannière + badge in-app, en plus de l'email.

### Non-objectifs (hors scope v1)

- Centre de notifications complet (cloche/compteur global) — on se limite à la bannière + badge.
- Conversion DOCX→PDF (incompatible serverless Vercel) — le BA passe par un template PDF + `pdf-lib`.
- Refonte du système de permissions/pôles existant.
- Signature « interne » (tracé/clic) hors LiveConsent.

## 3. Décisions validées (défauts confirmés)

1. **Modèle de signature bureau** : co-signature **ordonnée** via LiveConsent (membre ordre 1 → présidente ordre 2). Le trésorier signe **en repli** uniquement.
2. **PDF du BA** : template PDF téléversé une fois + remplissage `pdf-lib`.
3. **Déclencheur BA** : liste des membres avec **toggle auto/manuel par ligne** + bouton manuel « Envoyer le BA ». En auto : déclenché quand **profil + documents complets**.
4. **Notification in-app** : bannière + badge.
5. **« Profil complet »** = `prenom`, `nom`, `portable`, `date_naissance`, `adresse`, `ville`, `code_postal`, `etablissement`, `scolarite` renseignés. *(NSS/IBAN exclus du déclencheur.)*
6. **« Documents complets »** = `carte_identite` + `carte_etudiante` téléversées (les 3 autres non bloquants).
7. **Relances** : validité 30 j ; relances à **J-7** et **J-2** avant expiration.
8. **Désignation présidente/trésorier** : 2 nouveaux sélecteurs dans Administration → Structure pour relier ces rôles à un **utilisateur Be Fast** (le champ texte existant `president_nom` reste pour les documents générés).

## 4. Architecture

### 4.1 Hub à onglets (`/signatures`)

| Onglet | Visibilité | Contenu |
|--------|-----------|---------|
| **Demandes libres** | permission `etudes` (inchangé) | Formulaire PDF + suivi actuels, déplacés dans un onglet. Option « ajouter la présidente en co-signataire ». |
| **Bulletins d'adhésion** | admin | Liste des membres : toggle auto/manuel, bouton « Envoyer le BA », statut, jours-depuis-envoi, archivage auto. |
| **À signer (bureau)** | présidente + trésorier (+ admin) | File des demandes où la présidente est signataire en attente. |

Le composant client devient un conteneur d'onglets ; chaque onglet est un sous-composant isolé. La sélection d'onglet est persistée dans l'URL (cohérent avec le pattern « persist filters in URL » déjà en place).

### 4.2 Découpage en phases

**Phase 1 — Fondations** (shippable seule, sans changement de comportement visible majeur)
- Migration d'extension de schéma (§5.1).
- Extension du client LiveConsent : multi-destinataires + multi-positions + « signer en ordre » (§5.2).
- Administration → Structure : sélecteurs présidente/trésorier (utilisateur). Helpers `getBureauUserIds()`.
- Refactor de la page en onglets ; l'existant devient « Demandes libres ».

**Phase 2 — Pipeline BA** (le cœur)
- Dépendance `pdf-lib`. Upload du template BA (admin). `lib/signature/ba-pdf.ts` (remplissage + aplatissement).
- Onglet « Bulletins d'adhésion » : liste membres, toggle, envoi manuel, suivi, archivage.
- Logique de déclenchement `lib/signature/ba.ts` (`isMemberComplete`, `sendBA`).
- Cron `/api/cron/ba` (envoi auto + relances + refresh/archivage).
- Notification membre : colonne `recipient_id` sur `notifications`, bannière dashboard + badge, email Be Fast.

**Phase 3 — File du bureau**
- Onglet « À signer » : demandes où la présidente est signataire en attente, bouton « Signer » (ouvre le lien LiveConsent si l'API l'expose, sinon suivi + rappel email).
- Action « Déléguer au trésorier » (repli).

## 5. Détails techniques

### 5.1 Migration `038_signature_ba.sql`

Idempotente. Extensions de `signature_requests` :

```sql
ALTER TABLE public.signature_requests
  ADD COLUMN IF NOT EXISTS category    TEXT NOT NULL DEFAULT 'libre'
    CHECK (category IN ('libre','ba')),
  ADD COLUMN IF NOT EXISTS personne_id UUID REFERENCES public.personnes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS signers     JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{role,email,order,status}]
  ADD COLUMN IF NOT EXISTS validity_days INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS expires_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminder_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reminder_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived    BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_signature_requests_category ON public.signature_requests (category);
CREATE INDEX IF NOT EXISTS idx_signature_requests_personne ON public.signature_requests (personne_id);
```

Préférences BA par membre (toggle auto) — colonne sur `personnes` :

```sql
ALTER TABLE public.personnes
  ADD COLUMN IF NOT EXISTS ba_auto BOOLEAN NOT NULL DEFAULT true;
```

Notifications par destinataire :

```sql
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS recipient_id UUID REFERENCES public.personnes(id) ON DELETE CASCADE;
-- + policy "users read/update own notifications" (USING recipient_id = auth.uid())
```

Réglages présidente/trésorier + template BA — stockés dans `parametres` (clés `president_user_id`, `tresorier_user_id`, `ba_template_path`, `ba_required_doc_types`, `ba_required_profile_fields`, `ba_reminder_days`). Valeurs par défaut = §3.

Toutes les écritures `signature_requests` / `notifications` restent **service-role uniquement** (server actions + cron + webhook). La table est ajoutée à `MIGRATIONS_A_APPLIQUER.sql` (workflow de migration manuel du projet).

### 5.2 Extension du client LiveConsent

`createSignatureRequest` accepte désormais :

```ts
interface CreateSignatureOpts {
  requestName: string
  message?: string
  pdfBase64: string
  filename: string
  recipients: Array<{ firstname; lastname; email; phone; order?: number }>
  signatures: Array<{ recipientEmail; page; x; y }>
  signInOrder?: boolean   // → request_sign_in_order: true
  callbackUrl?: string
  validityDays?: number
}
```

Le payload `recipients`/`signatures` devient un tableau ; `request_sign_in_order` est ajouté quand `signInOrder`. L'ancienne signature mono-destinataire est conservée via un wrapper de compat ou adaptée dans `lib/actions/signature.ts` (le formulaire « Demandes libres » passe un tableau à 1 élément). `getRequestStatus`/`abandonRequest` inchangés.

> ⚠️ **Points API à valider au 1er envoi réel** (cohérent avec l'intégration existante) :
> 1. Noms exacts des champs multi-destinataires / `request_sign_in_order` côté LiveConsent.
> 2. Mapping des codes de statut numériques (webhook) → libellés ('signed','completed','abandoned','expired').
> 3. Existence (ou non) d'un **lien de signature par destinataire** exploitable pour le bouton « Signer » in-app (Phase 3). Sinon : la file reste un suivi, la présidente signe via l'email LiveConsent.

### 5.3 Remplissage du BA (`lib/signature/ba-pdf.ts`)

- Dépendance **`pdf-lib`** (pur JS, OK sur Vercel/Fluid Compute).
- Template BA : PDF avec champs **AcroForm** nommés (`prenom`, `nom`, `date_naissance`, `adresse`, `ville`, `code_postal`, `promo`, `email`, `etablissement`, `scolarite`, `date_jour`). Téléversé via Administration, stocké dans Scaleway (`ba_template_path`).
- `fillBA(personne): Promise<Uint8Array>` : charge le template, déchiffre les champs nécessaires (adresse via le helper de déchiffrement existant), remplit, **aplatit** (`form.flatten()`), renvoie les octets → base64 pour LiveConsent.
- Positions de signature : champs/positions configurables (membre + présidente). Réutilise le mécanisme `signaturePosition`, étendu par signataire.

### 5.4 Déclenchement & envoi (`lib/signature/ba.ts`)

- `isMemberComplete(personne, documents): boolean` — vrai si tous les champs profil requis (§3.5) sont renseignés **et** les types de documents requis (§3.6) présents.
- `getBureauUserIds(): { presidentId, tresorierId }` — depuis `parametres`.
- `sendBA(personneId, { auto }): Result` —
  1. garde-fous : LiveConsent configuré, membre existe, pas déjà de BA non-archivé en cours ;
  2. `fillBA` → PDF base64 ;
  3. récupère la présidente (utilisateur désigné) → destinataire ordre 2 ;
  4. `createSignatureRequest` (signInOrder, membre ordre 1, présidente ordre 2, `validityDays=30`, callbackUrl) ;
  5. insert `signature_requests` (category 'ba', `personne_id`, `signers`, `expires_at = now()+30j`) via service role ;
  6. notification membre (bannière `notifications.recipient_id` + email Be Fast) ;
  7. `revalidatePath('/signatures')`.

### 5.5 Cron `/api/cron/ba`

- Protégé par `CRON_SECRET` (header `Authorization: Bearer`). Ajouté à `vercel.json` (`schedule: "0 7 * * *"`, quotidien).
- Étapes (idempotentes) :
  1. **Envoi auto** : membres `ba_auto=true`, sans BA non-archivé, `isMemberComplete` vrai → `sendBA({auto:true})`.
  2. **Relances** : BA non signés dont `expires_at` ∈ {J-7, J-2} et pas déjà relancés ce jour → email de relance + `reminder_count++`, `last_reminder_at`.
  3. **Refresh + archivage** : pour les BA en attente, `getRequestStatus` ; si signé/complété → `archived=true`, notification « BA signé » à l'admin.

### 5.6 Notification membre (bannière + badge)

- `notifications.recipient_id` + policy « lecture/maj de ses propres notifications ».
- Bannière sur le dashboard membre : « Vous avez un bulletin d'adhésion à signer » + CTA. Badge discret sur l'entrée concernée.
- Email Be Fast via un nouveau template `bulletinAdhesionEmail` (en plus de l'email LiveConsent et des relances). Tous les envois email restent best-effort.

### 5.7 File du bureau (Phase 3)

- Onglet « À signer » : `signature_requests` où la présidente figure dans `signers` avec `status` en attente (BA contre-signature ou demandes libres co-signées).
- Bouton « Signer » : ouvre le lien LiveConsent du destinataire **si** l'API l'expose (§5.2 point 3) ; sinon affiche « un email LiveConsent vous a été envoyé » + bouton « Renvoyer l'email ».
- Action « Déléguer au trésorier » : `abandonRequest` + recréation avec le trésorier en ordre 2 (ou réassignation si l'API le permet — à valider).

## 6. Sécurité & permissions

- Écritures `signature_requests` / `notifications` : **service role** uniquement (server actions, cron, webhook) — pattern existant conservé.
- Onglet « Bulletins d'adhésion » : admin. Onglet « À signer » : présidente/trésorier désignés + admin.
- Webhook callback : conserve la validation « requestId connu en base » + re-demande du statut consolidé authentifié (aucune confiance au paramètre).
- Cron : `CRON_SECRET` obligatoire.
- PII : `fillBA` déchiffre côté serveur uniquement ; le PDF rempli n'est jamais persisté en clair (envoyé à LiveConsent puis jeté).

## 7. Tests

Harness Vitest déjà présent.

- `isMemberComplete` : cas complet / champ manquant / document manquant.
- `fillBA` : remplit les champs attendus, aplatit (snapshot des noms de champs).
- Construction du payload LiveConsent multi-signataires + `signInOrder` (sans appel réseau réel — mock `fetch`).
- Logique cron : sélection des membres éligibles, fenêtres de relance J-7/J-2 (dates mockées), idempotence (pas de double envoi).
- Webhook : statut inconnu ignoré, statut connu → mise à jour + archivage.

## 8. Livrables par phase

- **P1** : `038_signature_ba.sql` (+ MIGRATIONS_A_APPLIQUER.sql), client LiveConsent multi-signataires, sélecteurs bureau (Administration), page en onglets.
- **P2** : `pdf-lib`, upload template BA, `ba-pdf.ts`, `ba.ts`, onglet BA admin, cron `/api/cron/ba` (+ vercel.json), notifications membre (colonne + bannière + email).
- **P3** : onglet « À signer », bouton signer/relance, délégation trésorier.

## 9. Points ouverts (à lever au 1er envoi réel)

- §5.2 points 1–3 (champs multi-destinataires, codes de statut, lien de signature par destinataire).
- Confirmer le format/champs AcroForm du template BA fourni par l'asso.
- Le bouton « Signer » in-app (P3) dépend du point 3 ; repli = email LiveConsent.
