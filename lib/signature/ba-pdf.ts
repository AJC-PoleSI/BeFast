import "server-only"

import { PDFDocument } from "pdf-lib"
import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Remplissage du Bulletin d'adhésion (BA) à partir d'un template PDF.
 *
 * Le template est un PDF contenant des champs de formulaire (AcroForm) nommés
 * selon les clés de BA_FIELD_NAMES. Il est géré comme les autres modèles
 * (Administration → Documents) : enregistré dans `document_templates` et stocké
 * dans le bucket Supabase Storage `templates`. On le télécharge, on remplit les
 * champs présents (les absents sont ignorés sans erreur), on aplatit le
 * formulaire et on renvoie les octets PDF prêts pour LiveConsent.
 */

/** Noms de champs AcroForm attendus dans le template BA → libellé indicatif. */
export const BA_FIELD_NAMES: Record<string, string> = {
  prenom: "Prénom du membre",
  nom: "Nom du membre",
  nom_complet: "Prénom + Nom",
  email: "Email du membre",
  portable: "Téléphone",
  promo: "Promotion",
  etablissement: "Établissement",
  scolarite: "Scolarité",
  adresse: "Adresse",
  ville: "Ville",
  code_postal: "Code postal",
  date_naissance: "Date de naissance",
  date_jour: "Date du jour",
}

export type BaFieldValues = Partial<Record<keyof typeof BA_FIELD_NAMES, string>>

/** Télécharge le template BA depuis le bucket Supabase `templates`. `null` si introuvable. */
export async function loadBaTemplate(
  admin: SupabaseClient,
  path: string
): Promise<Uint8Array | null> {
  try {
    const { data, error } = await admin.storage.from("templates").download(path)
    if (error || !data) {
      console.error("[ba-pdf] template introuvable:", error?.message ?? "vide")
      return null
    }
    return new Uint8Array(await data.arrayBuffer())
  } catch (e) {
    console.error("[ba-pdf] échec téléchargement template:", (e as any)?.message ?? e)
    return null
  }
}

/**
 * Remplit le template avec les valeurs fournies, aplatit, renvoie le PDF.
 * Robuste : un champ manquant dans le template n'interrompt pas le remplissage.
 */
export async function fillBaPdf(
  templateBytes: Uint8Array,
  values: BaFieldValues
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(templateBytes)
  const form = pdf.getForm()

  for (const key of Object.keys(BA_FIELD_NAMES)) {
    const value = values[key as keyof BaFieldValues]
    if (value == null) continue
    try {
      const field = form.getTextField(key)
      field.setText(String(value))
    } catch {
      // Champ absent du template ou non textuel : on ignore silencieusement.
    }
  }

  // Aplatit le formulaire (les valeurs deviennent du contenu fixe, non éditable).
  form.flatten()
  return pdf.save()
}

/** Base64 (sans préfixe data:) à partir d'octets PDF — pour LiveConsent. */
export function pdfBytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64")
}
