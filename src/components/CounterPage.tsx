'use client'

import { useCounter } from '@/hooks/use-counter'

export function CounterPage({ initialValue }: { initialValue?: number }) {
  const { value, loading, incrementing, error, increment } =
    useCounter(initialValue)

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <h1 className="text-center text-3xl font-bold">ScoutSpeak Counter</h1>
        <p className="mt-2 text-center text-neutral-600 dark:text-neutral-400">
          Persistent Supabase-backed counter
        </p>

        <div className="mt-8 flex flex-col items-center gap-6">
          {loading ? (
            <div
              className="h-16 w-32 animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-800"
              aria-hidden="true"
            />
          ) : (
            <div
              className="text-6xl font-bold tabular-nums"
              aria-live="polite"
              aria-label="Current counter value"
            >
              {value}
            </div>
          )}

          <button
            type="button"
            onClick={increment}
            disabled={loading || incrementing}
            className="rounded-full bg-sky-600 px-8 py-3 text-lg font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {incrementing ? 'Incrementing…' : 'Increment'}
          </button>
        </div>

        {error && (
          <p className="mt-6 text-center text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>
    </main>
  )
}
