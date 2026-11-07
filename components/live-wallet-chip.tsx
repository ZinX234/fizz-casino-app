"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { formatFizzcoins } from "@/lib/format-money"

export function LiveWalletChip({ initialBalance }: { initialBalance: string | number }) {
  const [balance, setBalance] = useState(Number(initialBalance) || 0)

  useEffect(() => {
    setBalance(Number(initialBalance) || 0)
  }, [initialBalance])

  useEffect(() => {
    const handleWalletSync = (event: Event) => {
      const detail = (event as CustomEvent<{ balance?: string | number }>).detail
      const nextBalance = Number(detail?.balance)
      if (Number.isFinite(nextBalance)) setBalance(nextBalance)
    }
    window.addEventListener("fizz:wallet-sync", handleWalletSync)
    let active = true
    const refresh = async () => {
      try {
        const response = await fetch(`/api/account/wallet?ts=${Date.now()}`, { cache: "no-store", credentials: "same-origin" })
        if (!response.ok) return
        const data = await response.json()
        const nextBalance = Number(data?.wallet?.balance)
        if (active && Number.isFinite(nextBalance) && nextBalance >= 0) setBalance(nextBalance)
      } catch {}
    }
    refresh()
    const interval = window.setInterval(refresh, 5000)
    return () => {
      active = false
      window.clearInterval(interval)
      window.removeEventListener("fizz:wallet-sync", handleWalletSync)
    }
  }, [])

  return (
    <Link href="/account" aria-label={`Wallet balance: ${formatFizzcoins(String(balance), "USD")}`} className="rounded-lg border border-white/[0.12] bg-[#111217] px-3 py-2 text-xs font-semibold text-white/90">
      {formatFizzcoins(String(balance), "USD")}
    </Link>
  )
}
