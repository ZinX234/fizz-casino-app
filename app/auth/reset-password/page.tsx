import { CasinoHeaderForAccount } from '@/components/casino-home'
import { PasswordResetForm } from '@/components/password-reset-form'

export const metadata = { title: 'Reset password | Fizz Casino' }

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[]; error?: string | string[] }>
}) {
  const params = await searchParams
  const token = typeof params.token === 'string' ? params.token : ''
  const invalidToken = typeof params.error === 'string'

  return (
    <div className="min-h-screen bg-[#0b0c10] text-white">
      <CasinoHeaderForAccount />
      <PasswordResetForm token={token} invalidToken={invalidToken} />
    </div>
  )
}
