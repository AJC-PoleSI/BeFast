export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { buildTemplateContext } from "@/lib/actions/documents"
import { renderFacturePdf } from "@/lib/facture/pdf"
import { getCachedProfile } from "@/lib/auth/cached-profile"
import { hasPermission } from "@/lib/auth/permissions"

// Le rendu est purement calculatoire (pdf-lib, aucune police à télécharger),
// mais la construction du contexte fait plusieurs requêtes Supabase.
export const maxDuration = 30

/**
 * Facture au format PDF, prête à envoyer au client.
 *
 * Même contexte que la génération Word (`/api/documents/generate` avec le
 * modèle « Facture ») : le PDF n'est qu'un second rendu, jamais une seconde
 * logique de calcul. Le .docx reste disponible pour les cas où le trésorier
 * doit retoucher le texte avant envoi.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const sb = createClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  // Même garde que la génération Word d'une facture : sans elle, n'importe
  // quel compte authentifié pourrait télécharger n'importe quelle facture.
  const profile = await getCachedProfile(user.id)
  if (!hasPermission(profile, "voir_factures")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 })
  }

  const context = (await buildTemplateContext("facture", params.id)) as Record<string, any>
  if (context?.error) return NextResponse.json({ error: context.error }, { status: 403 })
  if (!context?.facturation) {
    return NextResponse.json({ error: "Facture introuvable" }, { status: 404 })
  }

  let pdf: Uint8Array
  try {
    pdf = await renderFacturePdf(context)
  } catch (e: any) {
    console.error("[FACTURE-PDF] rendu impossible:", e?.message)
    return NextResponse.json(
      { error: "Erreur de génération du PDF : " + (e?.message || "rendu") },
      { status: 500 }
    )
  }

  const numero = String(context.facturation.numero || params.id).replace(/[^\w .-]/g, "")
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Facture ${numero}.pdf"`,
      "Cache-Control": "no-store",
    },
  })
}
