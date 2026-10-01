import "server-only"

import { createClient } from "@/lib/supabase/server"
import { getCachedProfile } from "@/lib/auth/cached-profile"
import { hasAnyPermission } from "@/lib/auth/permissions"
import type { PermissionKey, PersonneWithRole } from "@/types/database.types"

/**
 * Garde de SERVER ACTION — pendant du `requireApiPermission` des routes API.
 *
 * Beaucoup de server actions ne vérifiaient que l'authentification : la
 * permission correspondante n'existait que pour masquer un lien ou un bouton
 * côté client, donc un simple appel direct à l'action suffisait à la
 * contourner. Ce helper branche la clé applicative sur l'action elle-même.
 *
 * L'administrateur passe toujours (cf. `hasPermission`), et un compte non
 * validé est déjà ramené à `profil`/`documents` par `resolveEffectivePermissions`.
 */
export type ActionGuard =
  | { ok: true; userId: string; profile: PersonneWithRole | null }
  | { ok: false; error: string }

export async function requireActionPermission(
  keys: PermissionKey | PermissionKey[],
  message = "Non autorisé"
): Promise<ActionGuard> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Non authentifié" }

  const profile = await getCachedProfile(user.id)
  const list = Array.isArray(keys) ? keys : [keys]
  if (!hasAnyPermission(profile, list)) return { ok: false, error: message }

  return { ok: true, userId: user.id, profile }
}
