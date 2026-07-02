import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getSignedDownloadUrl, objectKeyFromValue } from "@/lib/scaleway/client"
import { getCachedProfile } from "@/lib/auth/cached-profile"
import { hasPermission } from "@/lib/auth/permissions"

export const dynamic = "force-dynamic"

/**
 * Téléchargement authentifié des objets Scaleway (justificatifs de notes de
 * frais, documents de mission). Les objets sont désormais PRIVÉS : on vérifie
 * l'autorisation puis on redirige vers une URL présignée à courte durée.
 *
 * Autorisation par préfixe de clé :
 *  - notes_de_frais/<missionId>/<ownerId>/...  → propriétaire, ou trésorerie/
 *    admin (permission voir_factures), ou intervenant de la mission.
 *  - collaborations/<missionId>/...            → intervenant de la mission, ou admin.
 */
export async function GET(req: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })

  const raw = req.nextUrl.searchParams.get("key")
  if (!raw) return NextResponse.json({ error: "Paramètre 'key' requis" }, { status: 400 })

  const key = objectKeyFromValue(raw)
  const parts = key.split("/")

  // Accès privilégié = permission `voir_factures` (admin + poste trésorier·ère /
  // présidente), poste-aware — le propriétaire garde toujours accès à ses docs.
  const profile = await getCachedProfile(user.id)
  const isPrivileged = hasPermission(profile, "voir_factures")
  const isAdmin = profile?.profils_types?.slug === "administrateur"

  const isIntervenant = async (missionId: string): Promise<boolean> => {
    if (!missionId) return false
    const { data } = await supabase
      .from("mission_intervenants")
      .select("mission_id")
      .eq("mission_id", missionId)
      .eq("personne_id", user.id)
      .maybeSingle()
    return !!data
  }

  let allowed = false
  if (parts[0] === "notes_de_frais") {
    const missionId = parts[1]
    const ownerId = parts[2]
    allowed = ownerId === user.id || isPrivileged || (await isIntervenant(missionId))
  } else if (parts[0] === "collaborations") {
    const missionId = parts[1]
    allowed = isAdmin || (await isIntervenant(missionId))
  }

  if (!allowed) {
    return NextResponse.json({ error: "Accès interdit à ce fichier" }, { status: 403 })
  }

  const url = await getSignedDownloadUrl(key)
  return NextResponse.redirect(url)
}
