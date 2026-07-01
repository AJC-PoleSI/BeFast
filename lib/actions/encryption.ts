"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { encryptData, decryptData, generateEncryptionSalt } from "@/lib/crypto"
import { getMasterKey } from "@/lib/crypto-key"

export async function getDecryptedProfile(userId: string) {
  try {
    const client = createClient()
    const { data: { user } } = await client.auth.getUser()
    if (!user) return { error: "Non authentifié" }

    const admin = createAdminClient()

    // Contrôle d'accès : on ne déchiffre les données sensibles (NSS, IBAN…)
    // que pour soi-même, ou si l'appelant est administrateur.
    if (user.id !== userId) {
      const { data: caller } = await admin
        .from("personnes")
        .select("profils_types!profil_type_id(slug)")
        .eq("id", user.id)
        .single()
      if ((caller?.profils_types as any)?.slug !== "administrateur") {
        return { error: "Non autorisé" }
      }
    }

    const MASTER_KEY = getMasterKey()
    const { data: profile, error } = await admin
      .from("personnes")
      .select("*")
      .eq("id", userId)
      .single()

    if (error || !profile) return { error: "Profil introuvable" }

    const salt = profile.encryption_salt
    if (!salt) return { error: "Salte manquant" }

    return {
      data: {
        ...profile,
        nss: profile.nss_encrypted ? decryptData(profile.nss_encrypted, profile.nss_iv, profile.nss_auth_tag, MASTER_KEY, salt) : null,
        iban: profile.iban_encrypted ? decryptData(profile.iban_encrypted, profile.iban_iv, profile.iban_auth_tag, MASTER_KEY, salt) : null,
        adresse: profile.adresse_encrypted ? decryptData(profile.adresse_encrypted, profile.adresse_iv, profile.adresse_auth_tag, MASTER_KEY, salt) : profile.adresse,
        date_naissance: profile.date_naissance_encrypted ? decryptData(profile.date_naissance_encrypted, profile.date_naissance_iv, profile.date_naissance_auth_tag, MASTER_KEY, salt) : profile.date_naissance,
        ville: profile.ville_encrypted ? decryptData(profile.ville_encrypted, profile.ville_iv, profile.ville_auth_tag, MASTER_KEY, salt) : profile.ville,
        code_postal: profile.code_postal_encrypted ? decryptData(profile.code_postal_encrypted, profile.code_postal_iv, profile.code_postal_auth_tag, MASTER_KEY, salt) : profile.code_postal,
      },
    }
  } catch (error) {
    console.error("[getDecryptedProfile]", error)
    return { error: "Erreur lors du déchiffrement" }
  }
}

export async function updateProfileWithEncryption(userId: string, updates: Record<string, any>) {
  try {
    const client = createClient()
    const { data: { user } } = await client.auth.getUser()
    if (!user || user.id !== userId) return { error: "Non autorisé" }

    const MASTER_KEY = getMasterKey()
    const admin = createAdminClient()
    const { data: profile } = await admin
      .from("personnes")
      .select("encryption_salt")
      .eq("id", userId)
      .single()

    const salt = profile?.encryption_salt || generateEncryptionSalt()
    const encrypted: Record<string, any> = { encryption_salt: salt }

    if (updates.nss) {
      const enc = encryptData(updates.nss, MASTER_KEY, salt)
      encrypted.nss_encrypted = enc.encrypted
      encrypted.nss_iv = enc.iv
      encrypted.nss_auth_tag = enc.authTag
    }
    if (updates.iban) {
      const enc = encryptData(updates.iban, MASTER_KEY, salt)
      encrypted.iban_encrypted = enc.encrypted
      encrypted.iban_iv = enc.iv
      encrypted.iban_auth_tag = enc.authTag
    }
    if (updates.adresse) {
      const enc = encryptData(updates.adresse, MASTER_KEY, salt)
      encrypted.adresse_encrypted = enc.encrypted
      encrypted.adresse_iv = enc.iv
      encrypted.adresse_auth_tag = enc.authTag
    }
    if (updates.date_naissance) {
      const enc = encryptData(updates.date_naissance, MASTER_KEY, salt)
      encrypted.date_naissance_encrypted = enc.encrypted
      encrypted.date_naissance_iv = enc.iv
      encrypted.date_naissance_auth_tag = enc.authTag
    }
    if (updates.ville) {
      const enc = encryptData(updates.ville, MASTER_KEY, salt)
      encrypted.ville_encrypted = enc.encrypted
      encrypted.ville_iv = enc.iv
      encrypted.ville_auth_tag = enc.authTag
    }
    if (updates.code_postal) {
      const enc = encryptData(updates.code_postal, MASTER_KEY, salt)
      encrypted.code_postal_encrypted = enc.encrypted
      encrypted.code_postal_iv = enc.iv
      encrypted.code_postal_auth_tag = enc.authTag
    }

    const { data: result, error } = await admin
      .from("personnes")
      .update(encrypted)
      .eq("id", userId)
      .select()
      .single()

    if (error) return { error: error.message }
    return { data: result }
  } catch (error) {
    console.error("[updateProfileWithEncryption]", error)
    return { error: "Erreur lors de la mise à jour" }
  }
}
