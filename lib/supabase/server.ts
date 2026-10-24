import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { cookies } from "next/headers";
import { cache } from "react"

export const createClient = cache(() => {
  // Next 15 : cookies() est asynchrone. Le client reste synchrone (une
  // soixantaine d'appelants) ; les cookies ne sont lus qu'au moment où
  // Supabase en a besoin, dans la même requête.
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        async getAll() {
          const cookieStore = await cookies()
          return cookieStore.getAll()
        },
        async setAll(
          cookiesToSet: {
            name: string
            value: string
            options: CookieOptions
          }[]
        ) {
          try {
            const cookieStore = await cookies()
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component — middleware handles refresh
          }
        },
      },
    }
  )
})
