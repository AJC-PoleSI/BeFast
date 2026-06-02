export const dynamic = "force-dynamic"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { encryptData, decryptData, generateEncryptionSalt } from "@/lib/crypto"
import { getMasterKey } from "@/lib/crypto-key"
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  try {
    const sb = createClient()
    const { data: { user }, error: authError } = await sb.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

    const MASTER_KEY = getMasterKey()
    const admin = createAdminClient()
    const { data: profile, error } = await admin
      .from("personnes")
      .select("*")
      .eq("id", user.id)
      .single()

    if (error || !profile) return NextResponse.json({ error: "Profil introuvable" }, { status: 404 })

    const salt = profile.encryption_salt || generateEncryptionSalt()

    const decrypted = {
      ...profile,
      nss: profile.nss_encrypted ? decryptData(profile.nss_encrypted, profile.nss_iv, profile.nss_auth_tag, MASTER_KEY, salt) : null,
      iban: profile.iban_encrypted ? decryptData(profile.iban_encrypted, profile.iban_iv, profile.iban_auth_tag, MASTER_KEY, salt) : null,
      adresse: profile.adresse_encrypted ? decryptData(profile.adresse_encrypted, profile.adresse_iv, profile.adresse_auth_tag, MASTER_KEY, salt) : profile.adresse,
      date_naissance: profile.date_naissance_encrypted ? decryptData(profile.date_naissance_encrypted, profile.date_naissance_iv, profile.date_naissance_auth_tag, MASTER_KEY, salt) : profile.date_naissance,
      ville: profile.ville_encrypted ? decryptData(profile.ville_encrypted, profile.ville_iv, profile.ville_auth_tag, MASTER_KEY, salt) : profile.ville,
      code_postal: profile.code_postal_encrypted ? decryptData(profile.code_postal_encrypted, profile.code_postal_iv, profile.code_postal_auth_tag, MASTER_KEY, salt) : profile.code_postal,
    }

    return NextResponse.json({ data: decrypted })
  } catch (error: any) {
    console.error("[GET /api/profil]", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const sb = createClient()
    const { data: { user }, error: authError } = await sb.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

    const body = await req.json()
    const MASTER_KEY = getMasterKey()
    const admin = createAdminClient()

    const { data: profile } = await admin
      .from("personnes")
      .select("encryption_salt")
      .eq("id", user.id)
      .single()

    const salt = profile?.encryption_salt || generateEncryptionSalt()

    const updates: any = { encryption_salt: salt }

    if (body.nss) {
      const enc = encryptData(body.nss, MASTER_KEY, salt)
      updates.nss_encrypted = enc.encrypted
      updates.nss_iv = enc.iv
      updates.nss_auth_tag = enc.authTag
    }
    if (body.iban) {
      const enc = encryptData(body.iban, MASTER_KEY, salt)
      updates.iban_encrypted = enc.encrypted
      updates.iban_iv = enc.iv
      updates.iban_auth_tag = enc.authTag
    }
    if (body.adresse) {
      const enc = encryptData(body.adresse, MASTER_KEY, salt)
      updates.adresse_encrypted = enc.encrypted
      updates.adresse_iv = enc.iv
      updates.adresse_auth_tag = enc.authTag
    }
    if (body.date_naissance) {
      const enc = encryptData(body.date_naissance, MASTER_KEY, salt)
      updates.date_naissance_encrypted = enc.encrypted
      updates.date_naissance_iv = enc.iv
      updates.date_naissance_auth_tag = enc.authTag
    }
    if (body.ville) {
      const enc = encryptData(body.ville, MASTER_KEY, salt)
      updates.ville_encrypted = enc.encrypted
      updates.ville_iv = enc.iv
      updates.ville_auth_tag = enc.authTag
    }
    if (body.code_postal) {
      const enc = encryptData(body.code_postal, MASTER_KEY, salt)
      updates.code_postal_encrypted = enc.encrypted
      updates.code_postal_iv = enc.iv
      updates.code_postal_auth_tag = enc.authTag
    }

    const { data: updated, error } = await admin
      .from("personnes")
      .update(updates)
      .eq("id", user.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ data: updated })
  } catch (error: any) {
    console.error("[PUT /api/profil]", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const sb = createClient()
    const { data: { user }, error: authError } = await sb.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

    const body = await req.json()
    const { searchParams } = new URL(req.url)
    const targetUserId = searchParams.get("targetUserId") ?? user.id

    const admin = createAdminClient()

    // --- Contrôle d'accès ---
    // On résout le rôle de l'appelant pour décider de ce qu'il peut modifier.
    const { data: caller } = await admin
      .from("personnes")
      .select("profils_types(slug)")
      .eq("id", user.id)
      .single()
    const isAdmin = (caller?.profils_types as any)?.slug === "administrateur"

    // Seul un administrateur peut modifier le profil d'un AUTRE utilisateur.
    if (targetUserId !== user.id && !isAdmin) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 403 })
    }

    // Champs en libre-service (modifiables par l'utilisateur sur son propre profil).
    const ALLOWED = ["prenom", "nom", "portable", "promo", "adresse", "ville", "code_postal"] as const
    const updates: Record<string, string | null> = {}
    for (const field of ALLOWED) {
      if (body[field] !== undefined) updates[field] = body[field] || null
    }
    // Le pôle pilote les permissions : seul un administrateur peut l'attribuer
    // (sinon n'importe quel membre pourrait s'auto-élever ses droits).
    if (isAdmin && body.pole !== undefined) {
      updates.pole = body.pole || null
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Aucun champ modifiable fourni" }, { status: 400 })
    }

    const { data: updated, error } = await admin
      .from("personnes")
      .update(updates)
      .eq("id", targetUserId)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ data: updated })
  } catch (error: any) {
    console.error("[PATCH /api/profil]", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
