import "server-only"

import { PDFDocument, StandardFonts, type PDFFont, type PDFTextField } from "pdf-lib"
import type { SupabaseClient } from "@supabase/supabase-js"
import { toWinAnsi } from "./ba-utils"

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

/**
 * Noms de champs AcroForm attendus dans le template BA → libellé indicatif.
 * Calés sur le formulaire officiel BA-2025 (encadré page 1) : « Nom Prénom »,
 * « Téléphone », « E-mail Audencia » (la partie avant @audencia.com, déjà
 * imprimé sur le PDF), « Promo », « Adresse du foyer fiscal complète ».
 * Les cases « Numéro étudiant Audencia », « Majeure (si 3A/4A) », « Fait à » et
 * « le » n'ont pas de source de données : le template les porte comme champs
 * libres (`numero_etudiant`, `majeure`, `fait_a`, `date_signature`), que le
 * membre complète dans le BA téléchargé ou à la main.
 */
export const BA_FIELD_NAMES: Record<string, string> = {
  nom_complet: "Nom Prénom",
  portable: "Téléphone",
  email_audencia: "E-mail Audencia (partie avant @audencia.com)",
  promo: "Promo",
  adresse_complete: "Adresse du foyer fiscal complète (adresse, CP ville)",
  etudiant: "Nom Prénom dans « lie Audencia Junior Conseil et l'étudiant … »",
  etudiant_signature: "Nom Prénom sous « Pour l'Étudiant, »",
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

/** Taille de police par défaut des champs du template, et plancher de réduction. */
const TAILLE_DEFAUT = 10
const TAILLE_MIN = 6

/**
 * Réduit la police d'un champ dont le texte déborderait de sa case (nom
 * composé, longue adresse…) : sans cela, la fin du texte est coupée à
 * l'impression. Les cases à taille fixe du template sont calées sur 10 pt.
 */
function ajusterTaille(field: PDFTextField, texte: string, police: PDFFont) {
  const largeur = field.acroField.getWidgets()[0]?.getRectangle().width
  if (!largeur || !texte) return
  const da = field.acroField.getDefaultAppearance() ?? ""
  const taille = Number(/([\d.]+)\s+Tf/.exec(da)?.[1]) || TAILLE_DEFAUT
  const utile = largeur - 4 // marges intérieures de la case
  const besoin = police.widthOfTextAtSize(texte, taille)
  if (besoin <= utile) return
  field.setFontSize(Math.max(TAILLE_MIN, Math.floor(((taille * utile) / besoin) * 10) / 10))
}

/**
 * Remplit le template avec les valeurs fournies et renvoie le PDF.
 * Robuste : un champ manquant dans le template n'interrompt pas le remplissage.
 *
 * `flatten` (par défaut) fige les valeurs, comme il se doit pour l'envoi en
 * signature. Le BA que la personne télécharge elle-même garde ses champs
 * modifiables : elle peut compléter les cases vides ou corriger avant de signer.
 */
export async function fillBaPdf(
  templateBytes: Uint8Array,
  values: BaFieldValues,
  { flatten = true }: { flatten?: boolean } = {}
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(templateBytes)
  const form = pdf.getForm()
  const police = await pdf.embedFont(StandardFonts.Helvetica)

  for (const key of Object.keys(BA_FIELD_NAMES)) {
    const value = values[key as keyof BaFieldValues]
    if (value == null) continue
    try {
      const field = form.getTextField(key)
      const texte = toWinAnsi(String(value))
      field.setText(texte)
      ajusterTaille(field, texte, police)
    } catch {
      // Champ absent du template ou non textuel : on ignore silencieusement.
    }
  }

  if (flatten) form.flatten()
  return pdf.save()
}

/** Base64 (sans préfixe data:) à partir d'octets PDF — pour LiveConsent. */
export function pdfBytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64")
}
