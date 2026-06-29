import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { createAdminClient } from "@/lib/supabase/admin"
import { decryptData } from "@/lib/crypto"
import { getMasterKey } from "@/lib/crypto-key"
import { sendEmail } from "@/lib/email/send"
import { bulletinAdhesionEmail } from "@/lib/email/templates"
import {
  createSignatureRequest,
  isLiveConsentConfigured,
} from "@/lib/signature/liveconsent"
import { loadBaTemplate, fillBaPdf, pdfBytesToBase64 } from "@/lib/signature/ba-pdf"
import {
  BA_REQUIRED_DOC_TYPES,
  missingProfileFields,
  toE164FR,
  buildBaFieldValues,
  type MemberData,
} from "@/lib/signature/ba-utils"

// Ré-exports : ces helpers/constantes sont consommés via "@/lib/signature/ba".
export {
  BA_REQUIRED_PROFILE_FIELDS,
  BA_REQUIRED_DOC_TYPES,
  missingProfileFields,
  toE164FR,
  buildBaFieldValues,
  type MemberData,
} from "@/lib/signature/ba-utils"

/* ── Données membre (avec déchiffrement PII) ──────────────────────────────── */

function dec(
  enc: string | null,
  iv: string | null,
  tag: string | null,
  fallback: string | null,
  key: string,
  salt: string
): string | null {
  if (!enc || !iv || !tag) return fallback
  try {
    return decryptData(enc, iv, tag, key, salt)
  } catch {
    return fallback
  }
}

/**
 * Déchiffre les champs sensibles d'une ligne `personnes` brute (contexte serveur
 * de confiance : action admin ou cron — pas de contrôle d'accès par utilisateur).
 */
export function toMemberData(profile: any): MemberData {
  const salt: string | null = profile.encryption_salt ?? null
  const key = salt ? getMasterKey() : ""
  return {
    id: profile.id,
    email: profile.email,
    prenom: profile.prenom ?? null,
    nom: profile.nom ?? null,
    portable: profile.portable ?? null,
    promo: profile.promo ?? null,
    etablissement: profile.etablissement ?? null,
    scolarite: profile.scolarite ?? null,
    ba_auto: profile.ba_auto ?? true,
    account_status: profile.account_status ?? "pending_validation",
    adresse: salt ? dec(profile.adresse_encrypted, profile.adresse_iv, profile.adresse_auth_tag, profile.adresse, key, salt) : profile.adresse ?? null,
    ville: salt ? dec(profile.ville_encrypted, profile.ville_iv, profile.ville_auth_tag, profile.ville, key, salt) : profile.ville ?? null,
    code_postal: salt ? dec(profile.code_postal_encrypted, profile.code_postal_iv, profile.code_postal_auth_tag, profile.code_postal, key, salt) : profile.code_postal ?? null,
    date_naissance: salt ? dec(profile.date_naissance_encrypted, profile.date_naissance_iv, profile.date_naissance_auth_tag, profile.date_naissance, key, salt) : profile.date_naissance ?? null,
  }
}

/* ── Complétude ───────────────────────────────────────────────────────────── */

export async function getUploadedDocTypes(
  admin: SupabaseClient,
  personneId: string
): Promise<string[]> {
  const { data } = await admin
    .from("documents_personnes")
    .select("type")
    .eq("personne_id", personneId)
  return (data ?? []).map((d: any) => d.type)
}

export interface CompletenessResult {
  complete: boolean
  missingFields: string[]
  missingDocs: string[]
}

export async function checkMemberComplete(
  admin: SupabaseClient,
  m: MemberData
): Promise<CompletenessResult> {
  const missingFields = missingProfileFields(m)
  const uploaded = await getUploadedDocTypes(admin, m.id)
  const missingDocs = BA_REQUIRED_DOC_TYPES.filter((t) => !uploaded.includes(t))
  return {
    complete: missingFields.length === 0 && missingDocs.length === 0,
    missingFields,
    missingDocs,
  }
}

/* ── Réglages bureau / BA (stockés dans parametres) ───────────────────────── */

export interface BaSettings {
  presidentUserId: string | null
  tresorierUserId: string | null
  templatePath: string | null
  reminderDays: number[]
}

export async function getBaSettings(admin: SupabaseClient): Promise<BaSettings> {
  const { data } = await admin
    .from("parametres")
    .select("key, value")
    .in("key", ["president_user_id", "tresorier_user_id", "ba_template_path", "ba_reminder_days"])
  const map: Record<string, string> = {}
  for (const row of data ?? []) map[(row as any).key] = (row as any).value
  const reminderDays = (map.ba_reminder_days || "7,2")
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0)
  return {
    presidentUserId: map.president_user_id || null,
    tresorierUserId: map.tresorier_user_id || null,
    templatePath: map.ba_template_path || null,
    reminderDays: reminderDays.length ? reminderDays : [7, 2],
  }
}

/* ── Envoi du BA ──────────────────────────────────────────────────────────── */

export type SendBaResult =
  | { success: true; requestId: string }
  | { error: string }

const VALIDITY_DAYS = 30

/**
 * Construit le BA pré-rempli, l'envoie en signature LiveConsent (membre signataire
 * en ordre 1, présidente en ordre 2 quand elle est configurée et joignable),
 * enregistre la demande, notifie le membre (in-app + email).
 *
 * Contexte de confiance : appelé par l'action admin (après contrôle de rôle) ou
 * par le cron. `createdBy` est l'id de l'admin déclencheur (null pour le cron).
 */
export async function sendBA(
  personneId: string,
  opts: { auto: boolean; createdBy?: string | null; bureauUserId?: string | null } = { auto: true }
): Promise<SendBaResult> {
  const admin = createAdminClient()

  if (!isLiveConsentConfigured()) {
    return { error: "LiveConsent n'est pas configuré (clés API manquantes)." }
  }

  // Pas de doublon : une seule demande BA non archivée par membre.
  const { data: existing } = await admin
    .from("signature_requests")
    .select("id")
    .eq("personne_id", personneId)
    .eq("category", "ba")
    .eq("archived", false)
    .limit(1)
  if (existing && existing.length > 0) {
    return { error: "Un bulletin d'adhésion est déjà en cours pour ce membre." }
  }

  const { data: profile, error: pErr } = await admin
    .from("personnes")
    .select("*")
    .eq("id", personneId)
    .single()
  if (pErr || !profile) return { error: "Membre introuvable." }

  const member = toMemberData(profile)
  const completeness = await checkMemberComplete(admin, member)
  if (!completeness.complete) {
    return {
      error: `Profil incomplet : ${[...completeness.missingFields, ...completeness.missingDocs].join(", ")}`,
    }
  }

  const settings = await getBaSettings(admin)
  if (!settings.templatePath) {
    return { error: "Aucun template de bulletin d'adhésion n'est configuré." }
  }

  // 1) Construire le PDF pré-rempli.
  const templateBytes = await loadBaTemplate(settings.templatePath)
  if (!templateBytes) return { error: "Template du bulletin d'adhésion introuvable (Scaleway)." }
  const filled = await fillBaPdf(templateBytes, buildBaFieldValues(member))
  const pdfBase64 = pdfBytesToBase64(filled)

  // 2) Destinataires : membre (ordre 1) + présidente (ordre 2) si joignable.
  const memberPhone = toE164FR(member.portable)
  const recipients: Array<{ firstname: string; lastname: string; email: string; phone: string; order?: number; role: string }> = [
    { firstname: member.prenom ?? "", lastname: member.nom ?? "", email: member.email, phone: memberPhone, order: 1, role: "membre" },
  ]

  // Signataire bureau : présidente par défaut, ou override (trésorier en repli).
  const bureauUserId = opts.bureauUserId ?? settings.presidentUserId
  const bureauRole = opts.bureauUserId ? "tresorier" : "president"
  if (bureauUserId) {
    const { data: bureau } = await admin
      .from("personnes")
      .select("id, prenom, nom, email, portable")
      .eq("id", bureauUserId)
      .single()
    const bureauPhone = toE164FR((bureau as any)?.portable ?? null)
    if (bureau && (bureau as any).email && bureauPhone) {
      recipients.push({
        firstname: (bureau as any).prenom ?? "",
        lastname: (bureau as any).nom ?? "",
        email: (bureau as any).email,
        phone: bureauPhone,
        order: 2,
        role: bureauRole,
      })
    } else {
      console.warn("[ba] signataire bureau configuré mais email/téléphone manquant — envoi membre seul")
    }
  }

  const signInOrder = recipients.length > 1
  const requestName = `Bulletin d'adhésion — ${member.prenom ?? ""} ${member.nom ?? ""}`.trim()
  const filename = `bulletin-adhesion-${(member.nom ?? "membre").toLowerCase().replace(/\s+/g, "-")}.pdf`

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "")
  const callbackUrl = siteUrl.startsWith("https://") ? `${siteUrl}/api/signature/callback` : undefined

  try {
    const { requestId } = await createSignatureRequest({
      requestName,
      message: "Merci de signer votre bulletin d'adhésion à Audencia Junior Conseil.",
      pdfBase64,
      filename,
      recipients: recipients.map(({ role: _role, ...r }) => r),
      signInOrder,
      callbackUrl,
      validityDays: VALIDITY_DAYS,
    })

    const expiresAt = new Date(Date.now() + VALIDITY_DAYS * 24 * 3600 * 1000).toISOString()

    await admin.from("signature_requests").insert({
      lc_request_id: requestId,
      request_name: requestName,
      document_filename: filename,
      recipient_firstname: member.prenom,
      recipient_lastname: member.nom,
      recipient_email: member.email,
      status: "envoyee",
      category: "ba",
      personne_id: member.id,
      signers: recipients.map((r) => ({ role: r.role, email: r.email, order: r.order ?? 1, status: "en_attente" })),
      validity_days: VALIDITY_DAYS,
      expires_at: expiresAt,
      created_by: opts.createdBy ?? null,
    })

    // 3) Notifications membre : in-app (bannière) + email Be Fast.
    await notifyMember(admin, member.id, {
      type: "ba_to_sign",
      title: "Bulletin d'adhésion à signer",
      message: "Votre bulletin d'adhésion vous a été envoyé en signature. Consultez votre boîte mail (LiveConsent).",
    })
    const tpl = bulletinAdhesionEmail(member.prenom)
    await sendEmail({ to: member.email, subject: tpl.subject, html: tpl.html })

    return { success: true, requestId }
  } catch (e: any) {
    console.error("[ba] sendBA failed:", e?.message ?? e)
    return { error: e?.message ?? "Échec de l'envoi du bulletin d'adhésion." }
  }
}

/* ── Notifications in-app (table notifications, recipient_id) ──────────────── */

export async function notifyMember(
  admin: SupabaseClient,
  recipientId: string,
  n: { type: string; title: string; message?: string; data?: Record<string, any> }
): Promise<void> {
  const { error } = await admin.from("notifications").insert({
    type: n.type,
    title: n.title,
    message: n.message ?? null,
    data: n.data ?? null,
    recipient_id: recipientId,
    read: false,
  })
  if (error) console.error("[ba] notifyMember insert failed:", error.message)
}
