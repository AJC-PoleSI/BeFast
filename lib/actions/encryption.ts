"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getCachedProfile } from "@/lib/auth/cached-profile"
import { hasPermission } from "@/lib/auth/permissions"
import { encryptData, decryptData, generateEncryptionSalt } from "@/lib/crypto"
import { avecPIIEnClair, lireSecret } from "@/lib/pii/personne"
import { getMasterKey } from "@/lib/crypto-key"

export async function getDecryptedProfile(userId: string) {
  try {
    const client = createClient()
    const { data: { user } } = await client.auth.getUser()
    if (!user) return { error: "Non authentifié" }

    const admin = createAdminClient()

    // Contrôle d'accès : pour soi-même, tout est déchiffré. Sinon l'appelant
    // doit être administrateur (accès complet) ou porter une permission PII —
    // `voir_nss` (Pôle RH) / `voir_rib` (Trésorerie) — et il ne reçoit alors
    // QUE le champ correspondant. Avant, ces deux permissions n'ouvraient rien :
    // seul l'administrateur pouvait déchiffrer, les postes concernés ne voyaient
    // qu'un indicateur de présence sur la fiche.
    let peutVoirNss = true
    let peutVoirRib = true
    if (user.id !== userId) {
      const callerProfile = await getCachedProfile(user.id)
      const estAdmin = callerProfile?.profils_types?.slug === "administrateur"
      peutVoirNss = estAdmin || hasPermission(callerProfile, "voir_nss")
      peutVoirRib = estAdmin || hasPermission(callerProfile, "voir_rib")
      if (!peutVoirNss && !peutVoirRib) return { error: "Non autorisé" }
    }

    const MASTER_KEY = getMasterKey()
    const { data: profile, error } = await admin
      .from("personnes")
      .select("*")
      .eq("id", userId)
      .single()

    if (error || !profile) return { error: "Profil introuvable" }

    // Jamais de jeton ni de colonne technique dans la réponse ; les
    // coordonnées sortent déchiffrées (version chiffrée prioritaire) et
    // NSS/IBAN sont lus dans leurs deux formats historiques (lireSecret).
    const {
      reset_token_hash: _rth,
      reset_token_expires_at: _rte,
      verification_token_hash: _vth,
      verification_token_expires_at: _vte,
      ...reste
    } = profile as Record<string, any>

    return {
      data: {
        ...avecPIIEnClair(reste),
        nss: peutVoirNss ? lireSecret(profile, "nss") : null,
        iban: peutVoirRib ? lireSecret(profile, "iban") : null,
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
