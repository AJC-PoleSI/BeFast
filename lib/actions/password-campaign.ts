"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export interface CampaignMember {
  id: string
  email: string
  prenom: string | null
  nom: string | null
  sentAt: string | null
  setAt: string | null
}

export interface CampaignStatus {
  total: number
  sent: number
  pending: number
  set: number
  members: CampaignMember[]
}

async function callerIsAdmin(): Promise<boolean> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const admin = createAdminClient()
  const { data } = await admin
    .from("personnes")
    .select("profils_types!profil_type_id(slug)")
    .eq("id", user.id)
    .single()
  return (data?.profils_types as any)?.slug === "administrateur"
}

/**
 * Statut de la campagne « définir mon mot de passe » sur les comptes migrés
 * (legacy_bequick_id non nul). Admin uniquement.
 */
export async function getCampaignStatus(): Promise<{ data: CampaignStatus | null; error: string | null }> {
  try {
    if (!(await callerIsAdmin())) return { data: null, error: "Non autorisé" }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from("personnes")
      .select("id, email, prenom, nom, password_setup_sent_at, password_set_at")
      .not("legacy_bequick_id", "is", null)
      .order("nom", { ascending: true })

    if (error) {
      // Colonnes absentes → migration 043 pas encore appliquée.
      return { data: null, error: "Migration 043 non appliquée (colonnes de suivi manquantes)." }
    }

    const members: CampaignMember[] = (data ?? []).map((r: any) => ({
      id: r.id,
      email: r.email,
      prenom: r.prenom,
      nom: r.nom,
      sentAt: r.password_setup_sent_at,
      setAt: r.password_set_at,
    }))

    const sent = members.filter((m) => m.sentAt).length
    const set = members.filter((m) => m.setAt).length
    return {
      data: { total: members.length, sent, pending: members.length - sent, set, members },
      error: null,
    }
  } catch (e) {
    console.error("[getCampaignStatus]", e)
    return { data: null, error: "Erreur serveur" }
  }
}

/**
 * Marque le compte de l'utilisateur courant comme « mot de passe défini ».
 * Appelé depuis /reset-password après un updateUser réussi. Premier stamp
 * uniquement (préserve la date initiale).
 */
export async function confirmPasswordSetup(): Promise<{ success: boolean }> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false }
    const admin = createAdminClient()
    await admin
      .from("personnes")
      .update({ password_set_at: new Date().toISOString() })
      .eq("id", user.id)
      .is("password_set_at", null)
    return { success: true }
  } catch (e) {
    console.error("[confirmPasswordSetup]", e)
    return { success: false }
  }
}
