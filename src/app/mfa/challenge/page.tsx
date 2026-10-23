'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { createClient } from '@/utils/supabase/client'

export default function MfaChallengePage() {
  const router = useRouter()
  const [factorId, setFactorId] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadFactor() {
      const supabase = createClient()
      const { data, error: listError } = await supabase.auth.mfa.listFactors()

      if (listError) {
        setError(listError.message)
        setLoading(false)
        return
      }

      const totp = data?.totp?.find((f) => f.status === 'verified')
      if (!totp) {
        router.push('/mfa/enroll')
        return
      }

      setFactorId(totp.id)
      setLoading(false)
    }

    void loadFactor()
  }, [router])

  async function verify(event: React.FormEvent) {
    event.preventDefault()
    if (!factorId || code.length !== 6) return

    setVerifying(true)
    setError(null)

    const supabase = createClient()
    const { data: challenge, error: challengeError } =
      await supabase.auth.mfa.challenge({ factorId })

    if (challengeError) {
      setError(challengeError.message)
      setVerifying(false)
      return
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code,
    })

    if (verifyError) {
      setError(verifyError.message)
      setVerifying(false)
      return
    }

    router.push('/')
  }

  return (
    <div className="flex items-start justify-center pt-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Two-factor authentication</CardTitle>
          <CardDescription>
            Open the authenticator app you enrolled for ScoutSpeak and enter its current 6-digit code. It refreshes regularly.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <form onSubmit={verify} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Verification code</Label>
                <Input
                  id="code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="000000"
                  disabled={verifying}
                  required
                />
                <p className="form-hint">If a code is rejected, wait for the next one and check your phone’s clock is set automatically.</p>
              </div>
              <Button type="submit" className="w-full" disabled={verifying}>
                {verifying ? 'Verifying…' : 'Verify and continue'}
              </Button>
            </form>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
