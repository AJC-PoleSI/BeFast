import "server-only"

import { createClient } from "@/lib/supabase/server"
import { getCachedProfile } from "@/lib/auth/cached-profile"
import { hasPermission } from "@/lib/auth/permissions"
import type { PermissionKey, PersonneWithRole } from "@/types/database.types"

/**
 * Gardes de PAGE (server components / layouts).
 *
 * Pendant longtemps, une permission comme `etudes` ou `voir_factures` ne
 * faisait que masquer le lien dans la sidebar : en tapant l'URL directement,
 * la page s'affichait quand même (seules /administration et /statistiques
 * étaient réellement verrouillées, et côté client uniquement).
 *
 * Ces helpers referment l'écart côté serveur. Utilisés depuis un `layout.tsx`
 * qui ne rend PAS `children` en cas de refus, ils empêchent le segment enfant
 * d'être rendu du tout — donc aussi ses requêtes de données, contrairement à
 * <RoleGuard> qui n'agit qu'à l'affichage.
 *
 * Le profil passe par `getCachedProfile` (cache 5 min) : aucun aller-retour DB
 * supplémentaire sur les navigations suivantes.
 */

export type PageAccess =
  | { ok: true; userId: string; profile: PersonneWithRole }
  | { ok: false; reason: "anonymous" | "forbidden"; profile: PersonneWithRole | null }

/** Le compte courant (profil résolu) ou null s'il n'est pas connecté. */
export async function getPageProfile(): Promise<{ userId: string; profile: PersonneWithRole | null } | null> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return { userId: user.id, profile: await getCachedProfile(user.id) }
}

/** Accès si le compte détient AU MOINS UNE des clés (l'administrateur passe toujours). */
export async function checkPageAccess(keys: PermissionKey[]): Promise<PageAccess> {
  const ctx = await getPageProfile()
  if (!ctx) return { ok: false, reason: "anonymous", profile: null }
  const allowed = keys.some((k) => hasPermission(ctx.profile, k))
  if (!allowed) return { ok: false, reason: "forbidden", profile: ctx.profile }
  return { ok: true, userId: ctx.userId, profile: ctx.profile! }
}

/** Raccourci booléen pour une clé unique. */
export async function pageHasPermission(key: PermissionKey): Promise<boolean> {
  const res = await checkPageAccess([key])
  return res.ok
}
