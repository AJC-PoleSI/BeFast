import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { decryptData } from "@/lib/crypto"
import { NextRequest, NextResponse } from "next/server"

const MASTER_KEY = process.env.ENCRYPTION_MASTER_KEY || "default-key"

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sb = createClient()
    const { data: { user }, error: authError } = await sb.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

    const targetId = params.id

    const admin = createAdminClient()
    const { data: caller } = await admin
      .from("personnes")
      .select("id, profil_type_id, profils_types(slug)")
      .eq("id", user.id)
      .single()

    const callerRole = (caller?.profils_types as any)?.slug

    let hasAccess = false
    if (user.id === targetId) {
      hasAccess = true
    } else if (callerRole === "administrateur") {
      hasAccess = true
    } else if (callerRole === "manager") {
      const { data: isManaged } = await admin
        .from("equipes")
        .select("id")
        .eq("manager_id", user.id)
        .eq("membre_id", targetId)
        .single()
      hasAccess = !!isManaged
    }

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

    const salt = profile.encryption_salt
    const decrypted = {
      ...profile,
      nss: profile.nss_encrypted && salt ? decryptData(profile.nss_encrypted, profile.nss_iv, profile.nss_auth_tag, MASTER_KEY, salt) : null,
      iban: profile.iban_encrypted && salt ? decryptData(profile.iban_encrypted, profile.iban_iv, profile.iban_auth_tag, MASTER_KEY, salt) : null,
      adresse: profile.adresse_encrypted && salt ? decryptData(profile.adresse_encrypted, profile.adresse_iv, profile.adresse_auth_tag, MASTER_KEY, salt) : profile.adresse,
      date_naissance: profile.date_naissance_encrypted && salt ? decryptData(profile.date_naissance_encrypted, profile.date_naissance_iv, profile.date_naissance_auth_tag, MASTER_KEY, salt) : profile.date_naissance,
    }

    return NextResponse.json({ data: decrypted })
  } catch (error: any) {
    console.error("[GET /api/membres/:id]", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
