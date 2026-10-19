import { createClient } from '@/utils/supabase/server'
import { CounterPage } from '@/components/CounterPage'

export const dynamic = 'force-dynamic'

export default async function CountPage() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('counter')
    .select('value')
    .eq('id', 1)
    .single()

  if (error) {
    console.error('Counter fetch error on /count:', error.message)
  }

  return <CounterPage initialValue={data?.value} />
}
