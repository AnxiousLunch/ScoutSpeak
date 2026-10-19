'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { signout } from '@/app/auth/actions'

interface AuthNavProps {
  user: { email?: string } | null
}

export function AuthNav({ user }: AuthNavProps) {
  return (
    <div className="flex items-center gap-4 text-sm">
      {user ? (
        <>
          <span className="hidden text-muted-foreground sm:inline">
            {user.email}
          </span>
          <form action={signout}>
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </>
      ) : (
        <>
          <Link
            href="/login"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Sign in
          </Link>
          <Button asChild size="sm">
            <Link href="/signup">Sign up</Link>
          </Button>
        </>
      )}
    </div>
  )
}
