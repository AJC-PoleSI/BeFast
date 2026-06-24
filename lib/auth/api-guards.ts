import "server-only"

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getCachedProfile } from "@/lib/auth/cached-profile"
import type { PersonneWithRole } from "@/types/database.types"

/**
 * Shared authorization guards for API route handlers.
 *
 * These consolidate the auth/role checks that were previously copy-pasted
 * inline across the admin routes (in four slightly different variants). The
 * role read goes through `getCachedProfile`, so it reuses the same 5-minute
 * cache as the dashboard instead of issuing an uncached `personnes` query on
 * every request.
 *
 * Usage:
 *   const guard = await requireApiAdmin()
 *   if (!guard.ok) return guard.response
 *   // guard.userId / guard.profile are now available
 */

export type ApiGuardResult =
  | { ok: true; userId: string; profile: PersonneWithRole }
  | { ok: false; response: NextResponse }

/** Require an authenticated user. 401 if not logged in. */
export async function requireApiUser(): Promise<ApiGuardResult> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Non authentifié" }, { status: 401 }),
    }
  }

  const profile = await getCachedProfile(user.id)
  if (!profile) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Profil introuvable" }, { status: 404 }),
    }
  }

  return { ok: true, userId: user.id, profile }
}

/** Require an authenticated administrateur. 401 if anonymous, 403 otherwise. */
export async function requireApiAdmin(): Promise<ApiGuardResult> {
  const guard = await requireApiUser()
  if (!guard.ok) return guard

  if (guard.profile.profils_types?.slug !== "administrateur") {
    return {
      ok: false,
      response: NextResponse.json({ error: "Non autorisé" }, { status: 403 }),
    }
  }

  return guard
}
