"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { siteUrl } from "@/lib/auth/verification"
import { sendEmail } from "@/lib/email/send"
import { passwordSetupEmail } from "@/lib/email/templates"

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export interface CampaignMember {
  id: string
  email: string
  prenom: string | null
  nom: string | null
  roleSlug: string | null
  roleName: string | null
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
      .select(
        "id, email, prenom, nom, password_setup_sent_at, password_set_at, profils_types!profil_type_id(slug, nom)"
      )
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
      roleSlug: r.profils_types?.slug ?? null,
      roleName: r.profils_types?.nom ?? null,
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

/**
 * Envoie le prochain LOT de mails « définis ton mot de passe » aux comptes
 * migrés (legacy_bequick_id non nul) PAS ENCORE contactés. Admin uniquement.
 * Même logique que scripts/send-password-setup.ts, mais déclenchable depuis
 * l'UI. Plafonné (≤ 200) pour rester sous le timeout d'une fonction Vercel.
 * Chaque envoi réussi stamp `password_setup_sent_at` → jamais de doublon.
 */
export async function sendPasswordSetupBatch(
  limit = 100
): Promise<{ sent: number; failed: number; error: string | null }> {
  try {
    if (!(await callerIsAdmin())) return { sent: 0, failed: 0, error: "Non autorisé" }

    // Garde-fou : ne jamais envoyer de liens localhost à de vrais destinataires.
    const site = siteUrl()
    if (/localhost|127\.0\.0\.1/.test(site)) {
      return {
        sent: 0,
        failed: 0,
        error:
          "NEXT_PUBLIC_SITE_URL pointe vers localhost — configure le domaine avant d'envoyer.",
      }
    }

    const batch = Math.max(1, Math.min(Math.floor(limit) || 100, 200))
    const admin = createAdminClient()

    const { data, error } = await admin
      .from("personnes")
      .select("id, email, prenom")
      .not("legacy_bequick_id", "is", null)
      .is("password_setup_sent_at", null)
      .order("nom", { ascending: true })
      .limit(batch)

    if (error) return { sent: 0, failed: 0, error: "Lecture des cibles échouée." }
    const targets = data ?? []

    let sent = 0
    let failed = 0
    for (const t of targets as any[]) {
      const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
        type: "recovery",
        email: t.email as string,
        options: { redirectTo: `${site}/reset-password` },
      })
      if (linkErr || !link?.properties?.action_link) {
        failed++
        continue
      }
      const url = new URL(link.properties.action_link)
      const token = url.searchParams.get("token")
      const customLink = token ? `${site}/reset-password?token_hash=${token}` : link.properties.action_link

      const tpl = passwordSetupEmail({
        prenom: (t.prenom as string) ?? null,
        link: customLink,
      })
      const res = await sendEmail({ to: t.email as string, subject: tpl.subject, html: tpl.html })
      if (!res.ok) {
        failed++
        continue
      }
      // Marque comme contacté (évite le renvoi au prochain lot). Idempotent.
      await admin
        .from("personnes")
        .update({ password_setup_sent_at: new Date().toISOString() })
        .eq("id", t.id)
        .is("password_setup_sent_at", null)
      sent++
      await sleep(200) // throttle : ménage les limites Resend
    }

    return { sent, failed, error: null }
  } catch (e) {
    console.error("[sendPasswordSetupBatch]", e)
    return { sent: 0, failed: 0, error: "Erreur serveur" }
  }
}

/**
 * Envoie le mail « définis ton mot de passe » à UN seul compte migré.
 * Admin uniquement. Idempotent (ne renvoie pas si déjà contacté).
 */
export async function sendPasswordSetupSingle(
  userId: string
): Promise<{ ok: boolean; error: string | null }> {
  try {
    if (!(await callerIsAdmin())) return { ok: false, error: "Non autorisé" }

    const site = siteUrl()
    if (/localhost|127\.0\.0\.1/.test(site)) {
      return { ok: false, error: "NEXT_PUBLIC_SITE_URL pointe vers localhost." }
    }

    const admin = createAdminClient()
    const { data: person, error: fetchErr } = await admin
      .from("personnes")
      .select("id, email, prenom")
      .eq("id", userId)
      .not("legacy_bequick_id", "is", null)
      .single()

    if (fetchErr || !person) return { ok: false, error: "Compte introuvable." }

    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: person.email as string,
      options: { redirectTo: `${site}/reset-password` },
    })
    if (linkErr || !link?.properties?.action_link) {
      return { ok: false, error: "Impossible de générer le lien de réinitialisation." }
    }
    const url = new URL(link.properties.action_link)
    const token = url.searchParams.get("token")
    const customLink = token ? `${site}/reset-password?token_hash=${token}` : link.properties.action_link

    const tpl = passwordSetupEmail({
      prenom: (person.prenom as string) ?? null,
      link: customLink,
    })
    const res = await sendEmail({ to: person.email as string, subject: tpl.subject, html: tpl.html })
    if (!res.ok) return { ok: false, error: `Échec d'envoi de l'email (${res.error ?? "inconnu"}).` }

    await admin
      .from("personnes")
      .update({ password_setup_sent_at: new Date().toISOString() })
      .eq("id", person.id)

    return { ok: true, error: null }
  } catch (e) {
    console.error("[sendPasswordSetupSingle]", e)
    return { ok: false, error: "Erreur serveur" }
  }
}
