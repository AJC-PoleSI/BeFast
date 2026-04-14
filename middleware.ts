import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      // If env vars missing, allow request through (fail open for safety)
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

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const publicPaths = [
      "/login",
      "/inscription",
      "/mot-de-passe-oublie",
      "/auth/callback",
    ]
    const isPublicPath = publicPaths.some((p) =>
      request.nextUrl.pathname.startsWith(p)
    )

    if (!user && !isPublicPath) {
      const url = request.nextUrl.clone()
      url.pathname = "/login"
      return NextResponse.redirect(url)
    }

    if (
      user &&
      (request.nextUrl.pathname === "/login" ||
        request.nextUrl.pathname === "/inscription")
    ) {
      const url = request.nextUrl.clone()
      url.pathname = "/dashboard"
      return NextResponse.redirect(url)
    }
  } catch (error) {
    // If auth check fails, allow public paths through, redirect others to login
    const publicPaths = [
      "/login",
      "/inscription",
      "/mot-de-passe-oublie",
      "/auth/callback",
    ]
    const isPublicPath = publicPaths.some((p) =>
      request.nextUrl.pathname.startsWith(p)
    )

    if (!isPublicPath) {
      const url = request.nextUrl.clone()
      url.pathname = "/login"
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
