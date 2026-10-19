import { AuthForm } from '@/components/AuthForm'
import { login } from '../auth/actions'

export const metadata = {
  title: 'Sign in — ScoutSpeak',
}

export default function LoginPage() {
  return (
    <div className="flex items-start justify-center pt-12">
      <AuthForm mode="login" action={login} />
    </div>
  )
}
