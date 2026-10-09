'use client'

import { useState } from 'react'
import { Save, Zap } from 'lucide-react'
import type { SweetBonanzaConfig, SweetBonanzaProfile, SweetBonanzaSymbol, SymbolConfig } from '@/lib/sweet-bonanza-config'

const SYMBOL_NAMES: Record<SweetBonanzaSymbol, string> = {
  a: 'Apple',
  b: 'Banana',
  c: 'Coconut',
  g: 'Grape',
  h: 'Heart',
  m: 'Melon',
  p: 'Peach',
  s: 'Plum',
  z: 'Watermelon',
  scatter: 'Scatter',
}

type Props = {
  initialConfig: SweetBonanzaConfig
}

export function AdminSweetBonanzaSettings({ initialConfig }: Props) {
  const [config, setConfig] = useState(initialConfig)
  const [publishedConfig, setPublishedConfig] = useState(initialConfig)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)

  const activeProfile = config.profiles.find((p) => p.id === config.activeProfileId) ?? config.profiles[0]

  function updateSymbol(symbol: SweetBonanzaSymbol, field: keyof SymbolConfig, value: number) {
    setConfig((current) => ({
      ...current,
      profiles: current.profiles.map((profile) =>
        profile.id === activeProfile.id
          ? {
              ...profile,
              symbols: {
                ...profile.symbols,
                [symbol]: {
                  ...profile.symbols[symbol],
                  [field]: value,
                },
              },
            }
          : profile,
      ),
    }))
  }

  function updateProfileField(field: keyof SweetBonanzaProfile, value: number | string | boolean) {
    setConfig((current) => ({
      ...current,
      profiles: current.profiles.map((profile) =>
        profile.id === activeProfile.id
          ? {
              ...profile,
              [field]: value,
            }
          : profile,
      ),
    }))
  }

  async function save() {
    setSaving(true)
    setMessage(null)
    try {
      const response = await fetch('/api/admin/sweet-bonanza-settings', {
        method: 'POST',
        cache: 'no-store',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ configuration: config }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.error ?? 'Could not save Sweet Bonanza settings.')
      setConfig(result.configuration ?? config)
      setPublishedConfig(result.configuration ?? config)
      setMessage({ text: 'Sweet Bonanza settings saved successfully.', error: false })
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'Could not save Sweet Bonanza settings.', error: true })
    } finally {
      setSaving(false)
    }
  }

  const hasUnsavedChanges = JSON.stringify(config) !== JSON.stringify(publishedConfig)

  return (
    <section className="mt-8 rounded-[24px] border border-pink-100/10 bg-[#12141a] p-5 sm:p-7" aria-labelledby="sweet-bonanza-settings-heading">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="eyebrow">Sweet Bonanza configuration</p>
          <h2 id="sweet-bonanza-settings-heading" className="mt-2 text-xl font-bold">Symbol weights & payouts</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">
            Configure symbol appearance weights, payout multipliers, and RTP profiles. Higher weights mean symbols appear more frequently. Changes apply immediately to new spins.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-pink-200/10 bg-pink-200/[0.04] px-3 py-2 text-[11px] font-semibold text-pink-100/70">
          <Zap aria-hidden="true" className="size-4" /> Server-enforced
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-white/[0.07] bg-black/10 p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-bold">Active profile: {activeProfile.name}</h3>
          <div className="flex items-center gap-4 text-xs">
            <span className="text-white/50">RTP: {(activeProfile.rtpBps / 100).toFixed(2)}%</span>
            <span className="text-white/50">Buy bonus: {activeProfile.buyBonusCost} FC</span>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-white/50">RTP (Return to Player)</label>
            <div className="mt-2 flex items-center rounded-lg border border-white/10 bg-black/20 px-2.5 focus-within:border-pink-200/40">
              <input
                type="number"
                min="55"
                max="99"
                step="0.01"
                value={(activeProfile.rtpBps / 100).toFixed(2)}
                onChange={(e) => updateProfileField('rtpBps', Number.parseFloat(e.target.value) * 100)}
                className="w-full bg-transparent py-2 text-sm font-bold tabular-nums text-white outline-none"
              />
              <span className="text-xs text-white/40">%</span>
            </div>
            <p className="mt-1 text-[10px] text-white/40">Range: 55% - 99% (lower RTP = higher house edge)</p>
          </div>

          <div>
            <label className="text-xs text-white/50">Buy bonus cost (Fizzcoins)</label>
            <div className="mt-2 flex items-center rounded-lg border border-white/10 bg-black/20 px-2.5 focus-within:border-pink-200/40">
              <input
                type="number"
                min="1000"
                step="100"
                value={activeProfile.buyBonusCost}
                onChange={(e) => updateProfileField('buyBonusCost', Number.parseInt(e.target.value, 10))}
                className="w-full bg-transparent py-2 text-sm font-bold tabular-nums text-white outline-none"
              />
              <span className="text-xs text-white/40">FC</span>
            </div>
          </div>

          <div>
            <label className="text-xs text-white/50">Bonus free spins</label>
            <div className="mt-2 flex items-center rounded-lg border border-white/10 bg-black/20 px-2.5 focus-within:border-pink-200/40">
              <input
                type="number"
                min="1"
                step="1"
                value={activeProfile.bonusFreeSpins}
                onChange={(e) => updateProfileField('bonusFreeSpins', Number.parseInt(e.target.value, 10))}
                className="w-full bg-transparent py-2 text-sm font-bold tabular-nums text-white outline-none"
              />
              <span className="text-xs text-white/40">spins</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/50">Bonus multiplier min</label>
              <div className="mt-2 flex items-center rounded-lg border border-white/10 bg-black/20 px-2.5 focus-within:border-pink-200/40">
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={activeProfile.bonusMultiplierMin}
                  onChange={(e) => updateProfileField('bonusMultiplierMin', Number.parseInt(e.target.value, 10))}
                  className="w-full bg-transparent py-2 text-sm font-bold tabular-nums text-white outline-none"
                />
                <span className="text-xs text-white/40">×</span>
              </div>
            </div>
            <div>
              <label className="text-xs text-white/50">Bonus multiplier max</label>
              <div className="mt-2 flex items-center rounded-lg border border-white/10 bg-black/20 px-2.5 focus-within:border-pink-200/40">
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={activeProfile.bonusMultiplierMax}
                  onChange={(e) => updateProfileField('bonusMultiplierMax', Number.parseInt(e.target.value, 10))}
                  className="w-full bg-transparent py-2 text-sm font-bold tabular-nums text-white outline-none"
                />
                <span className="text-xs text-white/40">×</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="guaranteed-multiplier"
              checked={activeProfile.guaranteedMultiplierInBonus}
              onChange={(e) => updateProfileField('guaranteedMultiplierInBonus', e.target.checked)}
              className="size-4 rounded border-white/10 bg-black/20 text-pink-400 focus:ring-pink-400"
            />
            <label htmlFor="guaranteed-multiplier" className="text-xs text-white/70">
              Guarantee multiplier in bonus round
            </label>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-white/[0.07] bg-black/10 p-4 sm:p-5">
        <h3 className="mb-4 text-sm font-bold">Symbol configurations</h3>
        <div className="space-y-3">
          {(['a', 'b', 'c', 'g', 'h', 'm', 'p', 's', 'z', 'scatter'] as SweetBonanzaSymbol[]).map((symbol) => {
            const symbolConfig = activeProfile.symbols[symbol]
            const isScatter = symbol === 'scatter'
            return (
              <div key={symbol} className="grid grid-cols-1 gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 sm:grid-cols-4">
                <div className="sm:col-span-1">
                  <label className="text-xs text-white/50">Symbol</label>
                  <p className="mt-1 text-sm font-bold text-white">{SYMBOL_NAMES[symbol]}</p>
                  {isScatter && <p className="text-[10px] text-pink-200/70">Triggers bonus (4+)</p>}
                </div>
                <div>
                  <label className="text-xs text-white/50">Weight (frequency)</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={symbolConfig.weight}
                    onChange={(e) => updateSymbol(symbol, 'weight', Number.parseInt(e.target.value, 10))}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-2.5 py-2 text-sm font-bold text-white outline-none focus:border-pink-200/40"
                  />
                </div>
                <div>
                  <label className="text-xs text-white/50">{isScatter ? 'N/A (scatter)' : 'Payout multiplier (8+)'}</label>
                  <input
                    type="number"
                    min="1"
                    step="0.5"
                    value={symbolConfig.payoutMultiplier}
                    onChange={(e) => updateSymbol(symbol, 'payoutMultiplier', Number.parseFloat(e.target.value))}
                    disabled={isScatter}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-2.5 py-2 text-sm font-bold text-white outline-none focus:border-pink-200/40 disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="text-xs text-white/50">{isScatter ? 'Min for bonus (4)' : 'Min match'}</label>
                  <input
                    type="number"
                    min="4"
                    max="8"
                    value={symbolConfig.minMatch}
                    onChange={(e) => updateSymbol(symbol, 'minMatch', Number.parseInt(e.target.value, 10))}
                    disabled={isScatter}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-2.5 py-2 text-sm font-bold text-white outline-none focus:border-pink-200/40 disabled:opacity-50"
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between">
        {hasUnsavedChanges && <p className="text-xs font-medium text-pink-100/80">Unsaved changes pending</p>}
        <button
          type="button"
          disabled={saving || !hasUnsavedChanges}
          onClick={save}
          className="ml-auto inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-pink-400 px-4 text-xs font-bold text-[#1a140b] transition hover:bg-pink-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save aria-hidden="true" className="size-3.5" />
          {saving ? 'Saving…' : 'Save settings'}
        </button>
      </div>

      {message && (
        <p role={message.error ? 'alert' : 'status'} aria-live="polite" className={`mt-3 text-xs ${message.error ? 'text-rose-200/80' : 'text-emerald-200/80'}`}>
          {message.text}
        </p>
      )}
    </section>
  )
}
