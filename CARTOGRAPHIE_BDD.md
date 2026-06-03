# Cartographie des bases de données — BeFast

> État au 2026-06-03. 25 tables Supabase. Ce document inventorie les tables,
> pointe les redondances, et propose des données/tables à intégrer.

> **Convention JEH (officielle)** : le JEH est l'unité de facturation.
> `nb_jeh` = nombre de JEH (quantité) · `prix_jeh` = prix unitaire d'un JEH (€) ·
> `montant_ht = nb_jeh × prix_jeh`. (« JEH » seul = la quantité, pas le prix.)

> **Avancement** : ✅ R4 (TVA centralisée via `parametres.tva_rate`, lue dans la
> propale et le PPT) · ✅ R9 (paramètres structure persistés — réalisé par Félix
> dans `parametres` + page admin à onglets, plus intégré qu'une table dédiée) ·
> ✅ R1/R2 mitigés par la vue `v_budget_unifie` (migration 031, vocabulaire
> canonique sans casser les tables) · R7 : JSON conservé comme fallback de secours.

---

## 1. Inventaire par domaine

### 🔐 Identité & accès
| Table | Rôle | Colonnes clés |
|---|---|---|
| `personnes` | Tous les comptes (membres, intervenants, admins) | id, prenom, nom, email, account_status, profil_type_id, pole, nss_encrypted, iban_encrypted, rejection_reason |
| `profils_types` | Rôles + permissions par page | id, nom, slug, permissions (JSON), est_defaut |

### 👤 Profil & documents personnels
| Table | Rôle |
|---|---|
| `documents_personnes` | 5 types de docs perso (bucket privé) |
| `custom_fields` / `custom_field_values` | Champs personnalisés admin |
| `document_templates` / `generated_documents` | Modèles {{balises}} + docs générés |

### 💼 Commercial / CRM
| Table | Rôle | Colonnes clés |
|---|---|---|
| `clients` | Entreprises clientes | nom, secteur, contact_*, type (ao/cs/prospection), actif |
| `proposals` | Propositions commerciales | client_*, cdp_id, taille_entreprise, provenance, total_ht/ttc, marge_je, frais_dossier, budget_status |
| `proposal_phases` | Phases d'une propale | name, objectifs, methodologie, jeh_count, jeh_price, intervenants_count |
| `phases_defaut` ⭐ | Catalogue de phases par défaut (pilotable) | nom, objectifs, methodologie, jeh_defaut, intervenants_defaut |
| `marges_recommandees` ⭐ | Marge % par taille d'entreprise | taille_entreprise, marge_pct |

### 🏗️ Production (études & missions)
| Table | Rôle | Colonnes clés |
|---|---|---|
| `etudes` | Études réelles | numero, nom, client_id, suiveur_id, statut, type, budget_ht, frais_dossier, marge_pct |
| `missions` | Missions d'une étude | etude_id, nb_jeh, taux_jour, nb_jours, nb_intervenants, intervenant_id, remuneration, numero_bv, date_paiement |
| `candidatures` | Candidatures intervenants | mission_id, personne_id, classe, statut |
| `echeancier_blocs` | Gantt de l'étude | etude_id, nom, semaine_debut, duree_semaines, jeh |
| `mission_collaborations` | Lien intervenant/CDP par mission | intervenant_id, chef_projet_id |
| `mission_documents` / `mission_checklist` | Docs & checklist de mission |
| `budget_etude` ⭐ | Budget effectif par phase d'étude | etude_id, phase, nb_jeh, prix_jeh, marge_pct |

### 💰 Finance
| Table | Rôle |
|---|---|
| `factures` | Facturation client | numero, etude_id, montant_ht, date_paiement |
| `notes_de_frais` | Frais intervenants | mission, intervenant, montant, statut |

### 🔧 Transverse
| Table | Rôle |
|---|---|
| `parametres` | Clé/valeur global (TVA, prix moyens, fourchettes, contenus défaut…) |
| `notifications` | Notifications utilisateur |
| `support_tickets` | Tickets de support |

⭐ = tables créées récemment.

---

## 2. Redondances identifiées 🔴

### R1. Le « JEH » est éclaté sur 6 tables avec des noms incohérents
| Couche | Table.colonne |
|---|---|
| Prix par défaut | `phases_defaut.jeh_defaut`, `parametres.tarif_jeh_default` / `prix_jeh_moyen` / `prix_jeh_min/max` |
| Prix proposé | `proposal_phases.jeh_count` + `jeh_price` |
| Prix réalisé | `missions.nb_jeh` + `taux_jour` + `nb_jours`, `echeancier_blocs.jeh`, `budget_etude.nb_jeh` + `prix_jeh` |

➡️ **3 couches légitimes** (défaut → négocié → réalisé) mais **nommage divergent** : `jeh_count`/`nb_jeh`/`jeh`, et `jeh_price`/`taux_jour`/`prix_jeh`. À standardiser.

### R2. La marge existe sous 5 formes
`etudes.marge_pct`, `proposals.marge_je`, `budget_etude.marge_pct`, `marges_recommandees.marge_pct`, `parametres.marge_je_moyenne_pct`.
➡️ Incohérence `marge_je` (propale) vs `marge_pct` (partout ailleurs).

### R3. Frais de dossier en triple
`etudes.frais_dossier`, `proposals.frais_dossier`, `parametres.frais_dossier_moyen` (+ saisi en dur dans la page Paramètres structure).

### R4. TVA recalculée en dur partout
`* 1.20` / `* 0.20` codé dans ProposalForm, generate-ppt, etc. **alors que** `parametres.tva_rate` existe et n'est jamais lu.

### R5. Client dénormalisé sur `proposals`
`proposals` stocke `client_company/first_name/last_name/email/phone` **ET** `client_id → clients`.
➡️ Duplication, mais **volontaire** (photo historique de la propale). À documenter comme tel, pas à "corriger".

### R6. « Chef de projet » sous 3 noms
`proposals.cdp_id`, `etudes.suiveur_id`, `mission_collaborations.chef_projet_id`. Même concept, 3 colonnes.

### R7. Contenu des phases en triple
`phases_defaut` (DB) + `proposal_phases` (instances) + `local_db/phases.json` (**legacy, désormais redondant** → à supprimer).

### R8. `type ao/cs/prospection` répété
Sur `clients.type` et `etudes.type`, plus `proposals.study_type` (texte libre) et `proposals.provenance`. Risque de désynchronisation.

### R9. Paramètres « Structure » non persistés
La page Administration → Paramètres structure (SIRET, IBAN, TJH moyen, frais dossier…) est en **state React hardcodé** : rien n'est sauvegardé en base alors que ces données devraient l'être.

---

## 3. Données exploitées vs. exploitables (générables)

### Déjà exploitées
Propales, études, missions, factures, notes de frais, membres, échéancier, charge de production (calculée à la volée).

### Générables mais NON stockées (gisement de valeur) 💡
| Donnée | Source possible | Usage |
|---|---|---|
| **Taux de conversion** propale → CE signée | `proposals.status` | Pilotage commercial |
| **Provenance du CA** (AO/spontané/prospection) | `proposals.provenance` ⭐ | Savoir quel canal rapporte |
| **Marge réelle moyenne** (hors marge affichée) | `budget_etude` ⭐ | Prix JEH brut moyen (déjà branché) |
| **Délai moyen de paiement** client | `factures.date_emission → date_paiement` | Trésorerie prévisionnelle |
| **CA prévisionnel vs réalisé** | `etudes.budget_ht` vs `factures` | Tableau de bord direction |
| **Charge par membre / par semaine** | `proposal_phases` + `missions` | Planification RH |

---

## 4. Tables à intégrer (propositions) 🟢

| Table proposée | Contenu | Usage |
|---|---|---|
| `structure` (1 ligne) | SIRET, IBAN, TJH moyen, signataires, frais dossier… | **Persister** la page Paramètres structure (R9) + alimenter la génération de docs |
| `activite_log` (audit) | qui / quoi / quand sur tables sensibles | Traçabilité + sécurité (complète le travail de Félix) |
| `exercices` | Budget prévisionnel annuel de la JE | Pilotage financier direction |
| `kpis_mensuels` (matérialisée) | Snapshot mensuel des indicateurs | Historiser les stats (sinon recalcul perpétuel) |

### Recommandations de consolidation (sans tout casser)
1. **Supprimer** `local_db/phases.json` (remplacé par `phases_defaut`). *(R7)*
2. **Standardiser** les noms JEH/marge : choisir `nb_jeh` + `prix_jeh` + `marge_pct` partout. *(R1, R2)*
3. **Lire `parametres.tva_rate`** au lieu du `1.20` en dur. *(R4)*
4. **Persister** les paramètres structure dans une table `structure`. *(R9)*
5. **Documenter** la dénormalisation client de `proposals` comme volontaire. *(R5)*

> Principe directeur (validé avec Baptiste) : à l'échelle d'une JE, **priorité à la
> clarté et à l'intégrité** sur l'optimisation espace/vitesse. Les 3 couches de prix
> (défaut → négocié → réalisé) sont conservées, mais avec un **nommage unifié**.
