import { useEffect, useState } from 'react'
import { LOW_BALANCE, TOP_UP_AMOUNT, topUpAvailableIn, useWallet } from './walletStore'

function formatCooldown(ms: number) {
  const secs = Math.ceil(ms / 1000)
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`
}

/** Appears on its own when the balance drops below LOW_BALANCE; shows a countdown while on cooldown. */
export default function TopUpButton() {
  const coins = useWallet((s) => s.coins)
  const lastTopUpAt = useWallet((s) => s.lastTopUpAt)
  const claimTopUp = useWallet((s) => s.claimTopUp)
  const low = coins < LOW_BALANCE
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (!low) return
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [low])

  if (!low) return null

  const cooldown = topUpAvailableIn(lastTopUpAt, now)
  const ready = cooldown === 0

  return (
    <button
      type="button"
      onClick={claimTopUp}
      disabled={!ready}
      className={`pointer-events-auto flex min-h-12 animate-pop items-center gap-2 rounded-full px-5 text-lg font-black shadow-lg transition active:scale-95 ${
        ready
          ? 'bg-coin text-black shadow-[0_0_24px_rgba(250,204,21,0.6)]'
          : 'border border-white/15 bg-black/80 text-white/70 backdrop-blur'
      }`}
    >
      {ready ? `🎁 Free +${TOP_UP_AMOUNT} coins` : `Free coins in ${formatCooldown(cooldown)}`}
    </button>
  )
}
