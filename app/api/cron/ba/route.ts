import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  getRequestStatus,
  isLiveConsentConfigured,
} from "@/lib/signature/liveconsent"
import {
  sendBA,
  toMemberData,
  checkMemberComplete,
  getBaSettings,
} from "@/lib/signature/ba"
import { sendEmail } from "@/lib/email/send"
import { signatureReminderEmail } from "@/lib/email/templates"

export const dynamic = "force-dynamic"
export const maxDuration = 300

const SIGNED_STATUSES = ["signed", "completed", "signe", "termine"]
const DAY = 86_400_000
const AUTO_SEND_LIMIT = 25 // garde-fou : nombre max d'envois auto par exécution

/**
 * Cron quotidien BA (Vercel) :
 *   1. envoie automatiquement le BA aux membres `ba_auto` complets sans BA en cours
 *   2. relance les BA non signés proches de l'expiration (J-7 / J-2 par défaut)
 *   3. rafraîchit les statuts et archive les BA signés
 *
 * Protégé par CRON_SECRET (Vercel ajoute `Authorization: Bearer $CRON_SECRET`).
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = request.headers.get("authorization")
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  if (!isLiveConsentConfigured()) {
    return NextResponse.json({ skipped: "liveconsent_not_configured" })
  }

  const admin = createAdminClient()
  const settings = await getBaSettings(admin)
  const report = { autoSent: 0, reminders: 0, archived: 0, errors: [] as string[] }

  // ── 1. Envoi automatique ───────────────────────────────────────────────────
  if (settings.templatePath) {
    const { data: candidates } = await admin
      .from("personnes")
      .select("*")
      .eq("ba_auto", true)
      .limit(200)

    // Membres ayant déjà une demande BA non archivée → exclus.
    const { data: openBa } = await admin
      .from("signature_requests")
      .select("personne_id")
      .eq("category", "ba")
      .eq("archived", false)
    const hasOpen = new Set((openBa ?? []).map((r: any) => r.personne_id))

    for (const p of candidates ?? []) {
      if (report.autoSent >= AUTO_SEND_LIMIT) break
      if (hasOpen.has((p as any).id)) continue
      const member = toMemberData(p)
      const completeness = await checkMemberComplete(admin, member)
      if (!completeness.complete) continue
      const res = await sendBA((p as any).id, { auto: true, createdBy: null })
      if ("success" in res) report.autoSent++
      else report.errors.push(`auto ${(p as any).id}: ${res.error}`)
    }
  }

  // ── 2 & 3. Relances + rafraîchissement/archivage ───────────────────────────
  const { data: pending } = await admin
    .from("signature_requests")
    .select("id, lc_request_id, request_name, recipient_firstname, recipient_email, status, expires_at, reminder_count, last_reminder_at, category")
    .eq("category", "ba")
    .eq("archived", false)
    .limit(500)

  const now = Date.now()
  for (const r of pending ?? []) {
    const row = r as any

    // Rafraîchir le statut consolidé.
    const status = await getRequestStatus(row.lc_request_id).catch(() => null)
    const effectiveStatus = status ?? row.status

    if (SIGNED_STATUSES.includes(String(effectiveStatus).toLowerCase())) {
      await admin
        .from("signature_requests")
        .update({ status: effectiveStatus, archived: true, updated_at: new Date().toISOString() })
        .eq("id", row.id)
      report.archived++
      continue
    }

    if (status && status !== row.status) {
      await admin
        .from("signature_requests")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", row.id)
    }

    // Relance si on est dans une fenêtre (J-X) et pas déjà relancé aujourd'hui.
    if (row.expires_at) {
      const daysLeft = Math.ceil((new Date(row.expires_at).getTime() - now) / DAY)
      const inWindow = settings.reminderDays.includes(daysLeft)
      const remindedToday =
        row.last_reminder_at && now - new Date(row.last_reminder_at).getTime() < DAY
      if (inWindow && !remindedToday && daysLeft > 0) {
        const tpl = signatureReminderEmail({
          prenom: row.recipient_firstname,
          requestName: row.request_name,
          daysLeft,
        })
        const sent = await sendEmail({ to: row.recipient_email, subject: tpl.subject, html: tpl.html })
        if (sent.ok) {
          await admin
            .from("signature_requests")
            .update({
              reminder_count: (row.reminder_count ?? 0) + 1,
              last_reminder_at: new Date().toISOString(),
            })
            .eq("id", row.id)
          report.reminders++
        }
      }
    }
  }

  return NextResponse.json({ ok: true, ...report })
}
