import { NextResponse } from "next/server"
import { timingSafeEqual } from "crypto"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendEmail } from "@/lib/email/send"
import { chargerDestinataires, collecterDigest } from "@/lib/rh-digest/collect"
import { rhDigestEmail } from "@/lib/rh-digest/email"

export const dynamic = "force-dynamic"
export const maxDuration = 120

function timingSafeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

/**
 * Cron hebdomadaire (lundi 7h UTC = 8h/9h Paris) : envoie au Pôle RH et à la
 * Responsable RH le point de la semaine écoulée. Protégé par CRON_SECRET
 * (Vercel ajoute `Authorization: Bearer $CRON_SECRET`), fail-closed.
 * `?dry=1` calcule le digest sans rien envoyer (vérification manuelle).
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get("authorization")
  if (!secret || !timingSafeEqualStr(auth ?? "", `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const dry = new URL(request.url).searchParams.get("dry") === "1"
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/+$/, "")
  if (!siteUrl || siteUrl.includes("localhost")) {
    return NextResponse.json({ error: "NEXT_PUBLIC_SITE_URL non configuré" }, { status: 500 })
  }

  try {
    const admin = createAdminClient()
    const [destinataires, digest] = await Promise.all([chargerDestinataires(admin), collecterDigest(admin)])

    if (dry) {
      return NextResponse.json({
        dry: true,
        destinataires: destinataires.length,
        comptesCrees: digest.comptesCrees.total,
        comptesValides: digest.comptesValides.total,
        depots: digest.depots.total,
        attente: digest.attente.totalDocuments,
      })
    }

    // Envois séquentiels : un échec isolé ne bloque pas les autres destinataires.
    let envoyes = 0
    const echecs: string[] = []
    for (const d of destinataires) {
      const { subject, html } = rhDigestEmail({ prenom: d.prenom, digest, siteUrl })
      const res = await sendEmail({ to: d.email, subject, html })
      if (res.ok) envoyes++
      else echecs.push(d.id)
    }
    if (echecs.length) console.error("[rh-digest] envois en échec", echecs)

    return NextResponse.json({ envoyes, echecs: echecs.length, destinataires: destinataires.length })
  } catch (e: any) {
    console.error("[rh-digest]", e?.message ?? e)
    return NextResponse.json({ error: "digest_failed" }, { status: 500 })
  }
}
