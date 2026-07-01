import { unstable_cache } from "next/cache"
import { createAdminClient } from "@/lib/supabase/admin"
import type { PersonneWithRole } from "@/types/database.types"
import { USER_PROFILE_TAG } from "@/lib/cache-tags"

/**
 * Get a user's full profile (personne + role) — cached by user ID.
 *
 * This is the biggest perf win: the personne+profil_types query was running
 * on EVERY dashboard navigation (~150-300ms). Now it's cached for 5 minutes.
 *
 * - First visit: DB query (~200ms)
 * - All subsequent visits in 5 min window: <5ms cache hit
 *
 * Cache invalidated via `revalidateTag("user-profile:<userId>")` on:
 * - Profile update
 * - Role change
 * - Account validation
 */
export function getCachedProfile(userId: string) {
  const cached = unstable_cache(
    async (uid: string) => {
      const sb = createAdminClient()
      const { data } = await sb
        .from("personnes")
        .select("*, profils_types(*), personne_postes(profils_types(*))")
        .eq("id", uid)
        .single()
      return data as PersonneWithRole | null
    },
    ["user-profile", userId],
    {
      tags: [`user-profile:${userId}`],
      revalidate: 300, // 5 minutes
    }
  )
  return cached(userId)
}
