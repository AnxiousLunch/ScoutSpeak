'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

interface PingResult {
  reply: string
  model_ok: boolean
}

interface PingError {
  error: string
  message?: string
}

export default function DevAiPage() {
  const [prompt, setPrompt] = useState('Ping. Return the JSON object only.')
  const [result, setResult] = useState<PingResult | null>(null)
  const [error, setError] = useState<PingError | null>(null)
  const [loading, setLoading] = useState(false)

  async function runPing() {
    setLoading(true)
    setResult(null)
    setError(null)

    try {
      const res = await fetch('/api/ai/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })

      const body = (await res.json()) as PingResult | PingError

      if (!res.ok) {
        setError(body as PingError)
      } else {
        setResult(body as PingResult)
      }
    } catch (e) {
      setError({
        error: 'fetch_failed',
        message: e instanceof Error ? e.message : 'Request failed',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">AI ping</h1>
        <p className="text-sm text-muted-foreground">
          Run a live call through the server-side AI adapter.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Prompt</CardTitle>
          <CardDescription>
            Sent as the user message to the model. The route always asks for a JSON reply.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="prompt">User prompt</Label>
            <Textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              disabled={loading}
            />
          </div>

          <Button onClick={runPing} disabled={loading}>
            {loading ? 'Running…' : 'Run live AI call'}
          </Button>

          {loading && (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertTitle>Error: {error.error}</AlertTitle>
              <AlertDescription>
                {error.message ?? 'The AI call failed.'}
              </AlertDescription>
            </Alert>
          )}

          {result && (
            <div className="rounded-md border bg-muted p-4">
              <p className="text-sm font-medium">Validated result</p>
              <pre className="mt-2 overflow-auto text-xs">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
