import { AuthForm } from '@/components/AuthForm'
import { signup } from '../auth/actions'

export const metadata = {
  title: 'Sign up — ScoutSpeak',
}

export default function SignupPage() {
  return (
    <div className="flex items-start justify-center pt-12">
      <AuthForm mode="signup" action={signup} />
    </div>
  )
}
