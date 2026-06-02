# Logs — BeFast

Journal des fonctionnalités de la plateforme. Tenu à jour au fil des évolutions.
Format : chaque entrée = une capacité livrée, la plus récente en haut.

---

## Module Propositions / Prospection (générateur de propositions commerciales)

> Brique centrale de l'outil commercial : conception, chiffrage et génération des
> propositions commerciales, jusqu'à la signature de la CE qui crée une étude réelle.

- Générateur de propositions complet : informations client, contexte, phases,
  intervenants, cahier des charges, échéancier et budget.
- Échéancier Gantt éditable (glisser-déposer, redimensionnement des phases).
- Calcul de budget en direct : JEH par phase, suivi CDP, marge JE, frais de dossier,
  frais annexes, total HT / TVA / TTC.
- Génération automatique du PowerPoint de proposition.
- Signature de CE → création automatique d'une étude (phases → échéancier + missions
  + budget + client).
- Tableau de bord des propositions : vue liste + vue calendrier (charge de production,
  prochaines échéances, PVRF).
- Phases prédéfinies réutilisables (objectifs, méthodologie, contraintes par défaut).

## Pilotage & paramètres

- Onglet **Contrôle des données** : pilotage des prix moyens, fourchettes de prix JEH,
  contenu par défaut des propositions, et marges recommandées par taille d'entreprise.
- Les nouvelles propositions sont pré-remplies depuis ces paramètres.
- **Taille de structure** (micro-entreprise → grand groupe, défaut PME) : ajuste
  automatiquement la marge JE recommandée.
- Provenance de l'étude (Appel d'offres / Contact spontané / Prospection).

## Trésorerie

- Suivi des factures, du CA par étude, des paiements intervenants et notes de frais.
- **Validation de budget** (admin) : une proposition ne peut être réalisée que si son
  budget a été validé.

## Membres & administration

- Validation et **rejet** des comptes membres (avec motif optionnel).
- Contrôle des rôles et permissions.
- **Export CSV** des données (membres, clients, études, missions, factures, propositions).
- Explorateur de données en lecture seule (visualisation des tables).

## Expérience utilisateur

- Titre d'onglet « Audencia Junior Conseil ».
- Bouton « Créer un compte » sur la page d'accueil.
- Menu compte : Mon profil / Changer de profil / Déconnexion.

---

## À venir / en cours

- Module **Pilotage des phases** : édition des phases par défaut (JEH, nombre moyen
  d'intervenants, contenu) avec recherche/filtre, et prix JEH brut moyen (hors marge).
- Suivi de la **marge effective par étude** (table dédiée `budget_etude`).
- Changement de profil multi-session (profils encore connectés).
- Optimisation du temps de chargement de la trésorerie.
