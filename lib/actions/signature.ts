"use server"

import { revalidatePath } from "next/cache"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getCachedProfile } from "@/lib/auth/cached-profile"
import {
  createSignatureRequest,
  getRequestStatus,
  abandonRequest,
  isLiveConsentConfigured,
} from "@/lib/signature/liveconsent"
import { sendEmail } from "@/lib/email/send"
import { documentToSignEmail } from "@/lib/email/templates"
import {
  sendBA,
  missingProfileFieldsFromRow,
  getBaSettings,
  getBaTemplatePath,
  bureauRoles,
  BA_REQUIRED_DOC_TYPES,
} from "@/lib/signature/ba"

const MAX_PDF_BYTES = 7 * 1024 * 1024 // garde sous la limite du body des server actions

export type SignatureRequestRow = {
  id: string
  lc_request_id: string
  request_name: string
  document_filename: string
  recipient_firstname: string | null
  recipient_lastname: string | null
  recipient_email: string
  status: string
  last_event_at: string | null
  created_at: string
}

export async function getSignatureConfig() {
  return { configured: isLiveConsentConfigured() }
}

/**
 * Signature en attente pour le membre connecté (sa propre demande BA non
 * archivée et non signée) — alimente la bannière du dashboard membre.
 */
export async function getMyPendingSignature(): Promise<{
  pending: boolean
  requestName?: string
  daysLeft?: number | null
}> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { pending: false }

  const admin = createAdminClient()
  const { data } = await admin
    .from("signature_requests")
    .select("request_name, status, expires_at")
    .eq("personne_id", user.id)
    .eq("archived", false)
    .order("created_at", { ascending: false })
    .limit(1)
  const row = (data ?? [])[0] as any
  if (!row) return { pending: false }
  if (SIGNED_STATUSES.includes(String(row.status).toLowerCase())) return { pending: false }
  const daysLeft = row.expires_at
    ? Math.ceil((new Date(row.expires_at).getTime() - Date.now()) / 86_400_000)
    : null
  return { pending: true, requestName: row.request_name, daysLeft }
}

/** Droits d'affichage des onglets : admin (BA) et bureau (file de signature). */
export async function getSignaturesAccess(): Promise<{ isAdmin: boolean; isBureau: boolean }> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { isAdmin: false, isBureau: false }

  // Rôle lu depuis le profil en cache (partagé avec le layout → 0 requête sur cache chaud).
  const profile = await getCachedProfile(user.id)
  const isAdmin = profile?.profils_types?.slug === "administrateur"

  const admin = createAdminClient()
  const settings = await getBaSettings(admin)
  // Bureau = peut voir au moins un type de document à signer (BA ou autres).
  const isBureau = bureauRoles(user.id, settings, isAdmin).canBA

  return { isAdmin, isBureau }
}

export async function listSignatureRequests(): Promise<
  { data: SignatureRequestRow[] } | { error: string }
> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Non authentifié" }

  const { data, error } = await supabase
    .from("signature_requests")
    .select(
      "id, lc_request_id, request_name, document_filename, recipient_firstname, recipient_lastname, recipient_email, status, last_event_at, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(100)
  if (error) return { error: error.message }
  return { data: (data ?? []) as SignatureRequestRow[] }
}

export async function sendDocumentForSignature(formData: FormData) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Non authentifié" }

  if (!isLiveConsentConfigured()) {
    return {
      error:
        "LiveConsent n'est pas configuré : renseignez LIVECONSENT_USERNAME / LIVECONSENT_DEVELOPER_KEY / LIVECONSENT_SECRET_KEY dans les variables d'environnement.",
    }
  }

  const file = formData.get("file") as File | null
  const requestName = String(formData.get("requestName") ?? "").trim()
  const message = String(formData.get("message") ?? "").trim()
  const firstname = String(formData.get("firstname") ?? "").trim()
  const lastname = String(formData.get("lastname") ?? "").trim()
  const email = String(formData.get("email") ?? "").trim()
  const phone = String(formData.get("phone") ?? "").trim()

  if (!file || file.size === 0) return { error: "Aucun fichier fourni." }
  if (!file.name.toLowerCase().endsWith(".pdf"))
    return { error: "Seuls les PDF peuvent être envoyés en signature." }
  if (file.size > MAX_PDF_BYTES)
    return { error: "PDF trop volumineux (max 7 Mo)." }
  if (!requestName || !firstname || !lastname || !email || !phone)
    return { error: "Tous les champs signataire sont obligatoires (téléphone inclus : requis par LiveConsent)." }

  const pdfBase64 = Buffer.from(await file.arrayBuffer()).toString("base64")
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "")
  const callbackUrl = siteUrl.startsWith("https://")
    ? `${siteUrl}/api/signature/callback`
    : undefined // LiveConsent exige une URL HTTPS — pas de callback en localhost

  try {
    const { requestId } = await createSignatureRequest({
      requestName,
      message: message || undefined,
      pdfBase64,
      filename: file.name,
      recipients: [{ firstname, lastname, email, phone }],
      callbackUrl,
    })

    const admin = createAdminClient()
    const { error: dbErr } = await admin.from("signature_requests").insert({
      lc_request_id: requestId,
      request_name: requestName,
      document_filename: file.name,
      recipient_firstname: firstname,
      recipient_lastname: lastname,
      recipient_email: email,
      status: "envoyee",
      created_by: user.id,
    })
    if (dbErr) console.error("[signature] insert failed:", dbErr.message)

    // Notification best-effort (LiveConsent envoie aussi son propre email).
    const tpl = documentToSignEmail({
      recipientName: `${firstname} ${lastname}`.trim() || null,
      documentName: file.name,
      requestName,
    })
    await sendEmail({ to: email, subject: tpl.subject, html: tpl.html })

    revalidatePath("/signatures")
    return { success: true, requestId }
  } catch (e: any) {
    console.error("[signature] send failed:", e?.message ?? e)
    return { error: e?.message ?? "Échec de l'envoi à LiveConsent." }
  }
}

/** Re-synchronise le statut d'une demande depuis LiveConsent (bouton Actualiser). */
export async function refreshSignatureStatus(id: string) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Non authentifié" }
  if (!isLiveConsentConfigured()) return { error: "LiveConsent non configuré." }

  const { data: row } = await supabase
    .from("signature_requests")
    .select("lc_request_id")
    .eq("id", id)
    .single()
  if (!row) return { error: "Demande introuvable." }

  const status = await getRequestStatus(row.lc_request_id)
  if (status === null) return { error: "Statut indisponible côté LiveConsent." }

  const admin = createAdminClient()
  await admin
    .from("signature_requests")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)

  revalidatePath("/signatures")
  return { success: true, status }
}

/* ════════════════════════════════════════════════════════════════════════════
 * Bulletins d'adhésion (BA) — administration
 * ══════════════════════════════════════════════════════════════════════════ */

/** Garde admin pour les actions BA/bureau. Renvoie l'id appelant ou une erreur. */
async function requireAdmin(): Promise<{ userId: string; admin: SupabaseClient } | { error: string }> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Non authentifié" }
  const admin = createAdminClient()
  const { data: caller } = await admin
    .from("personnes")
    .select("profils_types(slug)")
    .eq("id", user.id)
    .single()
  if ((caller?.profils_types as any)?.slug !== "administrateur") {
    return { error: "Réservé aux administrateurs." }
  }
  return { userId: user.id, admin }
}

const SIGNED_STATUSES = ["signed", "completed", "signe", "termine"]

export type BAMemberRow = {
  id: string
  prenom: string | null
  nom: string | null
  email: string
  created_at: string
  account_status: string
  complete: boolean
  missing: string[]
  ba_status: string | null
  ba_sent_at: string | null
  ba_archived: boolean
  days_since_sent: number | null
}

/** Liste des membres (récents d'abord) avec leur statut BA + complétude. */
export async function listBAMembers(): Promise<{ data: BAMemberRow[] } | { error: string }> {
  const guard = await requireAdmin()
  if ("error" in guard) return { error: guard.error }
  const { admin } = guard

  // Sélection ciblée (pas de SELECT *) : juste de quoi calculer la complétude
  // par présence, sans rapatrier les blobs chiffrés inutiles.
  const { data: people, error } = await admin
    .from("personnes")
    .select(
      "id, prenom, nom, email, created_at, account_status, portable, etablissement, scolarite, " +
        "adresse, ville, code_postal, date_naissance, " +
        "adresse_encrypted, ville_encrypted, code_postal_encrypted, date_naissance_encrypted"
    )
    .order("created_at", { ascending: false })
    .limit(200)
  if (error) return { error: error.message }

  const ids = (people ?? []).map((p: any) => p.id)

  // Documents téléversés (groupés par membre) en une seule requête.
  const { data: docs } = await admin
    .from("documents_personnes")
    .select("personne_id, type")
    .in("personne_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"])
  const docsByMember = new Map<string, Set<string>>()
  for (const d of docs ?? []) {
    const set = docsByMember.get((d as any).personne_id) ?? new Set<string>()
    set.add((d as any).type)
    docsByMember.set((d as any).personne_id, set)
  }

  // Dernière demande BA par membre.
  const { data: baReqs } = await admin
    .from("signature_requests")
    .select("personne_id, status, created_at, archived")
    .eq("category", "ba")
    .in("personne_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"])
    .order("created_at", { ascending: false })
  const baByMember = new Map<string, any>()
  for (const r of baReqs ?? []) {
    const pid = (r as any).personne_id
    if (pid && !baByMember.has(pid)) baByMember.set(pid, r)
  }

  const now = Date.now()
  const rows: BAMemberRow[] = (people ?? []).map((p: any) => {
    const missingFields = missingProfileFieldsFromRow(p)
    const uploaded = docsByMember.get(p.id) ?? new Set<string>()
    const missingDocs = BA_REQUIRED_DOC_TYPES.filter((t) => !uploaded.has(t))
    const missing = [...missingFields, ...missingDocs]
    const ba = baByMember.get(p.id)
    const sentAt = ba?.created_at ?? null
    return {
      id: p.id,
      prenom: p.prenom ?? null,
      nom: p.nom ?? null,
      email: p.email,
      created_at: p.created_at,
      account_status: p.account_status ?? "pending_validation",
      complete: missing.length === 0,
      missing,
      ba_status: ba?.status ?? null,
      ba_sent_at: sentAt,
      ba_archived: ba?.archived ?? false,
      days_since_sent: sentAt ? Math.floor((now - new Date(sentAt).getTime()) / 86_400_000) : null,
    }
  })

  return { data: rows }
}

/** Envoi manuel du BA à un membre (bouton « Envoyer le BA »). */
export async function sendBAAction(personneId: string) {
  const guard = await requireAdmin()
  if ("error" in guard) return { error: guard.error }
  const res = await sendBA(personneId, { auto: false, createdBy: guard.userId })
  revalidatePath("/signatures")
  return res
}

/** Active/désactive l'envoi automatique du BA globalement (un seul réglage). */
export async function setBaAutoGlobal(value: boolean) {
  const guard = await requireAdmin()
  if ("error" in guard) return { error: guard.error }
  const { error } = await guard.admin.from("parametres").upsert({
    key: "ba_auto_global",
    value: value ? "true" : "false",
    updated_at: new Date().toISOString(),
  })
  if (error) return { error: error.message }
  revalidatePath("/signatures")
  return { success: true }
}

/* ── Réglages bureau / template BA ────────────────────────────────────────── */

export async function getBaAdminSettings() {
  const guard = await requireAdmin()
  if ("error" in guard) return { error: guard.error }
  const settings = await getBaSettings(guard.admin)
  const templatePath = await getBaTemplatePath(guard.admin)
  const { data: users } = await guard.admin
    .from("personnes")
    .select("id, prenom, nom, email")
    .eq("actif", true)
    .order("nom", { ascending: true })
  return {
    data: {
      presidentUserId: settings.presidentUserId,
      tresorierUserId: settings.tresorierUserId,
      rhUserId: settings.rhUserId,
      templateConfigured: Boolean(templatePath),
      reminderDays: settings.reminderDays.join(","),
      autoGlobal: settings.autoGlobal,
      users: (users ?? []).map((u: any) => ({
        id: u.id,
        label: `${u.prenom ?? ""} ${u.nom ?? ""}`.trim() || u.email,
      })),
    },
  }
}

export async function saveBaAdminSettings(values: {
  presidentUserId?: string | null
  tresorierUserId?: string | null
  rhUserId?: string | null
  reminderDays?: string
}) {
  const guard = await requireAdmin()
  if ("error" in guard) return { error: guard.error }
  const rows = [
    { key: "president_user_id", value: values.presidentUserId ?? "" },
    { key: "tresorier_user_id", value: values.tresorierUserId ?? "" },
    { key: "rh_user_id", value: values.rhUserId ?? "" },
    { key: "ba_reminder_days", value: values.reminderDays ?? "7,2" },
  ].map((r) => ({ ...r, updated_at: new Date().toISOString() }))
  const { error } = await guard.admin.from("parametres").upsert(rows)
  if (error) return { error: error.message }
  revalidatePath("/signatures")
  return { success: true }
}

/* ════════════════════════════════════════════════════════════════════════════
 * File du bureau (présidente / trésorier)
 * ══════════════════════════════════════════════════════════════════════════ */

export type BureauQueueRow = {
  id: string
  request_name: string
  document_filename: string
  category: string
  status: string
  created_at: string
  expires_at: string | null
  signers: any[]
}

/**
 * Vérifie que l'appelant est un signataire du bureau (présidente/trésorier) ou
 * admin. Renvoie les demandes en attente de signature du bureau.
 */
export async function listBureauQueue(): Promise<{ data: BureauQueueRow[]; role: string } | { error: string }> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Non authentifié" }

  const admin = createAdminClient()
  const settings = await getBaSettings(admin)
  const { data: caller } = await admin
    .from("personnes")
    .select("profils_types(slug)")
    .eq("id", user.id)
    .single()
  const isAdmin = (caller?.profils_types as any)?.slug === "administrateur"
  const roles = bureauRoles(user.id, settings, isAdmin)
  if (!roles.canBA) {
    return { error: "Onglet réservé au bureau (présidente / trésorier / RH)." }
  }

  const { data, error } = await admin
    .from("signature_requests")
    .select("id, request_name, document_filename, category, status, created_at, expires_at, signers")
    .eq("archived", false)
    .order("created_at", { ascending: false })
    .limit(100)
  if (error) return { error: error.message }

  // Contrôle d'accès par type de document :
  //   - BA           → présidente / trésorier / RH
  //   - autres (libre) → présidente / trésorier uniquement
  const rows = (data ?? []).filter((r: any) => {
    if (SIGNED_STATUSES.includes(String(r.status).toLowerCase())) return false
    return r.category === "ba" ? roles.canBA : roles.canAutres
  })
  const role = roles.isPresident
    ? "president"
    : roles.isTresorier
      ? "tresorier"
      : roles.isRh
        ? "rh"
        : "admin"
  return { data: rows as BureauQueueRow[], role }
}

/**
 * Délègue une signature au trésorier quand la présidente ne peut pas signer.
 * Abandonne la demande LiveConsent en cours et la marque déléguée. La nouvelle
 * demande (membre → trésorier) sera recréée par l'admin via « Renvoyer », car
 * le PDF partiellement signé n'est pas conservé côté Be Fast.
 *
 * NB : à affiner selon le support de réassignation de destinataire par l'API
 * LiveConsent (point ouvert §9 du design).
 */
export async function delegateToTresorier(requestId: string) {
  const guard = await requireAdmin()
  if ("error" in guard) return { error: guard.error }
  const { admin } = guard

  const { data: row } = await admin
    .from("signature_requests")
    .select("id, lc_request_id, personne_id, category, signers")
    .eq("id", requestId)
    .single()
  if (!row) return { error: "Demande introuvable." }

  await abandonRequest((row as any).lc_request_id).catch(() => false)
  await admin
    .from("signature_requests")
    .update({ status: "delegue_tresorier", archived: true, updated_at: new Date().toISOString() })
    .eq("id", requestId)

  // Recrée un BA frais avec le trésorier comme signataire bureau, si applicable.
  if ((row as any).category === "ba" && (row as any).personne_id) {
    const settings = await getBaSettings(admin)
    if (settings.tresorierUserId) {
      // Recrée un BA avec le trésorier comme signataire bureau (repli) : le membre
      // re-signe puis le trésorier contre-signe. (PDF partiel non conservé.)
      const res = await sendBA((row as any).personne_id, {
        auto: false,
        createdBy: guard.userId,
        bureauUserId: settings.tresorierUserId,
      })
      revalidatePath("/signatures")
      return res
    }
  }
  revalidatePath("/signatures")
  return { success: true }
}
