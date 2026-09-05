# Suppression de compte — BeFast & RH Manager

> Spec validée le 2026-09-04. Concerne deux dépôts : `~/Desktop/Befast` et
> `~/Desktop/RH Manager Anti`.

## Intention

Un candidat ou un membre doit pouvoir demander la suppression de son compte
depuis son profil. La suppression elle-même reste un geste d'administrateur,
effectué dans BeFast. Le bouton côté utilisateur n'efface donc rien : il
notifie l'équipe d'administration à `systeme.info@ajc-mail.com`.

Deux livrables indépendants :

1. **Demande de suppression** — un bouton discret dans le profil, sur les deux
   applications, qui envoie un email à l'administration.
2. **Suppression effective** — une action d'administrateur dans BeFast, qui
   coupe l'accès, purge les données personnelles et anonymise l'identité.

## Partie 1 — Demande de suppression

### Comportement commun aux deux applications

Un lien discret en bas de la page profil : « Demander la suppression de mon
compte », en petits caractères gris, hors des zones d'action principales. Le
clic ouvre une modale qui énonce trois choses : la demande part vers l'équipe
d'administration, elle n'est pas immédiate, et la suppression est définitive.
Un champ « motif » facultatif, un bouton d'envoi, un bouton d'annulation. Après
envoi, la modale passe en état « Demande envoyée » et le lien reste désactivé
le temps de la session.

L'email envoyé à l'administration contient : l'application d'origine, les nom,
prénom et email du demandeur, son identifiant technique, l'horodatage et le
motif s'il a été saisi. Tout contenu saisi par l'utilisateur est échappé en
HTML avant insertion dans le corps du message.

L'adresse de destination est lue depuis `ADMIN_NOTIFICATION_EMAIL`, avec
`systeme.info@ajc-mail.com` comme valeur par défaut dans le code.

### BeFast

| Fichier | Nature |
|---|---|
| `app/(dashboard)/dashboard/profil/_components/delete-account-request.tsx` | nouveau — lien + modale |
| `app/(dashboard)/dashboard/profil/page.tsx` | modifié — insertion du composant sous l'encart « Documents sécurisés » |
| `app/api/profil/delete-request/route.ts` | nouveau — `POST` |
| `lib/email/account-deletion.ts` | nouveau — gabarit HTML de l'email |

La route `POST /api/profil/delete-request` s'appuie sur le garde
`requireApiUser()` de `lib/auth/api-guards.ts` — 401 si anonyme. Ce garde
renvoie déjà le profil complet (prénom, nom, email) depuis le cache de cinq
minutes, donc la route n'a aucune requête d'identité à faire. Le ticket passe
par le client authentifié : les politiques RLS de la migration 025 autorisent
déjà l'insertion par un utilisateur authentifié et la lecture de ses propres
tickets. Puis :

1. insère une ligne dans `support_tickets` avec
   `type_probleme = "suppression_compte"`, la description reprenant le motif —
   la table existe déjà (migration 025) et donne à l'admin une trace consultable
   même si l'email se perd ;
2. envoie l'email via `sendEmail()` de `lib/email/send.ts` (Resend, repli Brevo).

**Anti-doublon** : si une ligne `support_tickets` de type `suppression_compte`
existe déjà pour cet utilisateur avec `created_at > now() - 24h`, la route
répond 200 sans réenvoyer d'email. L'utilisateur voit le même message de
confirmation — inutile de lui signaler qu'il a déjà demandé.

L'échec de l'envoi d'email ne fait pas échouer la requête si le ticket a bien
été créé : la trace en base suffit à traiter la demande. La réponse le
signale (`{ ok: true, emailSent: false }`) et l'erreur est journalisée.

### RH Manager

| Fichier | Nature |
|---|---|
| `frontend/src/components/candidates/DeleteAccountRequest.tsx` | nouveau — lien + modale |
| `frontend/src/app/candidates/profile/page.tsx` | modifié — insertion en bas de page |
| `frontend/src/app/api/candidates/delete-request/route.ts` | nouveau — `POST` |
| `frontend/src/lib/resend.ts` | modifié — `sendAccountDeletionRequestEmail()` |

La route `POST /api/candidates/delete-request` authentifie via
`getTokenFromRequest(req)` — 401 sinon. Elle relit la fiche candidat dans
`candidates` avec `supabaseAdmin` à partir de `payload.id` : l'identité
provient de la base, jamais du corps de la requête, qui ne porte que le motif.

RH n'a pas de table de tickets : l'email est le seul canal. Il n'y a donc pas
de dédoublonnage serveur — le garde-fou est le bouton désactivé côté client
après envoi. Limite acceptée : le volume potentiel est borné par le nombre de
candidats authentifiés, et l'email d'un candidat pressé qui renvoie sa demande
n'a pas de conséquence.

## Partie 2 — Suppression effective (BeFast, administrateur)

### Sémantique retenue

Désactivation, purge des données personnelles, conservation de la ligne. La
ligne `personnes` est référencée par `missions`, `candidatures`,
`mission_collaborations`, `notes_de_frais` et `support_tickets` : un `DELETE`
réel ferait échouer la suppression sur une contrainte de clé étrangère ou
emporterait de l'historique financier. Le compte est donc vidé de son contenu
personnel, pas retiré de la base.

### Migration

`supabase/migrations/058_account_status_deleted.sql` — la contrainte actuelle
n'autorise que trois valeurs :

```sql
CHECK (account_status IN ('pending_validation', 'validated', 'rejected'))
```

La migration la remplace pour accepter `'deleted'`. Sans elle, la mise à jour
échoue.

### Route

`DELETE` ajouté à `app/api/admin/personnes/[id]/route.ts`, qui porte déjà le
`PATCH` de changement de statut. Réservé au slug `administrateur` — 403 sinon,
en réutilisant le contrôle de rôle du `PATCH`. Un administrateur ne peut pas
supprimer son propre compte : 400.

La logique vit dans `lib/admin/delete-account.ts`, isolée de la route pour
rester lisible et testable. Dans l'ordre :

1. `account_status` passe à `deleted` — l'accès est coupé immédiatement,
   [`app/(dashboard)/layout.tsx:63`](../../../app/(dashboard)/layout.tsx) refoule
   déjà tout ce qui n'est pas `validated` ;
2. suppression des documents personnels : objets Scaleway S3 (`DeleteObjectCommand`
   sur `SCALEWAY_BUCKET`, chemins lus dans `documents_personnes.file_path`), puis
   les lignes `documents_personnes` ;
3. suppression de l'avatar dans le bucket Supabase `avatars`, et
   `avatar_url` à `null` ;
4. mise à `null` des colonnes chiffrées et de leurs `iv` / `auth_tag` —
   `nss_*`, `iban_*`, `adresse_*`, `date_naissance_*`, `ville_*`,
   `code_postal_*` (migration 022) — ainsi que `encryption_salt`, `portable`
   et les colonnes en clair `adresse`, `ville`, `code_postal` ;
5. suppression des `custom_field_values` de la personne ;
6. anonymisation de l'identité : `prenom = "Compte"`, `nom = "supprimé"`,
   `email = "supprime+<id>@ajc-mail.com"` — l'email doit rester unique et ne
   plus permettre de retrouver la personne ;
7. neutralisation du compte Supabase Auth via
   `admin.auth.admin.updateUserById(id, { ban_duration, email: <email anonymisé>, email_confirm: true })`.

**Ne jamais appeler `admin.auth.admin.deleteUser(id)`.** `personnes.id` est
déclaré `REFERENCES auth.users(id) ON DELETE CASCADE` (migration 001), et
`notes_de_frais.intervenant_id`, `mission_collaborations.intervenant_id` et
`candidatures.personne_id` cascadent à leur tour depuis `personnes`. Supprimer
l'utilisateur Auth effacerait donc la ligne `personnes` **et** l'historique des
notes de frais — exactement ce que cette conception cherche à préserver. Le
compte Auth est banni, pas supprimé ; son email est anonymisé pour que l'adresse
réelle ne subsiste nulle part.

L'ordre compte : le statut passe en premier pour que l'accès soit coupé même si
une étape ultérieure échoue. Chaque étape journalise son échec sans interrompre
les suivantes, et la route renvoie la liste des étapes en échec afin que
l'administrateur sache ce qui reste à traiter à la main.

L'opération est tracée dans `audit_logs` via le `logAudit()` existant de
`lib/supabase-security.ts` : table `personnes`, opération `DELETE`, l'id du
membre supprimé et la liste des étapes en échec dans `details`.

### Interface

Dans `app/(dashboard)/administration/membres/_components/MembresTab.tsx`, une
action « Supprimer » dans la ligne du membre, visuellement distincte des
actions de validation et de rejet existantes. Elle ouvre une modale de
confirmation où l'administrateur doit retaper l'email exact du membre : le
bouton de confirmation reste inactif tant que la saisie ne correspond pas.

La modale énonce ce qui va se passer : accès coupé, documents et données
personnelles effacés, identité anonymisée, historique des missions conservé,
action irréversible.

Après succès, la ligne se met à jour dans la liste avec le statut `deleted`.
Le filtre de statut existant gagne l'entrée correspondante.

## Hors périmètre

- **Aucune répercussion automatique entre les deux applications.** Supprimer un
  compte dans BeFast ne touche pas la fiche candidat RH, et réciproquement.
  L'administrateur traite les deux côtés séparément.
- **Aucune suppression automatique déclenchée par une demande.** Le bouton
  utilisateur notifie, il ne supprime pas.
- **Le hub d'onboarding** (`~/Desktop/onboarding-ajc`) n'est pas modifié.
- **Le TODO d'envoi d'email de `app/api/support/report/route.ts`** reste en
  l'état : le corriger est un autre sujet.

## Vérifications à mener pendant l'implémentation

- Confirmer que `documents_personnes` ne porte pas de colonnes de chemin
  secondaires (miniature, version) qui échapperaient à la purge S3.
- Vérifier sur un compte de test que le bannissement Auth empêche bien la
  connexion **et** la demande de réinitialisation de mot de passe.
- Vérifier que la lecture anti-doublon dans `support_tickets` fonctionne bien
  avec le client authentifié : la politique « user read own support_tickets »
  filtre sur `utilisateur_id = auth.uid()`, ce qui est exactement le besoin,
  mais elle n'a jamais été exercée en lecture jusqu'ici.

## Critères de validation

1. Depuis un compte membre BeFast validé, le lien de demande est présent en bas
   du profil, la modale s'ouvre, l'envoi crée une ligne `support_tickets` de
   type `suppression_compte` et un email arrive à l'adresse configurée.
2. Une seconde demande dans les 24 h ne crée ni ticket ni email, et affiche la
   même confirmation.
3. Depuis un compte candidat RH, le lien est présent, l'envoi déclenche l'email
   contenant l'identité lue en base.
4. Un utilisateur non authentifié qui appelle l'une ou l'autre route reçoit 401.
5. Un administrateur BeFast supprime un membre de test : la migration acceptée,
   le statut passe à `deleted`, les documents ont disparu de S3, les colonnes
   chiffrées sont nulles, l'identité est anonymisée, le compte Auth est banni,
   et le membre supprimé ne peut plus se connecter ni accéder au tableau de bord.
6. Les missions et notes de frais qui référençaient ce membre sont toujours là,
   et la ligne `personnes` existe encore, anonymisée.
7. Un non-administrateur qui appelle la route de suppression reçoit 403 ; un
   administrateur qui vise son propre compte reçoit 400.
