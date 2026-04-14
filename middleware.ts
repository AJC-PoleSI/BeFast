import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      return supabaseResponse
    }

    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            )
            supabaseResponse = NextResponse.next({ request })
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            )
          } catch (error) {
            // Silence cookie errors to prevent Edge runtime crashes when headers are read-only
          }
        },
      },
    })

    let user = null;
    try {
      const { data } = await supabase.auth.getUser()
      user = data.user
    } catch (authError) {
      // Silence network / parsing errors to prevent Edge runtime crashes
      console.warn("Middleware auth error:", authError)
    }

    // Routes publiques (sans authentification)
    const publicPaths = [
      "/login",
      "/inscription",
      "/mot-de-passe-oublie",
      "/auth/callback",
    ]
    const isPublicPath = publicPaths.some((p) =>
      request.nextUrl.pathname.startsWith(p)
    )

    // Racine : rediriger vers /login si non authentifié, /dashboard si authentifié
    if (request.nextUrl.pathname === "/") {
      const url = request.nextUrl.clone()
      url.pathname = user ? "/dashboard" : "/login"
      return NextResponse.redirect(url)
    }

    // Redirection vers /login si non connecté et essai d'accès privé
    if (!user && !isPublicPath) {
      const url = request.nextUrl.clone()
      url.pathname = "/login"
      return NextResponse.redirect(url)
    }

    // Redirection vers /dashboard si déjà connecté et essai d'accès login/inscription
    if (user && (request.nextUrl.pathname.startsWith("/login") || request.nextUrl.pathname.startsWith("/inscription"))) {
      const url = request.nextUrl.clone()
      url.pathname = "/dashboard"
      return NextResponse.redirect(url)
    }

    return supabaseResponse
  } catch (globalError) {
    // Fail gracefully on any unexpected critical crash to prevent 500 INTERNAL SERVER ERROR 
    console.error("Middleware global crash:", globalError)
    return supabaseResponse
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"
  ],
}
