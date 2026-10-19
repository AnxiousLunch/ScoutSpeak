
'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { FormEvent } from 'react'

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

type AuthActionResult =
  | { error: string; success?: never; redirect?: never }
  | { error?: never; success: string; redirect?: never }
  | { error?: never; success?: never; redirect: string }

interface AuthFormProps {
  mode: 'signup' | 'login'
  action: (formData: FormData) => Promise<AuthActionResult>
}

export function AuthForm({ mode, action }: AuthFormProps) {
  const router = useRouter()

  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const title = mode === 'signup' ? 'Create your account' : 'Sign in'

  const description =
    mode === 'signup'
      ? 'Sign up to start using ScoutSpeak.'
      : 'Welcome back. Sign in to continue.'

  const submitLabel = mode === 'signup' ? 'Sign up' : 'Sign in'

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (isPending) return

    setError(null)
    setSuccess(null)
    setIsPending(true)

    try {
      const formData = new FormData(event.currentTarget)
      const result: unknown = await action(formData)

      if (!result || typeof result !== 'object') {
        setError('An unexpected response was received. Please try again.')
        return
      }

      if ('error' in result && typeof result.error === 'string') {
        setError(result.error)
        return
      }

      if ('success' in result && typeof result.success === 'string') {
        setSuccess(result.success)
        return
      }

      if ('redirect' in result && typeof result.redirect === 'string') {
        router.push(result.redirect)
        router.refresh()
        return
      }

      setError('An unexpected response was received. Please try again.')
    } catch (err) {
      console.error('Authentication error:', err)

      setError(
        err instanceof Error
          ? err.message
          : 'Something went wrong. Please try again.'
      )
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Card className="mx-auto w-full max-w-sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              disabled={isPending}
            />
            <p className="form-hint">Use an email address you can access. We may send a confirmation link when you create an account.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete={
                mode === 'signup' ? 'new-password' : 'current-password'
              }
              placeholder="••••••••"
              disabled={isPending}
            />
            {mode === 'signup' && <p className="form-hint">Use at least 8 characters. A password manager can help you keep it unique.</p>}
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isPending}
          >
            {isPending ? 'Working…' : submitLabel}
          </Button>

          {error && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert>
              <AlertTitle>Check your email</AlertTitle>
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}
        </form>
      </CardContent>
    </Card>
  )
}
