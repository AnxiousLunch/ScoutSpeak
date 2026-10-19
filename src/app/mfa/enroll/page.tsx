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

export default function MfaEnrollPage() {
  const router = useRouter()
  const [qr, setQr] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [factorId, setFactorId] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function enroll() {
      const supabase = createClient()

      // Remove any stale unverified factors first.
      const { data: factorsData } = await supabase.auth.mfa.listFactors()
      for (const factor of factorsData?.all?.filter((f) => f.status === 'unverified') ?? []) {
        await supabase.auth.mfa.unenroll({ factorId: factor.id }).catch(() => {
          // Ignore cleanup failures.
        })
      }

      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
      })

      if (enrollError || !data) {
        setError(enrollError?.message ?? 'Enrollment failed')
        setLoading(false)
        return
      }

      setFactorId(data.id)
      setQr(data.totp.qr_code)
      setSecret(data.totp.secret)
      setLoading(false)
    }

    void enroll()
  }, [])

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
          <CardTitle>Set up two-factor authentication</CardTitle>
          <CardDescription>
            Scan the QR code with your authenticator app, then enter the 6-digit
            code to verify.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ) : qr ? (
            <>
              <div className="flex justify-center rounded-lg border bg-white p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr} alt="TOTP QR code" className="h-48 w-48" />
              </div>
              {secret && (
                <p className="break-all text-center text-sm text-muted-foreground">
                  Secret: {secret}
                </p>
              )}

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
                </div>
                <Button type="submit" className="w-full" disabled={verifying}>
                  {verifying ? 'Verifying…' : 'Verify and continue'}
                </Button>
              </form>
            </>
          ) : null}

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
