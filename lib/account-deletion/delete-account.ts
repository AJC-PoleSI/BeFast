import "server-only"

import { DeleteObjectCommand } from "@aws-sdk/client-s3"
import { scalewayS3, SCALEWAY_BUCKET } from "@/lib/scaleway/client"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  buildAnonymisationPatch,
  anonymisedEmailFor,
  DELETED_STATUS,
} from "./purge"

/**
 * Supprime un compte : accès coupé, données personnelles purgées, identité
 * anonymisée. La ligne `personnes` et le compte Auth survivent — voir purge.ts
 * et le commentaire sur le bannissement plus bas.
 *
 * Chaque étape après la première est best-effort : son échec est collecté et
 * remonté à l'administrateur plutôt que d'interrompre les suivantes, pour ne
 * pas laisser un compte à moitié purgé sans le dire.
 */

/** ~100 ans : Supabase n'expose pas de bannissement définitif. */
const BAN_DURATION = "876000h"

export type DeletionResult = { ok: boolean; failedSteps: string[] }

export async function deleteAccount(personneId: string): Promise<DeletionResult> {
  const admin = createAdminClient()
  const failedSteps: string[] = []

  // 1. Couper l'accès en premier : si la suite échoue, le compte est déjà hors
  //    service (la garde du dashboard refuse tout statut != validated).
  const { error: statusError } = await admin
    .from("personnes")
    .update({ account_status: DELETED_STATUS })
    .eq("id", personneId)

  if (statusError) {
    console.error("[deleteAccount] statut non appliqué", statusError)
    return { ok: false, failedSteps: ["statut"] }
  }

  // 2. Documents personnels : objets Scaleway, puis lignes.
  const { data: docs, error: docsReadError } = await admin
    .from("documents_personnes")
    .select("file_path")
    .eq("personne_id", personneId)

  if (docsReadError) {
    // Sans la liste, on ne peut pas supprimer les objets du bucket : il faut le
    // dire, sinon des documents personnels survivraient en silence.
    console.error("[deleteAccount] lecture documents_personnes", docsReadError)
    failedSteps.push("documents_personnes:lecture")
  }

  for (const doc of docs ?? []) {
    if (!doc?.file_path) continue
    try {
      await scalewayS3.send(
        new DeleteObjectCommand({ Bucket: SCALEWAY_BUCKET, Key: doc.file_path }),
      )
    } catch (e) {
      console.error("[deleteAccount] objet S3 non supprimé", doc.file_path, e)
      failedSteps.push(`document:${doc.file_path}`)
    }
  }

  const { error: docsError } = await admin
    .from("documents_personnes")
    .delete()
    .eq("personne_id", personneId)
  if (docsError) {
    console.error("[deleteAccount] lignes documents_personnes", docsError)
    failedSteps.push("documents_personnes")
  }

  // 3. Avatar — bucket Supabase, chemin `<id>/avatar.<ext>`.
  const { data: avatarFiles, error: avatarListError } = await admin.storage
    .from("avatars")
    .list(personneId)
  if (avatarListError) {
    console.error("[deleteAccount] lecture du dossier avatar", avatarListError)
    failedSteps.push("avatar:lecture")
  }
  if (avatarFiles?.length) {
    const { error: avatarError } = await admin.storage
      .from("avatars")
      .remove(avatarFiles.map((f) => `${personneId}/${f.name}`))
    if (avatarError) {
      console.error("[deleteAccount] avatar non supprimé", avatarError)
      failedSteps.push("avatar")
    }
  }

  // 4. Valeurs des champs personnalisés.
  const { error: customError } = await admin
    .from("custom_field_values")
    .delete()
    .eq("user_id", personneId)
  if (customError) {
    console.error("[deleteAccount] custom_field_values", customError)
    failedSteps.push("custom_field_values")
  }

  // 5. Anonymisation de la ligne.
  const { error: patchError } = await admin
    .from("personnes")
    .update(buildAnonymisationPatch(personneId))
    .eq("id", personneId)
  if (patchError) {
    console.error("[deleteAccount] anonymisation", patchError)
    failedSteps.push("anonymisation")
  }

  // 6. Compte Auth : banni et anonymisé, JAMAIS supprimé — personnes.id est
  //    REFERENCES auth.users(id) ON DELETE CASCADE (migration 001), et
  //    notes_de_frais, mission_collaborations et candidatures cascadent à leur
  //    tour depuis personnes : un deleteUser effacerait l'historique des frais.
  const { error: authError } = await admin.auth.admin.updateUserById(personneId, {
    ban_duration: BAN_DURATION,
    email: anonymisedEmailFor(personneId),
    email_confirm: true,
  })
  if (authError) {
    console.error("[deleteAccount] compte Auth non neutralisé", authError)
    failedSteps.push("auth")
  }

  return { ok: failedSteps.length === 0, failedSteps }
}
