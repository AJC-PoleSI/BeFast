export const dynamic = "force-dynamic"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { lirePII, lireSecret } from "@/lib/pii/personne"
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sb = createClient()
    const { data: { user }, error: authError } = await sb.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

    const targetId = params.id

    const admin = createAdminClient()
    const { data: caller } = await admin
      .from("personnes")
      .select("id, profil_type_id, profils_types!profil_type_id(slug)")
      .eq("id", user.id)
      .single()

    const callerRole = (caller?.profils_types as any)?.slug

    // Accès à une fiche membre (contient des PII déchiffrées) : soi-même ou admin.
    // NB : une branche « manager » s'appuyait sur une table `equipes` qui n'existe
    // pas dans ce schéma — elle échouait systématiquement (fail-closed) et a été
    // retirée. Il n'existe pas non plus de rôle `manager` dans profils_types.
    const hasAccess = user.id === targetId || callerRole === "administrateur"

    if (!hasAccess) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
    }

    const { data: profile, error } = await admin
      .from("personnes")
      .select("*")
      .eq("id", targetId)
      .single()

    if (error || !profile) {
      return NextResponse.json({ error: "Membre introuvable" }, { status: 404 })
    }

    const decrypted = {
      ...profile,
      nss: lireSecret(profile, "nss"),
      iban: lireSecret(profile, "iban"),
      // Coordonnées : les quatre champs, déchiffrés (ville et code postal
      // n'étaient renvoyés qu'en clair, colonne désormais vide).
      ...lirePII(profile),
    }

    return NextResponse.json({ data: decrypted })
  } catch (error: any) {
    console.error("[GET /api/membres/:id]", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
