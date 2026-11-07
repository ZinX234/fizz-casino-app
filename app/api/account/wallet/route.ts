import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/server'
import { getWalletSnapshot } from '@/lib/casino-data'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  const { data: session } = await auth.getSession()
  if (!session?.user) {
    return NextResponse.json({ error: 'Sign in to view your wallet.' }, { status: 401 })
  }

  const wallet = await getWalletSnapshot(session.user.id)
  return NextResponse.json(
    { wallet: { balance: wallet.balance, currency: wallet.currency } },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      },
    },
  )
}
