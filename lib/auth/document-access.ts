import "server-only"
import { createAdminClient } from "@/lib/supabase/admin"
import { hasPermission } from "@/lib/auth/permissions"
import type { PersonneWithRole } from "@/types/database.types"

const INTERNE_SLUGS = new Set(["administrateur", "membre_ajc", "chef_de_projet"])

/**
 * Équivalent JS de la fonction SQL `public.is_membre_interne` (migration 050) :
 * accès complet au métier (études, missions, documents officiels).
 */
export function isMembreInterne(profile: PersonneWithRole | null): boolean {
  if (!profile) return false
  return (
    profile.account_status === "validated" &&
    INTERNE_SLUGS.has(profile.profils_types?.slug ?? "")
  )
}

/**
 * Équivalent JS de `public.is_mission_intervenant` : intervenant principal
 * (missions.intervenant_id) ou additionnel (mission_collaborations).
 */
async function isMissionIntervenant(missionId: string, userId: string): Promise<boolean> {
  const admin = createAdminClient()
  const [{ data: mission }, { data: collab }] = await Promise.all([
    admin.from("missions").select("intervenant_id").eq("id", missionId).maybeSingle(),
    admin
      .from("mission_collaborations")
      .select("id")
      .eq("mission_id", missionId)
      .eq("intervenant_id", userId)
      .maybeSingle(),
  ])
  return mission?.intervenant_id === userId || !!collab
}

/**
 * Équivalent JS de `public.intervient_sur_etude` : intervenant sur au moins
 * une mission de l'étude.
 */
async function intervientSurEtude(etudeId: string, userId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data: missions } = await admin
    .from("missions")
    .select("id, intervenant_id")
    .eq("etude_id", etudeId)
  if (!missions || missions.length === 0) return false
  if (missions.some((m: any) => m.intervenant_id === userId)) return true
  const missionIds = missions.map((m: any) => m.id)
  const { data: collab } = await admin
    .from("mission_collaborations")
    .select("id")
    .in("mission_id", missionIds)
    .eq("intervenant_id", userId)
    .limit(1)
  return !!collab && collab.length > 0
}

/**
 * Autorisation de lecture (liste/téléchargement/aperçu) des documents
 * générés d'une étude ou d'une mission : membre interne (accès complet),
 * ou intervenant du projet concerné (accès à son seul contexte).
 *
 * Miroir applicatif de la RLS (migration 060) — la RLS reste la dernière
 * ligne de défense (accès direct API REST Supabase), ce contrôle évite en
 * plus les allers-retours réseau inutiles et couvre les chemins qui passent
 * par le client admin (qui bypasse la RLS).
 */
export async function canAccessEntityDocuments(
  profile: PersonneWithRole | null,
  scope: string,
  entityId: string
): Promise<boolean> {
  if (!profile) return false
  if (isMembreInterne(profile)) return true
  // Facture : mêmes ayants droit que la page Trésorerie (Présidente,
  // Trésorier·ère, Pôle Trésorerie…), pas seulement les membres internes —
  // sinon le bouton « Télécharger » de /tresorerie renvoie 403 pour eux.
  if (scope === "facture") return hasPermission(profile, "voir_factures")
  if (scope === "mission") return isMissionIntervenant(entityId, profile.id)
  if (scope === "etude") return intervientSurEtude(entityId, profile.id)
  return false
}

/**
 * L'intervenant est-il rattaché à cette mission ? Même source de vérité que
 * `listMissionIntervenants` (lib/actions/documents.ts) : intervenant principal
 * (`missions.intervenant_id`), collaboration, ou candidature acceptée.
 */
export async function estIntervenantDeLaMission(missionId: string, personneId: string): Promise<boolean> {
  if (!missionId || !personneId) return false
  const admin = createAdminClient()
  const [{ data: mission }, { data: collab }, { data: candidature }] = await Promise.all([
    admin.from("missions").select("intervenant_id").eq("id", missionId).maybeSingle(),
    admin
      .from("mission_collaborations")
      .select("id")
      .eq("mission_id", missionId)
      .eq("intervenant_id", personneId)
      .maybeSingle(),
    admin
      .from("candidatures")
      .select("id")
      .eq("mission_id", missionId)
      .eq("personne_id", personneId)
      .eq("statut", "acceptee")
      .maybeSingle(),
  ])
  return mission?.intervenant_id === personneId || !!collab || !!candidature
}

/** L'intervenant est-il rattaché à au moins une mission de cette étude ? */
export async function estIntervenantDeLEtude(etudeId: string, personneId: string): Promise<boolean> {
  if (!etudeId || !personneId) return false
  const admin = createAdminClient()
  const { data: missions } = await admin.from("missions").select("id").eq("etude_id", etudeId)
  for (const m of missions ?? []) {
    if (await estIntervenantDeLaMission((m as { id: string }).id, personneId)) return true
  }
  return false
}
