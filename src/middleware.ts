import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import type { SetAllCookies } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/utils/supabase/database.types'

const PUBLIC_PAGES = [
  '/login',
  '/signup',
  '/count',
  '/mfa/enroll',
  '/mfa/challenge',
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const response = NextResponse.next({ request })

  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY

  if (!url || !key) {
    console.error('Missing Supabase environment variables in middleware')
    return response
  }

  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll().map((cookie) => ({
          name: cookie.name,
          value: cookie.value,
        }))
      },
      setAll: ((cookiesToSet) => {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options)
        })
      }) satisfies SetAllCookies,
    },
  }) as unknown as SupabaseClient<Database>

  const {
    data: { session },
  } = await supabase.auth.getSession()
  const { data: aal, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  const { data: factorsData } = await supabase.auth.mfa.listFactors()

  const isApi = pathname.startsWith('/api/')
  const isStatic =
    pathname.startsWith('/_next/') || pathname.startsWith('/favicon')
  const isPublicPage = PUBLIC_PAGES.includes(pathname) || isStatic

  if (!session) {
    if (isApi) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    }
    if (!isPublicPage) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    return response
  }

  const verifiedFactors =
    factorsData?.all?.filter((factor) => factor.status === 'verified') ?? []
  const hasVerifiedFactor = verifiedFactors.length > 0

  // No verified factor yet — force enrollment.
  if (!hasVerifiedFactor) {
    if (pathname === '/mfa/enroll') return response
    if (isApi) {
      return NextResponse.json(
        { error: 'mfa_enrollment_required' },
        { status: 403 }
      )
    }
    return NextResponse.redirect(new URL('/mfa/enroll', request.url))
  }

  // Verified factor but current session is still AAL1 — force challenge.
  if (aal?.currentLevel === 'aal1' && aal?.nextLevel === 'aal2') {
    if (pathname === '/mfa/challenge') return response
    if (isApi) {
      return NextResponse.json(
        { error: 'mfa_challenge_required' },
        { status: 403 }
      )
    }
    return NextResponse.redirect(new URL('/mfa/challenge', request.url))
  }

  // AAL2 session should not linger on MFA pages.
  if (pathname === '/mfa/enroll' || pathname === '/mfa/challenge') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
