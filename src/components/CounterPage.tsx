'use client'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useCounter } from '@/hooks/use-counter'

export function CounterPage({ initialValue }: { initialValue?: number }) {
  const { value, loading, incrementing, error, increment } =
    useCounter(initialValue)

  return (
    <div className="flex items-start justify-center pt-12">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl">ScoutSpeak Counter</CardTitle>
          <CardDescription>Persistent Supabase-backed counter</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-6">
          {loading ? (
            <Skeleton className="h-16 w-32" aria-hidden="true" />
          ) : (
            <div
              className="text-6xl font-bold tabular-nums"
              aria-live="polite"
              aria-label="Current counter value"
            >
              {value}
            </div>
          )}

          <Button
            onClick={increment}
            disabled={loading || incrementing}
            size="lg"
          >
            {incrementing ? 'Incrementing…' : 'Increment'}
          </Button>

          {error && (
            <p className="text-center text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
