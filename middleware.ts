import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

// Marge avant expiration sous laquelle on force un refresh réseau.
const REFRESH_MARGIN_S = 60

// Lit `expires_at` depuis le cookie de session Supabase (éventuellement chunké
// en `.0`, `.1`, …) sans appel réseau ni vérification de signature — la
// vérification réelle reste faite par les layouts/API via getUser(). Retourne
// null au moindre doute pour retomber sur le chemin réseau.
function readSessionExpiry(request: NextRequest): number | null {
  try {
    const chunks = request.cookies
      .getAll()
      .filter((c) => /^sb-[^.]+-auth-token(\.\d+)?$/.test(c.name))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
    if (chunks.length === 0) return null

    let raw = chunks.map((c) => c.value).join("")
    if (raw.startsWith("base64-")) {
      const b64 = raw.slice(7).replace(/-/g, "+").replace(/_/g, "/")
      raw = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4))
    }
    const session = JSON.parse(raw)
    return typeof session.expires_at === "number" ? session.expires_at : null
  } catch {
    return null
  }
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Token encore valide pour > 60 s : inutile de rafraîchir, on économise un
  // aller-retour Supabase (~100-300 ms) sur la quasi-totalité des navigations.
  const expiresAt = readSessionExpiry(request)
  if (expiresAt !== null && expiresAt - Math.floor(Date.now() / 1000) > REFRESH_MARGIN_S) {
    return response
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session — required for @supabase/ssr
  await supabase.auth.getUser()

  return response
}

export const config = {
  matcher: [
    // Seulement les routes qui ont besoin de la session auth — pas les API ni les assets
    "/((?!_next/static|_next/image|favicon\\.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
}
