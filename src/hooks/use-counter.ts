'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

type CounterState = {
  value: number
  loading: boolean
  incrementing: boolean
  error: string | null
}

export function useCounter(initialValue?: number) {
  const [state, setState] = useState<CounterState>({
    value: initialValue ?? 0,
    loading: initialValue === undefined,
    incrementing: false,
    error: null,
  })

  const fetchValue = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }))

    const supabase = createClient()
    const { data, error } = await supabase
      .from('counter')
      .select('value')
      .eq('id', 1)
      .single()

    if (error) {
      setState((s) => ({
        ...s,
        loading: false,
        error: `Failed to load counter: ${error.message}`,
      }))
      return
    }

    setState((s) => ({
      ...s,
      value: data.value,
      loading: false,
      error: null,
    }))
  }, [])

  const increment = useCallback(async () => {
    setState((s) => ({ ...s, incrementing: true, error: null }))

    const supabase = createClient()
    const { data, error } = await supabase.rpc('increment_counter')

    if (error) {
      setState((s) => ({
        ...s,
        incrementing: false,
        error: `Failed to increment: ${error.message}`,
      }))
      return
    }

    setState((s) => ({
      ...s,
      value: data ?? s.value + 1,
      incrementing: false,
      error: null,
    }))
  }, [])

  useEffect(() => {
    if (initialValue === undefined) {
      void fetchValue()
    }
  }, [initialValue, fetchValue])

  return {
    value: state.value,
    loading: state.loading,
    incrementing: state.incrementing,
    error: state.error,
    increment,
    refetch: fetchValue,
  }
}
