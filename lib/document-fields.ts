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

  // ── Client ────────────────────────────────────────────────
  { placeholder: "client.nom", label: "Nom du client", source: "clients.nom" },
  { placeholder: "client.secteur", label: "Secteur d'activité", source: "clients.secteur" },
  { placeholder: "client.contact_nom", label: "Nom du contact", source: "clients.contact_nom" },
  { placeholder: "client.contact_email", label: "Email du contact", source: "clients.contact_email" },
  { placeholder: "client.contact_phone", label: "Téléphone du contact", source: "clients.contact_phone" },

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

  // ── Phases / Planning ─────────────────────────────────────
  { placeholder: "nb_jeh", label: "Total JEH (racine)", source: "calculé depuis echeancier_blocs" },
  { placeholder: "nb_phases", label: "Nombre de phases (racine)", source: "calculé depuis echeancier_blocs" },
  { placeholder: "phases", label: "Tableau de phases (boucle {#phases})", source: "echeancier_blocs" },

  // ── Facture (scope = "facture") ───────────────────────────
  { placeholder: "facture.numero", label: "Numéro de facture", source: "factures.numero", example: "2615-F01" },
  { placeholder: "facture.numero_dans_etude", label: "Numéro dans l'étude", source: "factures.numero_dans_etude", example: "1" },
  { placeholder: "facture.nom", label: "Nom de la facture", source: "factures.nom", example: "Facture d'acompte" },
  { placeholder: "facture.type", label: "Type (acompte / intermediaire / solde)", source: "factures.type" },
  { placeholder: "facture.type_libelle", label: "Type lisible (d'acompte / intermédiaire / de solde)", source: "calculé" },
  { placeholder: "facture.is_acompte", label: "Booléen : est-ce un acompte ?", source: "calculé" },
  { placeholder: "facture.is_intermediaire", label: "Booléen : est-ce une PVRI ?", source: "calculé" },
  { placeholder: "facture.is_solde", label: "Booléen : est-ce un solde ?", source: "calculé" },
  { placeholder: "facture.montant_ht", label: "Montant HT total (formaté)", source: "factures.montant_ht", example: "3 000,00" },
  { placeholder: "facture.montant_ht_brut", label: "Montant HT (nombre brut)", source: "calculé", example: "3000" },
  { placeholder: "facture.montant_ttc", label: "Montant TTC (HT + TVA)", source: "calculé" },
  { placeholder: "facture.net_a_payer", label: "Net à payer", source: "calculé" },
  { placeholder: "facture.tva_taux", label: "Taux de TVA (%)", source: "parametres.tva_taux" },
  { placeholder: "facture.tva_montant", label: "Montant TVA", source: "calculé" },
  { placeholder: "facture.date_emission", label: "Date d'émission (DD/MM/YYYY)", source: "factures.date_emission" },
  { placeholder: "facture.date_echeance", label: "Date d'échéance (DD/MM/YYYY)", source: "factures.date_echeance" },
  { placeholder: "facture.date_paiement", label: "Date de paiement (DD/MM/YYYY)", source: "factures.date_paiement" },
  { placeholder: "facture.statut", label: "Statut (payée / en_attente)", source: "calculé" },
  { placeholder: "facture.notes", label: "Notes", source: "factures.notes" },
  { placeholder: "facture.reference_avenant", label: "Référence avenant (vide si aucun)", source: "factures.reference_avenant" },

  // ── Alias FACTURATION (compatibilité avec ton template) ───
  { placeholder: "facturation.numero_global", label: "Numéro complet (alias de facture.numero)", source: "factures.numero" },
  { placeholder: "facturation.type", label: "Type (alias)", source: "factures.type" },
  { placeholder: "facturation.emitted_at", label: "Date d'émission (alias)", source: "factures.date_emission" },
  { placeholder: "facturation.due_at", label: "Date d'échéance (alias)", source: "factures.date_echeance" },
  { placeholder: "facturation.montant_total", label: "Montant total HT (alias)", source: "factures.montant_ht" },

  // ── Lignes de facture (boucle {#lignes}) ──────────────────
  { placeholder: "lignes", label: "Tableau des lignes (boucle {#lignes})", source: "facture_lignes" },
  { placeholder: "lignes.libelle", label: "  → Libellé (= nom de phase)", source: "facture_lignes.libelle" },
  { placeholder: "lignes.nom", label: "  → Alias de libellé", source: "facture_lignes.libelle" },
  { placeholder: "lignes.montant", label: "  → Montant HT facturé (formaté)", source: "facture_lignes.montant" },
  { placeholder: "lignes.montant_brut", label: "  → Montant HT (nombre brut)", source: "facture_lignes.montant" },
  { placeholder: "lignes.montant_total", label: "  → Montant total phase", source: "facture_lignes.montant_total" },
  { placeholder: "lignes.pourcentage", label: "  → % facturé", source: "facture_lignes.pourcentage" },
  { placeholder: "lignes.type", label: "  → Type (phase / frais)", source: "facture_lignes.type" },
  { placeholder: "lignes.nombre_jeh", label: "  → Nombre de JEH (inféré)", source: "calculé depuis bloc.jeh" },
  { placeholder: "lignes.prix_jeh", label: "  → Prix unitaire JEH (€/JEH formaté)", source: "calculé" },
  { placeholder: "lignes.prix_unitaire", label: "  → Alias prix_jeh", source: "calculé" },

  // ── Alias JUNIOR (depuis parametres) ──────────────────────
  { placeholder: "junior.raison_sociale", label: "Raison sociale JE", source: "parametres.raison_sociale" },
  { placeholder: "junior.statut_juridique", label: "Statut juridique (Association loi 1901…)", source: "parametres.statut_juridique" },
  { placeholder: "junior.adresse1", label: "Adresse ligne 1", source: "parametres.adresse_1" },
  { placeholder: "junior.adresse2", label: "Adresse ligne 2", source: "parametres.adresse_2" },
  { placeholder: "junior.code_postal", label: "Code postal", source: "parametres.code_postal" },
  { placeholder: "junior.ville", label: "Ville", source: "parametres.ville" },
  { placeholder: "junior.siret", label: "SIRET", source: "parametres.siret" },
  { placeholder: "junior.siren", label: "SIREN", source: "parametres.siren" },
  { placeholder: "junior.code_ape", label: "Code APE", source: "parametres.code_ape" },
  { placeholder: "junior.n_urssaf", label: "N° URSSAF", source: "parametres.numero_urssaf" },
  { placeholder: "junior.n_tva_intra", label: "N° TVA intracommunautaire", source: "parametres.numero_tva" },
  { placeholder: "junior.banque_rib", label: "RIB", source: "parametres.banque_rib" },
  { placeholder: "junior.banque_domiciliation", label: "Domiciliation bancaire", source: "parametres.banque_domiciliation" },
  { placeholder: "junior.banque_iban", label: "IBAN (alias)", source: "parametres.iban" },
  { placeholder: "junior.banque_bic", label: "BIC (alias)", source: "parametres.bic" },
  { placeholder: "junior.ordre_cheques", label: "À l'ordre de (chèques)", source: "parametres.ordre_cheques" },

  // ── Alias ENTREPRISE (= client) ───────────────────────────
  { placeholder: "entreprise.nom", label: "Nom de l'entreprise cliente", source: "clients.nom" },
  { placeholder: "entreprise.adresse", label: "Adresse client", source: "clients.adresse" },
  { placeholder: "entreprise.code_postal", label: "Code postal client", source: "clients.code_postal" },
  { placeholder: "entreprise.ville", label: "Ville client", source: "clients.ville" },
  { placeholder: "entreprise.pays", label: "Pays client (France par défaut)", source: "clients.pays" },
  { placeholder: "entreprise.email", label: "Email client", source: "clients.email" },
  { placeholder: "entreprise.telephone", label: "Téléphone client", source: "clients.telephone" },

  // ── Alias SIGNATAIRE (contact signataire chez le client) ──
  { placeholder: "signataire.civilite", label: "Civilité (Monsieur/Madame)", source: "clients.contact_civilite" },
  { placeholder: "signataire.prenom", label: "Prénom du signataire", source: "clients.contact_prenom" },
  { placeholder: "signataire.nom", label: "Nom du signataire", source: "clients.contact_nom" },
  { placeholder: "signataire.fonction", label: "Fonction du signataire", source: "clients.contact_fonction" },
  { placeholder: "signataire.email", label: "Email du signataire", source: "clients.contact_email" },

  // ── TVA ────────────────────────────────────────────────────
  { placeholder: "tva", label: "Taux de TVA en %", source: "parametres.tva_taux", example: "0 (art. 293 B)" },

  // ── Étude (compléments pour facturation) ─────────────────
  { placeholder: "etude.numero_court", label: "Numéro d'étude (2 derniers chiffres)", source: "calculé", example: "15" },
  { placeholder: "etude.reference_dernier_avenant", label: "Ref avenant (sinon '0')", source: "factures.reference_avenant" },
]

/** Returns fields filtered by a keyword (placeholder or label). */
export function searchFields(query: string): FieldDef[] {
  const q = query.toLowerCase()
  return DOCUMENT_FIELDS.filter(
    (f) => f.placeholder.toLowerCase().includes(q) || f.label.toLowerCase().includes(q)
  )
}
