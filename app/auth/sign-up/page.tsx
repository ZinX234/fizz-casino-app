import { CasinoHeaderForAccount } from '@/components/casino-home'
import { AuthForm } from '@/components/auth-form'

export const metadata = { title: 'Create account | Fizz Casino' }

export default function SignUpPage() {
  return <div className="min-h-screen bg-[#0b0c10] text-white"><CasinoHeaderForAccount /><AuthForm mode="sign-up" /></div>
}
