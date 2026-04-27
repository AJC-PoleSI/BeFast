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
]

/** Returns fields filtered by a keyword (placeholder or label). */
export function searchFields(query: string): FieldDef[] {
  const q = query.toLowerCase()
  return DOCUMENT_FIELDS.filter(
    (f) => f.placeholder.toLowerCase().includes(q) || f.label.toLowerCase().includes(q)
  )
}
