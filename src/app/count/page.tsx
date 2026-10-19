import { redirect } from 'next/navigation'

export default function CountPage() {
  // Legacy demo route: keep redirect so old links do not break.
  redirect('/profile')
}
