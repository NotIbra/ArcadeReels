import { useEffect, useRef, useState } from 'react'
import { useWallet } from './walletStore'

const DURATION_MS = 600

/** Fixed balance pill at the top of the screen; counts up/down to the new balance. */
export default function CoinCounter() {
  const coins = useWallet((s) => s.coins)
  const [shown, setShown] = useState(coins)
  const [trend, setTrend] = useState<'up' | 'down' | null>(null)
  const shownRef = useRef(coins)

  useEffect(() => {
    const from = shownRef.current
    if (from === coins) return
    setTrend(coins > from ? 'up' : 'down')
    const start = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION_MS)
      const eased = 1 - (1 - t) ** 3
      const value = Math.round(from + (coins - from) * eased)
      shownRef.current = value
      setShown(value)
      if (t < 1) frame = requestAnimationFrame(tick)
      else setTrend(null)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [coins])

  const color = trend === 'up' ? 'text-win' : trend === 'down' ? 'text-loss' : 'text-coin'

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center pt-[max(0.75rem,env(safe-area-inset-top))]">
      <div className="flex items-center gap-2 rounded-full border border-coin/40 bg-black/70 px-5 py-2 shadow-[0_0_20px_rgba(250,204,21,0.35)] backdrop-blur">
        <span aria-hidden className="text-2xl">🪙</span>
        <span className={`text-2xl font-black tabular-nums transition-colors duration-300 ${color}`}>
          {shown.toLocaleString()}
        </span>
      </div>
    </div>
  )
}
