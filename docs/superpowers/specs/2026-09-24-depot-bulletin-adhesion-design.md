# Dépôt du bulletin d'adhésion signé — design

**Date** : 24/09/2026 · **Statut** : validé par Felix

## Besoin

Le bulletin d'adhésion (BA) est envoyé par mail au candidat. Le candidat doit pouvoir
renvoyer le BA signé dans Be Fast, comme ses autres justificatifs, et le bureau doit
pouvoir le consulter et le valider. Les dépôts doivent fonctionner pour les PDF et
pour les photos (JPG, PNG, WebP, HEIC/HEIF).

Constat en production (24/09/2026) : aucune demande de signature électronique
LiveConsent n'a jamais été créée et `ba_auto_global = false`. Le circuit électronique
n'est donc pas utilisé : le dépôt du BA signé est le vrai chemin.

## Décisions

| Question | Décision |
|---|---|
| Qui dépose ? | La personne elle-même, depuis « Mes documents ». L'admin consulte et valide. |
| Comment le BA est-il obtenu ? | Par mail, en amont. Pas de bouton de téléchargement du BA pré-rempli. |
| Pour qui ? | Tout le monde (candidats et membres). |
| Approche | Nouveau type `bulletin_adhesion` dans le circuit existant `documents_personnes`. |

Approches écartées : un espace BA séparé (table et stockage dédiés, qui dupliquent
tout le mécanisme) ; un rattachement au circuit LiveConsent (`signature_requests`),
jamais utilisé en production.

## Conception

### Base de données

Migration `073_document_bulletin_adhesion.sql` : elle recrée la contrainte
`documents_personnes_type_check` avec `bulletin_adhesion` en plus des six types
actuels. Elle est idempotente (`DROP CONSTRAINT IF EXISTS`) et doit être appliquée à
la main **avant** le déploiement du code.

### Code

- `app/(dashboard)/dashboard/profil/_lib/schemas.ts` : `bulletin_adhesion` ajouté en
  fin de `VALID_DOC_TYPES`, libellé « Bulletin d'adhésion signé » dans
  `DOC_TYPE_LABELS`, entrée dans `DOC_TYPE_ICONS`.
- `types/database.types.ts` : `DocumentType` étendu.
- `DocumentsGrid.tsx` : icône `FileSignature`. Le texte d'aide « Bulletin
  d'adhésion » devient : il vous est envoyé par mail, renvoyez-le signé dans la case
  « Bulletin d'adhésion signé ».
- Tout le reste suit sans modification, car tout lit `VALID_DOC_TYPES` et
  `DOC_TYPE_LABELS` : upload direct Scaleway, repli par la route, validation admin,
  ZIP « Tout télécharger », push vers RH Manager, suppression de compte.

### Non-régression du circuit BA

`BA_REQUIRED_DOC_TYPES` (pièces nécessaires pour **générer** le BA) ne change pas.
Le BA signé n'y figure pas, sinon le BA ne serait jamais envoyé : il part après la
validation des autres pièces. Un test le verrouille.

### Gestion d'erreur : migration non appliquée

Le 21/09, un décalage entre le code et la contrainte CHECK a fait échouer tous les
dépôts de carte d'identité avec une erreur Postgres brute. Désormais, si
l'enregistrement échoue sur la contrainte (code `23514`), les deux chemins de
`POST /api/profil/documents` :

- suppriment l'objet orphelin sur Scaleway ;
- journalisent la cause (« migration 073 non appliquée ? ») ;
- renvoient une 503 avec un message lisible (« Ce type de document n'est pas encore
  disponible. Réessayez plus tard. ») au lieu de « Erreur DB: … ».

## Vérification

1. **Tests unitaires** (vitest, nouveau fichier `_lib/schemas.test.ts`) :
   - `isAcceptedFileType` : accepte PDF, JPG, PNG, WebP, HEIC et HEIF, par type MIME
     comme par extension seule. Accepte les extensions en majuscules. Refuse
     `.docx`, `.txt`, `.exe`, `.zip` et les fichiers sans extension ni type reconnu.
   - `resolveMimeType` : le type est déduit de l'extension quand le navigateur donne
     `""` ou `application/octet-stream`.
   - `fileExtension` : extension normalisée (`.PDF` → `pdf`, `scan` + PDF → `pdf`,
     type inconnu → `bin`).
   - `bulletin_adhesion` figure dans `VALID_DOC_TYPES` et a un libellé.
   - `BA_REQUIRED_DOC_TYPES` ne contient pas `bulletin_adhesion`.
2. **Test réel** (local, qui pointe sur la base et le bucket de production) : avec un
   compte de test sur lequel Felix se connecte lui-même dans l'aperçu, et après
   application de la migration 073 :
   - dépôt dans la case BA d'un PDF, d'un JPG, d'un PNG, d'un HEIC et d'un PDF de
     plus de 4 Mo (chemin d'upload direct) ;
   - consultation, téléchargement, remplacement d'un PDF par une photo (l'ancien
     objet doit disparaître), suppression ;
   - refus d'un `.docx` ;
   - validation côté admin.

   Les fichiers de test sont supprimés à la fin.

## Hors périmètre

- Si l'envoi électronique automatique des BA est activé un jour, une personne qui a
  déjà déposé un BA signé en recevrait quand même un par LiveConsent. Le cron
  `/api/cron/ba` ne regarde pas `documents_personnes`.
- Aucun bouton de téléchargement du BA pré-rempli.
