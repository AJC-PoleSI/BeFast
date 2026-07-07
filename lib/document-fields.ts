/**
 * Reference map of all available template placeholders.
 * Format: {scope.field} — e.g. {etude.nom}, {client.contact_nom}
 * Also documents flat aliases and utility placeholders.
 */

export type FieldDef = {
  placeholder: string
  label: string
  source: string
  example?: string
}

export const DOCUMENT_FIELDS: FieldDef[] = [
  // ── Utilitaires ──────────────────────────────────────────
  { placeholder: "date", label: "Date du jour (DD/MM/YYYY)", source: "calculé", example: "27/04/2026" },
  { placeholder: "date_iso", label: "Date ISO", source: "calculé", example: "2026-04-27" },
  { placeholder: "annee", label: "Année en cours", source: "calculé", example: "2026" },
  { placeholder: "reference", label: "Numéro d'étude", source: "etudes.numero" },

  // ── Étude ─────────────────────────────────────────────────
  { placeholder: "etude.nom", label: "Nom de l'étude", source: "etudes.nom" },
  { placeholder: "etude.numero", label: "Numéro d'étude", source: "etudes.numero" },
  { placeholder: "etude.statut", label: "Statut", source: "etudes.statut" },
  { placeholder: "etude.type", label: "Type (ao/cs/prospection)", source: "etudes.type" },
  { placeholder: "etude.budget_ht", label: "Budget HT", source: "etudes.budget_ht" },
  { placeholder: "etude.tarif_ht", label: "Tarif HT (budget + frais + marge)", source: "calculé" },
  { placeholder: "etude.frais", label: "Frais de dossier", source: "etudes.frais_dossier" },
  { placeholder: "etude.marge_euros", label: "Marge en €", source: "calculé" },
  { placeholder: "etude.description", label: "Description", source: "etudes.description" },
  { placeholder: "etude.date_debut", label: "Date de début", source: "etudes.date_debut" },
  { placeholder: "etude.date_fin", label: "Date de fin", source: "etudes.date_fin" },
  { placeholder: "etude.nb_jeh", label: "Total JEH", source: "calculé depuis echeancier_blocs" },
  { placeholder: "etude.nb_phases", label: "Nombre de phases", source: "calculé depuis echeancier_blocs" },
  { placeholder: "etude.reference_convention_client", label: "Référence de la Convention Client", source: "etudes.reference_convention_client" },
  { placeholder: "etude.reference_dernier_avenant", label: "Référence du dernier avenant (vide si aucun)", source: "etudes.reference_dernier_avenant" },
  { placeholder: "etude.mention_avenant", label: "\"modifiée par l'avenant X\" ou vide si aucun avenant", source: "calculé" },

  // ── Mission ───────────────────────────────────────────────
  { placeholder: "mission.nom", label: "Nom de la mission", source: "missions.nom" },
  { placeholder: "mission.type", label: "Type (intervenant/chef_projet)", source: "missions.type" },
  { placeholder: "mission.voie", label: "Voie", source: "missions.voie" },
  { placeholder: "mission.classe", label: "Classe requise", source: "missions.classe" },
  { placeholder: "mission.description", label: "Description", source: "missions.description" },
  { placeholder: "mission.nb_jours", label: "Nombre de jours", source: "missions.nb_jours" },
  { placeholder: "mission.taux_jour", label: "Taux journalier", source: "missions.taux_jour" },
  { placeholder: "mission.date_debut", label: "Date de début", source: "missions.date_debut" },
  { placeholder: "mission.date_fin", label: "Date de fin", source: "missions.date_fin" },
  { placeholder: "mission.statut", label: "Statut", source: "missions.statut" },
  { placeholder: "mission.numero_etude", label: "Numéro d'étude liée", source: "etudes.numero" },
  { placeholder: "mission.nombre_jeh", label: "Nombre de JEH (alias nb_jours)", source: "missions.nb_jours" },
  { placeholder: "mission.montant_remuneration", label: "Rémunération totale (JEH × taux/jour)", source: "calculé" },
  { placeholder: "mission.duree", label: "Durée en semaines (alias duree_semaines)", source: "calculé depuis date_debut/date_fin" },
  { placeholder: "mission.duree_semaines", label: "Durée en semaines", source: "calculé depuis date_debut/date_fin" },
  { placeholder: "mission.duree_jours", label: "Durée en jours calendaires", source: "calculé depuis date_debut/date_fin" },
  { placeholder: "mission.reference_recap_mission", label: "Référence du dernier RDM généré pour cette mission", source: "generated_documents" },

  // ── Client / Entreprise ───────────────────────────────────
  { placeholder: "client.nom", label: "Nom du client", source: "clients.nom" },
  { placeholder: "client.secteur", label: "Secteur d'activité", source: "clients.secteur" },
  { placeholder: "client.contact_nom", label: "Nom du contact", source: "clients.contact_nom" },
  { placeholder: "client.contact_email", label: "Email du contact", source: "clients.contact_email" },
  { placeholder: "client.contact_phone", label: "Téléphone du contact", source: "clients.contact_phone" },
  { placeholder: "entreprise.nom", label: "Nom de l'entreprise (alias client)", source: "clients.nom", example: "Danone" },
  { placeholder: "entreprise.adresse", label: "Adresse de l'entreprise", source: "clients.adresse" },
  { placeholder: "entreprise.code_postal", label: "Code postal de l'entreprise", source: "clients.code_postal" },
  { placeholder: "entreprise.ville", label: "Ville de l'entreprise", source: "clients.ville" },
  { placeholder: "entreprise.pays", label: "Pays de l'entreprise", source: "clients.pays", example: "France" },
  { placeholder: "signataire.civilite", label: "Civilité du signataire client", source: "clients.contact_civilite" },
  { placeholder: "signataire.prenom", label: "Prénom du signataire client", source: "clients.contact_prenom" },
  { placeholder: "signataire.nom", label: "Nom du signataire client", source: "clients.contact_nom" },
  { placeholder: "signataire.poste", label: "Poste/fonction du signataire", source: "clients.contact_poste" },
  { placeholder: "signataire.fonction", label: "Alias de signataire.poste", source: "clients.contact_poste" },
  { placeholder: "signataire.email", label: "Email du signataire", source: "clients.contact_email" },
  { placeholder: "signataire.telephone", label: "Téléphone du signataire", source: "clients.contact_phone" },

  // ── Suiveur ───────────────────────────────────────────────
  { placeholder: "suiveur.prenom", label: "Prénom du suiveur", source: "personnes.prenom" },
  { placeholder: "suiveur.nom", label: "Nom du suiveur", source: "personnes.nom" },
  { placeholder: "suiveur.email", label: "Email du suiveur", source: "personnes.email" },

  // ── Intervenant / Étudiant ────────────────────────────────
  { placeholder: "intervenant.prenom", label: "Prénom de l'intervenant", source: "personnes.prenom" },
  { placeholder: "intervenant.nom", label: "Nom de l'intervenant", source: "personnes.nom" },
  { placeholder: "intervenant.email", label: "Email de l'intervenant", source: "personnes.email" },
  { placeholder: "intervenant.portable", label: "Téléphone", source: "personnes.portable" },
  { placeholder: "intervenant.adresse", label: "Adresse", source: "personnes.adresse" },
  { placeholder: "intervenant.code_postal", label: "Code postal", source: "personnes.code_postal" },
  { placeholder: "intervenant.ville", label: "Ville", source: "personnes.ville" },
  { placeholder: "intervenant.promo", label: "Promotion", source: "personnes.promo" },
  { placeholder: "intervenant.num_secu", label: "N° de sécurité sociale (déchiffré, Bulletin de Versement uniquement)", source: "personnes.nss_encrypted" },
  { placeholder: "etudiant.prenom", label: "Prénom (alias intervenant)", source: "personnes.prenom" },
  { placeholder: "etudiant.nom", label: "Nom (alias intervenant)", source: "personnes.nom" },
  { placeholder: "etudiant_prenom", label: "Prénom (flat alias)", source: "personnes.prenom" },
  { placeholder: "etudiant_nom", label: "Nom (flat alias)", source: "personnes.nom" },

  // ── Président ─────────────────────────────────────────────
  { placeholder: "president.prenom", label: "Prénom du président(e)", source: "parametres.president_nom" },
  { placeholder: "president.nom", label: "Nom du président(e)", source: "parametres.president_nom" },
  { placeholder: "president.nom_complet", label: "Nom complet", source: "parametres.president_nom" },
  { placeholder: "president.civilite", label: "Civilité (Monsieur/Madame)", source: "calculé depuis parametres.president_genre" },

  // ── Trésorier ─────────────────────────────────────────────
  { placeholder: "tresorier.prenom", label: "Prénom du trésorier(e)", source: "parametres.tresorier_nom" },
  { placeholder: "tresorier.nom", label: "Nom du trésorier(e)", source: "parametres.tresorier_nom" },
  { placeholder: "tresorier.nom_complet", label: "Nom complet", source: "parametres.tresorier_nom" },
  { placeholder: "tresorier.civilite", label: "Civilité", source: "calculé depuis parametres.tresorier_genre" },

  // ── Structure ─────────────────────────────────────────────
  { placeholder: "structure.raison_sociale", label: "Raison sociale", source: "parametres.raison_sociale" },
  { placeholder: "structure.siret", label: "SIRET", source: "parametres.siret" },
  { placeholder: "structure.code_ape", label: "Code APE", source: "parametres.code_ape" },
  { placeholder: "structure.numero_tva", label: "N° TVA intracommunautaire", source: "parametres.numero_tva" },
  { placeholder: "structure.numero_urssaf", label: "N° URSSAF", source: "parametres.numero_urssaf" },
  { placeholder: "structure.adresse", label: "Adresse complète", source: "parametres.adresse_1 + adresse_2" },
  { placeholder: "structure.code_postal", label: "Code postal", source: "parametres.code_postal" },
  { placeholder: "structure.ville", label: "Ville", source: "parametres.ville" },
  { placeholder: "structure.email", label: "Email de contact", source: "parametres.email_contact" },
  { placeholder: "structure.telephone", label: "Téléphone", source: "parametres.telephone" },
  { placeholder: "structure.site_web", label: "Site web", source: "parametres.site_web" },
  { placeholder: "structure.iban", label: "IBAN", source: "parametres.iban" },
  { placeholder: "structure.bic", label: "BIC", source: "parametres.bic" },
  { placeholder: "structure.nom_ecole", label: "Nom de l'école", source: "parametres.nom_ecole" },
  { placeholder: "structure.statut_juridique", label: "Statut juridique", source: "parametres.statut_juridique", example: "Association loi 1901" },
  { placeholder: "structure.banque_rib", label: "Nom de la banque (RIB)", source: "parametres.banque_rib" },
  { placeholder: "structure.banque_domiciliation", label: "Domiciliation bancaire", source: "parametres.banque_domiciliation" },
  { placeholder: "structure.ordre_cheques", label: "Ordre pour règlement par chèque", source: "parametres.ordre_cheques" },
  { placeholder: "structure.tva_taux", label: "Taux de TVA (%)", source: "parametres.tva_taux", example: "20" },
  { placeholder: "junior.nom", label: "Nom de la JE (alias structure)", source: "parametres.raison_sociale" },
  { placeholder: "junior.raison_sociale", label: "Raison sociale (alias structure)", source: "parametres.raison_sociale" },
  { placeholder: "junior.statut_juridique", label: "Statut juridique (alias)", source: "parametres.statut_juridique" },
  { placeholder: "junior.adresse1", label: "Adresse ligne 1 (alias)", source: "parametres.adresse_1" },
  { placeholder: "junior.adresse2", label: "Adresse ligne 2 (alias)", source: "parametres.adresse_2" },
  { placeholder: "junior.code_postal", label: "Code postal (alias)", source: "parametres.code_postal" },
  { placeholder: "junior.ville", label: "Ville (alias)", source: "parametres.ville" },
  { placeholder: "junior.siret", label: "SIRET (alias)", source: "parametres.siret" },
  { placeholder: "junior.code_ape", label: "Code APE (alias)", source: "parametres.code_ape" },
  { placeholder: "junior.n_urssaf", label: "N° URSSAF (alias)", source: "parametres.numero_urssaf" },
  { placeholder: "junior.n_tva_intra", label: "N° TVA intracommunautaire (alias)", source: "parametres.numero_tva" },
  { placeholder: "junior.nom_ecole", label: "Nom de l'école (alias)", source: "parametres.nom_ecole" },
  { placeholder: "junior.banque_rib", label: "Banque / RIB (alias)", source: "parametres.banque_rib" },
  { placeholder: "junior.banque_domiciliation", label: "Domiciliation bancaire (alias)", source: "parametres.banque_domiciliation" },
  { placeholder: "junior.banque_iban", label: "IBAN (alias)", source: "parametres.iban" },
  { placeholder: "junior.banque_bic", label: "BIC (alias)", source: "parametres.bic" },
  { placeholder: "junior.ordre_cheques", label: "Ordre chèques (alias)", source: "parametres.ordre_cheques" },

  // ── Phases / Planning ─────────────────────────────────────
  { placeholder: "nb_jeh", label: "Total JEH (racine)", source: "calculé depuis echeancier_blocs" },
  { placeholder: "nb_phases", label: "Nombre de phases (racine)", source: "calculé depuis echeancier_blocs" },
  { placeholder: "phases", label: "Tableau de phases (boucle {#phases})", source: "echeancier_blocs" },

  // ── Facturation (scope "facture" uniquement) ──────────────
  { placeholder: "facturation.numero", label: "Numéro de facture", source: "factures.numero" },
  { placeholder: "facturation.numero_global", label: "Alias de facturation.numero", source: "factures.numero" },
  { placeholder: "facturation.type", label: "Type (acompte/intermediaire/solde)", source: "factures.type" },
  { placeholder: "facturation.type_libelle", label: "Libellé du type (\"d'acompte\", \"intermédiaire\", \"de solde\")", source: "calculé" },
  { placeholder: "facturation.libelle_ligne", label: "Libellé de la ligne de montant", source: "calculé" },
  { placeholder: "facturation.est_acompte", label: "Booléen — section {#facturation.est_acompte}", source: "calculé" },
  { placeholder: "facturation.est_intermediaire", label: "Booléen — section {#facturation.est_intermediaire}", source: "calculé" },
  { placeholder: "facturation.est_solde", label: "Booléen — section {#facturation.est_solde}", source: "calculé" },
  { placeholder: "facturation.accompte_pct", label: "Pourcentage d'acompte", source: "factures.accompte_pct" },
  { placeholder: "facturation.montant_ht", label: "Montant HT de la facture", source: "factures.montant_ht" },
  { placeholder: "facturation.montant_tva", label: "Montant de la TVA", source: "calculé" },
  { placeholder: "facturation.montant_ttc", label: "Montant TTC", source: "calculé" },
  { placeholder: "facturation.tva_taux", label: "Taux de TVA appliqué (%)", source: "parametres.tva_taux" },
  { placeholder: "facturation.total_deja_facture", label: "Total HT déjà facturé sur l'étude", source: "calculé" },
  { placeholder: "facturation.total_ht_etude", label: "Total HT de l'étude", source: "calculé" },
  { placeholder: "facturation.solde_restant", label: "Solde restant dû", source: "calculé" },
  { placeholder: "facturation.emitted_at", label: "Date d'émission", source: "factures.date_emission" },
  { placeholder: "facturation.due_at", label: "Date d'échéance", source: "factures.date_echeance" },
  { placeholder: "facturation.paid_at", label: "Date de paiement", source: "factures.date_paiement" },
  { placeholder: "facturation.notes", label: "Notes libres", source: "factures.notes" },
  { placeholder: "facturation.non_acompte", label: "Booléen — section {#facturation.non_acompte} (intermédiaire ou solde)", source: "calculé" },
  { placeholder: "facturation.total_prestation", label: "Total prestation (bloc totaux)", source: "calculé" },
  { placeholder: "facturation.ligne_frais", label: "Frais (acompte) ou 0", source: "calculé" },
  { placeholder: "facturation.libelle_deduction", label: "\"Total HT de l'étude\" ou \"Déduction des factures précédentes\"", source: "calculé" },
  { placeholder: "facturation.montant_deduction", label: "Montant de la ligne déduction", source: "calculé" },
  { placeholder: "facturation.mention_tva_acompte", label: "\" sur l'acompte\" ou vide", source: "calculé" },
  { placeholder: "facturation.libelle_ttc", label: "\"Acompte\" ou \"Total\" (ligne TTC)", source: "calculé" },

  // ── Bulletin de Versement (scope mission) ─────────────────
  { placeholder: "numero_document", label: "Compteur du document dans l'étude (\"01\", \"02\"…)", source: "calculé" },
  { placeholder: "bv.base_urssaf", label: "Assiette forfaitaire par JEH (€)", source: "parametres.bv_base_urssaf" },
  { placeholder: "bv.assiette", label: "Assiette des cotisations (JEH × base)", source: "calculé" },
  { placeholder: "bv.retribution_par_jeh", label: "Rétribution brute par JEH", source: "calculé" },
  { placeholder: "bv.am_base", label: "Ligne Assurance Maladie (idem at/avp/avd/af/autre/csg/crdscsg : _nom, _base, _junior_montant, _etudiant_taux, _etudiant_montant)", source: "calculé depuis parametres bv_*" },
  { placeholder: "bv.total_junior", label: "Total cotisations part Junior", source: "calculé" },
  { placeholder: "bv.total_etudiant", label: "Total cotisations part étudiant", source: "calculé" },
  { placeholder: "bv.total_cotisations", label: "Total cotisations (Junior + étudiant)", source: "calculé" },
  { placeholder: "bv.net_paye", label: "Montant net payé", source: "calculé" },
  { placeholder: "bv.net_imposable", label: "Net imposable (net + CSG/CRDS non déductible)", source: "calculé" },
]

/** Returns fields filtered by a keyword (placeholder or label). */
export function searchFields(query: string): FieldDef[] {
  const q = query.toLowerCase()
  return DOCUMENT_FIELDS.filter(
    (f) => f.placeholder.toLowerCase().includes(q) || f.label.toLowerCase().includes(q)
  )
}
