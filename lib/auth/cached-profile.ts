import { unstable_cache } from "next/cache"
import { createAdminClient } from "@/lib/supabase/admin"
import type { PersonneWithRole, PersonnePoste } from "@/types/database.types"
import { USER_PROFILE_TAG } from "@/lib/cache-tags"

/**
 * Get a user's full profile (personne + role + postes) — cached by user ID.
 *
 * This is the biggest perf win: the personne+profil_types query was running
 * on EVERY dashboard navigation (~150-300ms). Now it's cached for 5 minutes.
 *
 * - First visit: DB query (~200ms)
 * - All subsequent visits in 5 min window: <5ms cache hit
 *
 * Les postes (bureau/pôles) sont chargés par une requête SÉPARÉE et TOLÉRANTE :
 * si la table `personne_postes` n'existe pas encore (migration 039 non appliquée
 * en prod alors que le code est déjà déployé), on renvoie le profil sans postes
 * plutôt que de faire échouer toute la requête et casser l'accès de l'utilisateur.
 *
 * Cache invalidated via `revalidateTag("user-profile:<userId>")` on:
 * - Profile update
 * - Role change
 * - Account validation
 *
 * Un `null` (échec transitoire de la requête `personnes`) n'est JAMAIS mis en
 * cache : sinon un incident passager (ex. migration pas encore appliquée au
 * moment de la requête) resterait figé jusqu'à expiration du cache (5 min, et
 * potentiellement plus si le trafic est faible) au lieu de se rétablir dès la
 * requête suivante une fois le problème corrigé.
 */
async function fetchProfile(uid: string): Promise<PersonneWithRole | null> {
  const sb = createAdminClient()
  const { data } = await sb
    .from("personnes")
    // Hint !profil_type_id : lève l'ambiguïté d'embed introduite par la table de
    // jonction personne_postes (Supabase la détecte comme lien many-to-many
    // personnes↔profils_types). Sans le hint, la requête échoue → profil null.
    .select("*, profils_types!profil_type_id(*)")
    .eq("id", uid)
    .single()
  if (!data) return null

  let personne_postes: PersonnePoste[] = []
  try {
    const { data: pp } = await sb
      .from("personne_postes")
      .select("profils_types(*)")
      .eq("personne_id", uid)
    if (pp) personne_postes = pp as unknown as PersonnePoste[]
  } catch {
    // Table absente (migration non appliquée) : profil sans postes.
  }

  return { ...(data as Record<string, unknown>), personne_postes } as PersonneWithRole
}

export async function getCachedProfile(userId: string): Promise<PersonneWithRole | null> {
  const cached = unstable_cache(fetchProfile, ["user-profile", userId], {
    tags: [`user-profile:${userId}`],
    revalidate: 300, // 5 minutes
  })
  const result = await cached(userId)
  if (result) return result
  // Pas de profil trouvé via le cache : on retente en direct (sans mettre en
  // cache un éventuel échec), pour ne jamais rester bloqué sur un null figé.
  return fetchProfile(userId)
}
