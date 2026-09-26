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
| Comment le BA est-il obtenu ? | ~~Par mail, en amont.~~ Révisé le 26/09 : téléchargé pré-rempli depuis la case BA (voir la dernière section). |
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
- ~~Aucun bouton de téléchargement du BA pré-rempli.~~ Révisé le 26/09.

## Ajout du 24/09 : modèle de BA téléchargeable (remplacé le 26/09, jamais livré)

Demande de Felix : pouvoir déposer à l'avance un modèle de BA dans les templates
de Be Fast, que chacun télécharge depuis sa case BA. Felix déposera le fichier
lui-même.

- **Nouvel emplacement de template** `bulletin_adhesion_vierge`, « Bulletin
  d'adhésion à télécharger », dans Administration → Documents, section
  « Adhésion / Membre ». Format `pdf_libre` : un PDF quelconque, sans champ
  AcroForm exigé. Il ne remplace pas l'emplacement `bulletin_adhesion` existant
  (PDF à champs pour LiveConsent), qui est renommé « Bulletin d'adhésion
  (signature électronique) » pour lever l'ambiguïté.
- **Route** `GET /api/profil/documents/ba-template`, gardée par la permission
  `documents` (celle de « Mes documents », que candidats et membres possèdent).
  La catégorie est fixée côté serveur : le client ne choisit jamais le modèle.
  - Sans paramètre, elle renvoie `{ available, fileName }`.
  - Avec `?download=1`, elle renvoie une URL signée de 60 s (bucket Supabase
    `templates`, téléchargement forcé), ou une 404 lisible si aucun modèle n'est
    déposé.

  La route est déclarée dans `lib/auth/access-map.ts`.
- **Case BA** de « Mes documents » : un lien « Télécharger le modèle » apparaît
  sous le libellé quand un modèle est disponible (vue personnelle uniquement,
  pas en vue admin). Le texte d'aide mentionne le modèle.

## Révision du 26/09 : BA pré-rempli, téléchargeable sans attendre la validation

Demande de Felix : le texte « il vous sera envoyé automatiquement une fois tous
vos documents soumis et validés par la RH (délai de 24 à 48h) » ne correspond
plus au circuit. Chacun doit pouvoir télécharger son BA directement, **même si
son compte n'est pas validé**, et le BA doit se compléter tout seul avec les
informations du profil.

- **Plus de modèle vierge** : l'emplacement `bulletin_adhesion_vierge` et la
  route `ba-template` du 24/09 (jamais livrés) sont supprimés. Un seul modèle,
  la catégorie `bulletin_adhesion` (PDF à champs AcroForm), sert au
  téléchargement et, si un jour il est activé, à LiveConsent.
- **Route** `GET /api/profil/documents/bulletin-adhesion`, garde
  `requireApiPermission("documents")`, clé que `resolveEffectivePermissions`
  laisse aux comptes non validés. L'identifiant vient de la session : chacun
  n'obtient que son propre BA. Le profil est relu à chaque appel (pas le cache
  de 5 min) et seules les colonnes utiles sont lues (ni NSS ni IBAN).
  - sans paramètre : `{ available, missing }`, `missing` = libellés des infos
    du profil absentes (téléphone, promo, adresse…) ;
  - `?download=1` : le PDF, `Cache-Control: private, no-store`, nommé
    `Bulletin_adhesion_Nom_Prenom.pdf`.
- **Champs laissés modifiables** dans le PDF téléchargé (`fillBaPdf(…, { flatten:
  false })`) : la personne complète les cases vides ou corrige avant de signer.
  L'envoi LiveConsent continue d'aplatir.
- **Robustesse du remplissage** (profite aussi à LiveConsent) : texte ramené au
  jeu WinAnsi de la police Helvetica (`toWinAnsi`, sinon pdf-lib échouait sur
  « Şahin », « Łukasz »…), police réduite quand le texte déborde de sa case,
  e-mail Audencia rempli seulement pour une adresse `@audencia.com` (le PDF
  imprime déjà « @audencia.com » après la case).
- **Case BA de « Mes documents »** : lien « Télécharger mon bulletin
  pré-rempli ». Après le téléchargement, un message liste ce qui manque au
  profil. Le texte d'aide remplace celui des 24-48 h.

### Modèle enrichi en production (26/09)

Le PDF `BA-2025-template-champs.pdf` avait 5 champs (encadré page 1). La
version `BA-2025-template-champs-v2.pdf` en ajoute 6 :

| Champ | Emplacement | Rempli avec |
|---|---|---|
| `etudiant` | « lie Audencia Junior Conseil et l'étudiant …… » (p. 1) | Prénom Nom |
| `etudiant_signature` | « Pour l'Étudiant, …… » (p. 3) | Prénom Nom |
| `numero_etudiant`, `majeure` | encadré p. 1 | vide, à compléter |
| `fait_a`, `date_signature` | « Fait à …… le …… » (p. 3) | vide, à compléter |

La phrase « Le présent document lie… » était une annotation FreeText dessinée
au-dessus de la page : une fois le formulaire aplati, ses pointillés
repassaient sur le nom. Elle a été fondue dans le contenu de la page (même
rendu). Les deux champs « nom » ont un fond blanc qui masque les pointillés ;
les autres les laissent visibles pour l'écriture à la main.

- Objet : `templates/1790451368856_BA-2025-template-champs-v2.pdf` (bucket
  `templates`) ; ligne `document_templates` `c8c3d256-…` mise à jour
  (`file_path`, `file_name`, `placeholders`).
- **Retour arrière** : remettre `file_path =
  'templates/1782779956828_BA-2025-template-champs.pdf'` et `file_name =
  'BA-2025-template-champs.pdf'`. L'ancien objet est conservé.
- Si le bureau dépose un nouveau BA, il doit porter des champs AcroForm nommés
  comme ci-dessus (liste affichée dans Administration → Documents).
