import { redirect } from 'next/navigation'
import { AccountNavigation, CasinoHeaderForAccount, CasinoPageHeader } from '@/components/casino-home'
import { auth } from '@/lib/auth/server'
import { getPlayerProfile } from '@/lib/player-profile'
import { ProfileSettingsForm } from './profile-settings-form'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Profile settings | Fizz Casino' }

export default async function ProfileSettingsPage() {
  const { data: session } = await auth.getSession()
  if (!session?.user) redirect('/auth/sign-in')

  let initialProfile: { username: string; paypalFirstName: string; paypalLastName: string; paypalEmail: string } | null = null
  try {
    const profile = await getPlayerProfile(session.user.id)
    if (profile) {
      initialProfile = {
        username: profile.username,
        paypalFirstName: profile.paypal_first_name,
        paypalLastName: profile.paypal_last_name,
        paypalEmail: profile.paypal_email,
      }
    }
  } catch (error) {
    console.error('[v0] Profile settings load failed:', error instanceof Error ? error.message : 'unknown error')
  }

  return <div className="min-h-screen bg-[#0b0c10] text-white"><CasinoHeaderForAccount /><main className="mx-auto max-w-7xl px-5 py-9 sm:px-8 sm:py-14"><CasinoPageHeader eyebrow="Your Fizz account" title="Profile settings" detail="Set your public Fizz username and the PayPal details used for manual payments." /><AccountNavigation active="profile" />
    <section className="max-w-3xl rounded-2xl border border-white/[0.08] bg-[#12141a] p-5 sm:p-7">
      {!session.user.email && <p role="alert" className="mb-5 rounded-xl border border-rose-300/15 bg-rose-300/[0.06] p-3 text-sm text-rose-100/85">Your Fizz sign-in account needs an email before you can complete your profile.</p>}
      <ProfileSettingsForm initialProfile={initialProfile} fizzEmail={session.user.email ?? ''} />
    </section>
    <p className="mt-6 text-xs leading-5 text-white/35">Profile settings are private to your account except for your Fizz username, which is shown to other players.</p>
  </main></div>
}
