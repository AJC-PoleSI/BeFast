import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Si les clés manquent, on laisse passer pour que l'app affiche une erreur claire côté client
  if (!supabaseUrl || !supabaseKey) {
    return supabaseResponse
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        )
        supabaseResponse = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        )
      },
    },
  })

  // Récupérer l'utilisateur courant (getUser est recommandé par Supabase pour la sécurité)
  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // 🚨 Règle d'or : Ne jamais intercepter ou rediriger les requêtes API
  if (pathname.startsWith("/api")) {
    return supabaseResponse
  }

  // Définition des routes publiques
  const publicPaths = [
    "/login",
    "/inscription",
    "/mot-de-passe-oublie",
    "/auth/callback",
  ]
  const isPublicPath = publicPaths.some((p) => pathname.startsWith(p))

  // 1. Gestion de la racine "/"
  if (pathname === "/") {
    const url = request.nextUrl.clone()
    url.pathname = user ? "/dashboard" : "/login"
    return NextResponse.redirect(url)
  }

  // 2. Protection : Redirection vers /login si non connecté sur une route privée
  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  // 3. Confort : Redirection vers /dashboard si déjà connecté et tente d'accéder au login
  if (user && isPublicPath && pathname !== "/auth/callback") {
    const url = request.nextUrl.clone()
    url.pathname = "/dashboard"
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match toutes les requêtes SAUF celles qui commencent par :
     * - _next/static (fichiers statiques)
     * - _next/image (optimisation d'images)
     * - favicon.ico (icône du site)
     * - et toutes les extensions de fichiers (images, svg, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
