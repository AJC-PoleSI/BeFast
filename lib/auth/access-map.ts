import type { PermissionKey } from "@/types/database.types"

/**
 * CARTOGRAPHIE DES ACCÈS — source de vérité documentaire.
 *
 * Chaque surface protégée de l'application est déclarée ici avec la ou les
 * clés qui l'ouvrent (« au moins une des clés »). `lib/auth/access-map.test.ts`
 * vérifie que cette carte colle au code réel : toute clé du catalogue doit
 * avoir au moins une surface, et le fichier cité doit contenir le garde annoncé.
 *
 * Trois couches d'application coexistent, toutes alimentées par la même
 * résolution de permissions (rôle de base ∪ postes, l'administrateur passe) :
 *   - `page`   : layout serveur (lib/auth/page-guards) — bloque le rendu
 *   - `api`    : route handler (lib/auth/api-guards)   — 401/403
 *   - `action` : server action (lib/auth/action-guards) — { error }
 *   - `rls`    : politique Postgres (public.has_permission) — dernier rempart
 */
export type CoucheAcces = "page" | "api" | "action" | "rls"

export interface SurfaceProtegee {
  /** Libellé métier, en français, tel qu'il parle à un membre du bureau. */
  libelle: string
  couche: CoucheAcces
  /** Chemin du fichier qui porte le garde (vérifié par le test). */
  fichier: string
  /** Au moins une de ces clés ouvre la surface. Vide = réservé aux administrateurs. */
  cles: PermissionKey[]
  /** true si, en plus des clés, le rôle de base « administrateur » est exigé. */
  adminUniquement?: boolean
  /** Autre voie d'accès légitime (propriétaire de la ressource, etc.). */
  exception?: string
}

export const SURFACES: SurfaceProtegee[] = [
  // ── Pages ────────────────────────────────────────────────────────────────
  { libelle: "Accueil / tableau de bord", couche: "page", fichier: "app/(dashboard)/page.tsx", cles: ["dashboard"], exception: "sans la clé, redirection vers le profil" },
  { libelle: "Mon profil", couche: "page", fichier: "app/(dashboard)/dashboard/profil/layout.tsx", cles: ["profil"] },
  { libelle: "Fiche d'un autre membre", couche: "page", fichier: "app/(dashboard)/dashboard/profil/[userId]/layout.tsx", cles: ["membres", "voir_documents_membres", "voir_nss", "voir_rib"], exception: "consulter sa propre fiche" },
  { libelle: "Missions", couche: "page", fichier: "app/(dashboard)/missions/layout.tsx", cles: ["missions"] },
  { libelle: "Mes documents", couche: "page", fichier: "app/(dashboard)/documents/layout.tsx", cles: ["documents"] },
  { libelle: "Études", couche: "page", fichier: "app/(dashboard)/etudes/layout.tsx", cles: ["etudes"] },
  { libelle: "Prospection", couche: "page", fichier: "app/(dashboard)/prospection/layout.tsx", cles: ["prospection"] },
  { libelle: "Trésorerie", couche: "page", fichier: "app/(dashboard)/tresorerie/layout.tsx", cles: ["voir_factures"] },
  { libelle: "Statistiques", couche: "page", fichier: "app/(dashboard)/statistiques/layout.tsx", cles: ["statistiques"] },
  { libelle: "Espace administration (entrée)", couche: "page", fichier: "app/(dashboard)/administration/layout.tsx", cles: ["administration", "membres", "parametres_structure", "gerer_parametres"] },
  { libelle: "Administration ▸ Paramètres", couche: "page", fichier: "app/(dashboard)/administration/page.tsx", cles: ["parametres_structure"] },
  { libelle: "Administration ▸ Membres & Droits", couche: "page", fichier: "app/(dashboard)/administration/membres/layout.tsx", cles: ["membres"] },
  { libelle: "Administration ▸ Modèles de documents", couche: "page", fichier: "app/(dashboard)/administration/documents/layout.tsx", cles: ["administration", "gerer_parametres"] },
  { libelle: "Administration ▸ Données", couche: "page", fichier: "app/(dashboard)/administration/donnees/layout.tsx", cles: [], adminUniquement: true },
  { libelle: "Signatures électroniques", couche: "page", fichier: "app/(dashboard)/signatures/layout.tsx", cles: ["etudes", "signer_documents", "signer_ba"], exception: "signer son propre bulletin se fait par le lien LiveConsent reçu par email" },
  { libelle: "Administration ▸ Clients", couche: "page", fichier: "app/(dashboard)/administration/clients/layout.tsx", cles: ["administration", "prospection"] },

  // ── Routes API ───────────────────────────────────────────────────────────
  { libelle: "Paramètres de la structure (lecture/écriture)", couche: "api", fichier: "app/api/admin/parametres/route.ts", cles: ["parametres_structure"] },
  { libelle: "Champs personnalisés", couche: "api", fichier: "app/api/admin/custom-fields/route.ts", cles: ["gerer_parametres", "administration"] },
  { libelle: "Dépôt d'un modèle de document", couche: "api", fichier: "app/api/admin/templates/route.ts", cles: ["gerer_parametres", "administration"] },
  { libelle: "Téléchargement d'un modèle", couche: "api", fichier: "app/api/admin/templates/[id]/download/route.ts", cles: ["gerer_parametres", "administration"] },
  { libelle: "Justificatifs des membres (liste)", couche: "api", fichier: "app/api/admin/documents/route.ts", cles: ["voir_documents_membres"] },
  { libelle: "Valider / refuser un justificatif", couche: "api", fichier: "app/api/admin/documents/[id]/route.ts", cles: ["voir_documents_membres"] },
  { libelle: "Valider / suspendre un compte", couche: "api", fichier: "app/api/admin/personnes/[id]/route.ts", cles: ["valider_comptes"] },
  { libelle: "Explorateur de tables", couche: "api", fichier: "app/api/admin/explore/route.ts", cles: [], adminUniquement: true },
  { libelle: "Export CSV global", couche: "api", fichier: "app/api/admin/export/route.ts", cles: [], adminUniquement: true },
  { libelle: "Validation trésorerie", couche: "api", fichier: "app/api/tresorerie/validate/route.ts", cles: ["voir_factures"] },
  { libelle: "Export trésorerie", couche: "api", fichier: "app/api/tresorerie/export/route.ts", cles: ["voir_factures"] },
  { libelle: "PDF d'une facture", couche: "api", fichier: "app/api/factures/[id]/pdf/route.ts", cles: ["voir_factures"] },
  { libelle: "Téléchargement de pièce (notes de frais…)", couche: "api", fichier: "app/api/download/[type]/[id]/route.ts", cles: ["voir_factures"], exception: "propriétaire de la pièce" },
  { libelle: "Téléchargement d'un objet stocké", couche: "api", fichier: "app/api/storage/download/route.ts", cles: ["voir_factures"], exception: "intervenant de la mission" },
  { libelle: "Justificatifs d'un membre (liste / URL signée / ZIP)", couche: "api", fichier: "app/api/profil/documents/route.ts", cles: ["voir_documents_membres"], exception: "ses propres documents" },
  { libelle: "Son bulletin d'adhésion pré-rempli", couche: "api", fichier: "app/api/profil/documents/bulletin-adhesion/route.ts", cles: ["documents"] },
  { libelle: "Génération d'un document (Word / PDF)", couche: "api", fichier: "app/api/documents/generate/route.ts", cles: ["voir_factures"], exception: "créateur ou suiveur de l'étude (canEditEtude) ; Bulletin de Versement réservé aux administrateurs" },
  { libelle: "Proposition commerciale (PowerPoint)", couche: "api", fichier: "app/api/generate-ppt/route.ts", cles: ["prospection"] },

  // ── Server actions ───────────────────────────────────────────────────────
  { libelle: "Créer une étude", couche: "action", fichier: "lib/actions/etudes.ts", cles: ["nouvelle_mission"] },
  { libelle: "Créer une mission", couche: "action", fichier: "lib/actions/missions.ts", cles: ["nouvelle_mission"] },
  { libelle: "Modifier une étude", couche: "action", fichier: "lib/actions/etudes.ts", cles: ["modifier_etudes"], exception: "créateur ou suiveur (chef de projet) de l'étude" },
  { libelle: "Supprimer une étude", couche: "action", fichier: "lib/actions/etudes.ts", cles: ["modifier_etudes"], exception: "créateur de l'étude — le suiveur en est exclu (canDeleteEtude)" },
  { libelle: "Publier une étude", couche: "action", fichier: "lib/actions/etudes.ts", cles: ["publier_etudes"] },
  { libelle: "Publier une mission", couche: "action", fichier: "lib/actions/etudes.ts", cles: ["publier_missions"] },
  { libelle: "Accepter / refuser une candidature", couche: "action", fichier: "lib/actions/missions.ts", cles: ["selectionner_candidats", "assigner_intervenants"] },
  { libelle: "Affecter directement un intervenant (sans candidature)", couche: "action", fichier: "lib/actions/missions.ts", cles: ["selectionner_candidats", "assigner_intervenants"] },
  { libelle: "Paramètres de la structure & pôles", couche: "action", fichier: "lib/actions/etudes.ts", cles: ["parametres_structure"] },
  { libelle: "Enregistrer les paramètres", couche: "action", fichier: "lib/actions/parametres.ts", cles: ["parametres_structure"] },
  { libelle: "Marges recommandées (pilotage des prix)", couche: "action", fichier: "lib/actions/parametres.ts", cles: ["gerer_parametres", "voir_factures"] },
  { libelle: "Dictionnaire des balises", couche: "action", fichier: "lib/actions/tags.ts", cles: ["gerer_parametres", "administration"] },
  { libelle: "Modèles de documents (suppression / métadonnées)", couche: "action", fichier: "lib/actions/documents.ts", cles: ["administration", "gerer_parametres"] },
  { libelle: "Phases par défaut (pilotage)", couche: "action", fichier: "lib/actions/phases.ts", cles: ["gerer_parametres", "administration"] },
  { libelle: "Liste des membres", couche: "action", fichier: "lib/actions/members.ts", cles: ["membres"] },
  { libelle: "Rôles, postes et permissions (écriture)", couche: "action", fichier: "lib/actions/members.ts", cles: [], adminUniquement: true },
  { libelle: "Trésorerie (factures, paiements)", couche: "action", fichier: "lib/actions/tresorerie.ts", cles: ["voir_factures"] },
  { libelle: "Bulletins de versement des intervenants", couche: "action", fichier: "lib/actions/tresorerie.ts", cles: ["voir_factures", "valider_bv"] },
  { libelle: "Envoyer / lister les demandes de signature", couche: "action", fichier: "lib/actions/signature.ts", cles: ["etudes", "signer_documents", "signer_ba"] },
  { libelle: "File de signature du bureau", couche: "action", fichier: "lib/actions/signature.ts", cles: ["signer_documents", "signer_ba"] },
  { libelle: "Déchiffrement des PII d'un autre membre", couche: "action", fichier: "lib/actions/encryption.ts", cles: ["voir_nss", "voir_rib"], exception: "ses propres données" },
  { libelle: "Lire les études (liste, détail)", couche: "action", fichier: "lib/actions/etudes.ts", cles: ["etudes"] },
  { libelle: "Annuaire des membres et des clients (formulaire d'étude)", couche: "action", fichier: "lib/actions/etudes.ts", cles: ["etudes", "nouvelle_mission", "prospection"] },
  { libelle: "Gestion des clients (fiche complète, modification)", couche: "action", fichier: "lib/actions/etudes.ts", cles: ["administration", "prospection"] },
  { libelle: "Échéancier d'une étude (blocs)", couche: "action", fichier: "lib/actions/etudes.ts", cles: ["modifier_etudes"], exception: "créateur ou suiveur (chef de projet) de l'étude" },
  { libelle: "Signer la CE d'une proposition (création de l'étude)", couche: "action", fichier: "lib/actions/propositions.ts", cles: ["prospection"] },
  { libelle: "Marges recommandées (lecture)", couche: "action", fichier: "lib/actions/parametres.ts", cles: ["voir_factures", "gerer_parametres", "prospection"] },
  { libelle: "Pilotage des phases (statistiques, suggestions)", couche: "action", fichier: "lib/actions/phases.ts", cles: ["prospection", "gerer_parametres", "administration"] },
  { libelle: "Catalogue des postes", couche: "action", fichier: "lib/actions/members.ts", cles: ["membres"] },

  // ── RLS (dernier rempart, public.has_permission) ──────────────────────────
  { libelle: "Écriture des missions", couche: "rls", fichier: "supabase/migrations/070_suiveurs_gerent_leur_etude.sql", cles: ["modifier_etudes", "publier_missions", "voir_factures"], exception: "créateur ou suiveur (chef de projet) de l'étude" },
  { libelle: "Suppression d'une étude", couche: "rls", fichier: "supabase/migrations/056_rls_suppression_etudes.sql", cles: ["modifier_etudes"], exception: "créateur de l'étude" },
  { libelle: "Décision sur une candidature", couche: "rls", fichier: "supabase/migrations/055_droits_candidatures_nss_rib.sql", cles: ["selectionner_candidats"] },
]

/** Clés qui ouvrent au moins une surface (utilisé par le test anti-clé morte). */
export function clesCouvertes(): Set<PermissionKey> {
  const set = new Set<PermissionKey>()
  for (const s of SURFACES) for (const k of s.cles) set.add(k)
  return set
}
