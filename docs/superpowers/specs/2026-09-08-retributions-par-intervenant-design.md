# Rétributions par intervenant (Trésorerie) — conception

Date : 2026-09-08
Statut : validé, phase 1

## Problème

L'onglet « Suivi des missions » de la trésorerie affiche **une ligne par mission**, avec un seul
statut de paiement et un seul numéro de BV pour toute la mission. Or une mission peut compter
plusieurs dizaines d'intervenants (ex. « Création de contenus stratégiques par 26 intervenants »).
Le trésorier ne peut donc pas savoir qui a été payé et qui ne l'a pas été, ni connaître le total de
rétribution dû à une personne donnée.

Le champ `missions.intervenant_id` est unique et `missions.nb_intervenants` n'est qu'un multiplicateur
de montant : aucune trace individuelle n'existe aujourd'hui.

## Objectif (phase 1)

1. Suivi payé / non payé **par intervenant** sur chaque mission.
2. Numéro de BV **par intervenant**, auto-numéroté et modifiable.
3. Récapitulatif de la rétribution **par personne** (total dû, total versé, nombre de missions).

Hors périmètre (phase 2) : génération automatique des documents « bulletin de versement » à partir
d'un modèle Word. Le socle de données conçu ici la rend possible sans nouvelle migration.

## Source des intervenants d'une mission

Une personne est intervenante sur une mission si :

- elle a une `candidatures` de statut `acceptee` sur cette mission, **ou**
- elle est l'intervenante assignée directement (`missions.intervenant_id`), cas des missions de
  suivi d'étude qui ne passent pas par une candidature.

C'est exactement la règle déjà appliquée par `listMissionIntervenants` dans
[lib/actions/documents.ts](../../../lib/actions/documents.ts) : le déduplication se fait sur l'id de
la personne, les candidatures acceptées d'abord.

## Modèle de données

Nouvelle table `public.retributions`, une ligne par couple (mission, personne) **matérialisée à la
demande** : elle n'est écrite qu'au moment où un paiement est enregistré ou un BV émis.

```sql
CREATE TABLE public.retributions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id    UUID NOT NULL REFERENCES public.missions(id)  ON DELETE CASCADE,
  personne_id   UUID NOT NULL REFERENCES public.personnes(id) ON DELETE CASCADE,
  numero_bv     TEXT,
  date_paiement DATE,
  montant       NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes         TEXT,
  created_by    UUID REFERENCES public.personnes(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (mission_id, personne_id)
);
```

Index sur `mission_id`, `personne_id`, `date_paiement` et `numero_bv`. L'index sur `numero_bv`
**n'est pas unique** : les paiements déjà saisis peuvent partager un numéro et la migration ne doit
pas échouer sur ces doublons. L'unicité est vérifiée par la server action au moment de l'écriture,
avec un message explicite.

RLS : lecture réservée aux membres internes (`public.is_membre_interne`), écriture et suppression
réservées aux porteurs de `voir_factures` via l'helper `public.has_permission` introduit en
migration 055. La lecture des `candidatures` est déjà ouverte aux membres internes (policy
`candidatures read`, migration 050) : aucun changement de ce côté.

Trigger `updated_at` identique à `set_factures_updated_at`.

**Backfill** : pour chaque mission déjà marquée payée (`missions.date_paiement IS NOT NULL`) et dotée
d'un `intervenant_id`, insérer la ligne de rétribution correspondante avec son `numero_bv`, sa date
et son montant, afin de ne pas perdre l'historique. Les missions payées sans intervenant identifiable
conservent leur paiement au niveau mission (voir « ligne d'alerte » ci-dessous).

Les colonnes `missions.date_paiement` / `missions.numero_bv` **ne sont pas supprimées** : elles
restent la seule façon de tracer une mission sans intervenant sélectionné.

### Montant

`montant_par_intervenant = remuneration × nb_jeh`, identique pour chaque intervenant de la mission.
Le montant est **figé** dans la ligne `retributions` à l'écriture, pour que le suivi comptable ne
bouge plus si le barème de la mission est modifié après paiement.

Pour une mission sans aucun intervenant identifié, le montant resté dû est
`remuneration × nb_jeh × nb_intervenants` (calcul actuel, inchangé).

### Numérotation des BV

`BV-<année>-<séquence sur 3 chiffres>`, la séquence étant calculée côté serveur à partir du plus
grand numéro existant de l'année en cours (`retributions.numero_bv` et, pour la reprise,
`missions.numero_bv`). Le numéro proposé est pré-rempli dans la modale de paiement et reste
modifiable par le trésorier. Une collision (numéro déjà pris) remonte une erreur explicite plutôt
qu'un écrasement silencieux.

## Découpage du code

Logique pure, testable, isolée dans un nouveau module :

- `lib/tresorerie/retributions.ts`
  - `buildRetributionRows(missions, intervenantsParMission, retributionsExistantes)` → lignes
    affichables, y compris les lignes d'alerte des missions sans intervenant.
  - `agregerParPersonne(rows)` → total dû, total versé, nombre de missions par personne.
  - `nextNumeroBV(numerosExistants, annee)` → prochain numéro libre.
- `lib/tresorerie/retributions.test.ts` — tests vitest de ces trois fonctions (cas : mission
  multi-intervenants partiellement payée, mission sans intervenant, candidature ajoutée après
  paiement, collision de numéro, année qui change).

Accès base et permissions dans `lib/actions/tresorerie.ts`, qui reste le seul point d'entrée serveur :

- `getTresorerieData` charge en parallèle missions, candidatures acceptées et `retributions`, puis
  délègue la composition des lignes au module pur.
- `marquerRetributionPaiement(missionId, personneId, { date_paiement, numero_bv })` — upsert sur
  `(mission_id, personne_id)`, fige le montant.
- `annulerRetributionPaiement(missionId, personneId)` — remet `date_paiement` à null, conserve le BV.
- `marquerMissionRetributionsPayees(missionId, { date_paiement })` — action groupée « tout marquer
  payé » pour une mission, un numéro de BV attribué par intervenant.
- `marquerMissionPaiement` est **conservée** pour les missions sans intervenant sélectionné.

Toutes ces actions passent par le garde `requireVoirFactures` existant.

## Interface

Onglet renommé « Suivi des rétributions (N) », N = nombre de lignes intervenant.

- Une ligne par intervenant ; les lignes d'une même mission sont regroupées sous un en-tête de
  mission portant l'étude, le nom de la mission, le montant total et un bouton « Tout marquer payé ».
- Colonnes inchangées : Étude · BV · Mission · Intervenant · Dates · Paiement · Montant · Actions.
- Une mission sans intervenant accepté affiche **une ligne d'alerte** grisée « aucun intervenant
  sélectionné » portant le montant total : la rétribution due ne disparaît ni du tableau ni des KPI.
- La modale de paiement affiche le nom de l'intervenant concerné et pré-remplit le numéro de BV.
- La recherche porte sur mission, intervenant, numéro de BV et numéro d'étude (comportement actuel
  élargi aux nouvelles lignes).

Nouvel onglet « Par intervenant » : une ligne par personne (total dû, total versé, nombre de
missions, nombre de BV émis), triée par montant dû décroissant. Cliquer une ligne bascule sur
l'onglet rétributions filtré sur cette personne.

## Impacts

- **KPI** « Rétribution à verser », « Rétribution versée », « Missions à payer » : recalculés sur les
  lignes de rétribution (les lignes d'alerte comptant pour leur montant total).
- **Export comptable** ([app/api/tresorerie/export/route.ts](../../../app/api/tresorerie/export/route.ts)) :
  la feuille « BV » est alimentée par `retributions` jointe aux personnes, avec repli sur les
  paiements de mission non attribués. Colonnes : numéro BV, intervenant, étude, mission, montant,
  date de paiement.
- Aucun autre écran ne lit `missions.date_paiement` / `missions.numero_bv` (vérifié par recherche) :
  l'impact est circonscrit à la trésorerie et à son export.

## Gestion des erreurs

- Table absente (migration non appliquée) : `getTresorerieData` détecte le code `42P01` et bascule
  sur le comportement actuel (une ligne par mission) en affichant le bandeau « migration manquante »
  déjà présent, plutôt que de vider la page.
- Numéro de BV en collision : erreur `23505` traduite en message explicite dans la modale.
- Paiement sur une personne qui n'est plus intervenante (candidature annulée après coup) : la ligne
  reste affichée tant qu'elle porte un paiement, signalée comme « n'est plus sur la mission ».

## Migration à appliquer manuellement

`supabase/migrations/067_retributions_intervenants.sql` — comme toutes les migrations du projet,
elle n'est pas appliquée automatiquement : Felix doit l'exécuter depuis le dashboard Supabase.
