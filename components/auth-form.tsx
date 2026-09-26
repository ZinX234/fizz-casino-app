'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { authClient } from '@/lib/auth/client'

function getAuthErrorMessage(error: unknown, isSignUp: boolean) {
  const message =
    error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
      ? error.message.toLowerCase()
      : ''

  if (message.includes('invalid origin')) {
    return 'This page is not authorized by Neon Auth. Open the current Fizz preview and try again.'
  }

  if (
    message.includes('invalid email') ||
    message.includes('invalid password') ||
    message.includes('unauthorized') ||
    message.includes('credential') ||
    message.includes('user not found')
  ) {
    return 'The email or password is incorrect. Check your details and try again.'
  }

  if (message.includes('already exists') || message.includes('already registered')) {
    return 'An account with this email already exists. Sign in instead.'
  }

  if (message.includes('fetch') || message.includes('network')) {
    return 'Neon Auth could not be reached. Check your connection and try again.'
  }

  return isSignUp
    ? 'We could not create your account. Check your details and try again.'
    : 'We could not sign you in. Check your details and try again.'
}

export function AuthForm({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const isSignUp = mode === 'sign-up'

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setPending(true)
    try {
      const result = isSignUp
        ? await authClient.signUp.email({ email: email.trim(), password, name: name.trim() })
        : await authClient.signIn.email({ email: email.trim(), password })
      if (result.error) {
        setError(getAuthErrorMessage(result.error, isSignUp))
        return
      }

      router.replace('/account')
      router.refresh()
    } catch (authError) {
      setError(getAuthErrorMessage(authError, isSignUp))
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="flex min-h-[calc(100svh-68px)] items-center justify-center px-4 py-12">
      <section className="w-full max-w-[440px] rounded-[28px] border border-white/[0.08] bg-[#111318] p-6 shadow-2xl sm:p-9">
        <p className="eyebrow">Fizz Casino</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">{isSignUp ? 'Create your account' : 'Welcome back.'}</h1>
        <p className="mt-2 text-sm leading-6 text-white/45">{isSignUp ? 'Your Fizz account starts here.' : 'Sign in to view your account and wallet.'}</p>
        <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
          {isSignUp && <div className="flex flex-col gap-2"><label htmlFor="name" className="text-xs font-semibold text-white/70">Name</label><input id="name" name="name" type="text" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required minLength={2} maxLength={80} className="form-input" /></div>}
          <div className="flex flex-col gap-2"><label htmlFor="email" className="text-xs font-semibold text-white/70">Email</label><input id="email" name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={254} className="form-input" /></div>
          <div className="flex flex-col gap-2"><label htmlFor="password" className="text-xs font-semibold text-white/70">Password</label><input id="password" name="password" type="password" autoComplete={isSignUp ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} maxLength={128} className="form-input" /></div>
          {error && <p role="alert" className="rounded-xl border border-rose-300/15 bg-rose-300/[0.06] px-3 py-2 text-sm text-rose-100/85">{error}</p>}
          <button type="submit" disabled={pending} className="mt-2 inline-flex min-h-12 items-center justify-center rounded-full bg-[#f4bc63] px-5 text-sm font-bold text-[#1a140b] transition hover:bg-[#ffd48d] disabled:cursor-wait disabled:opacity-60">{pending ? 'Please wait…' : isSignUp ? 'Create account' : 'Sign in'}</button>
        </form>
        <p className="mt-6 text-center text-sm text-white/45">{isSignUp ? 'Already have an account?' : 'New to Fizz?'} <Link href={isSignUp ? '/auth/sign-in' : '/auth/sign-up'} className="font-semibold text-amber-100 hover:underline">{isSignUp ? 'Sign in' : 'Create an account'}</Link></p>
        <p className="mt-5 text-center text-[11px] leading-5 text-white/30">Only use Fizz where online gaming is legal and you meet the age requirement.</p>
      </section>
    </main>
  )
}
