import { useEffect, useRef, useState } from 'react'
import MuteButton from '../components/MuteButton'
import TopUpButton from './TopUpButton'
import { STREAK_BADGE_AT, useWallet } from './walletStore'

const DURATION_MS = 600

/**
 * Fixed HUD at the top of the screen: balance pill (counts up/down to the new balance) with a flame
 * badge for a win streak, mute + stats buttons (when onOpenStats is given), and the free top-up
 * button when the balance is low.
 */
export default function CoinCounter({ onOpenStats }: { onOpenStats?: () => void }) {
  const coins = useWallet((s) => s.coins)
  const winStreak = useWallet((s) => s.winStreak)
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
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex flex-col items-center gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
      {/* 1fr | auto | 1fr keeps the balance centred whether or not the side items show. */}
      <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="flex justify-end">{onOpenStats && <MuteButton />}</div>

        <div className="relative flex items-center gap-2 rounded-full border border-coin/40 bg-black/70 px-5 py-2 shadow-[0_0_20px_rgba(250,204,21,0.35)] backdrop-blur">
          <span aria-hidden className="text-2xl">🪙</span>
          <span className={`text-2xl font-black tabular-nums transition-colors duration-300 ${color}`}>
            {shown.toLocaleString()}
          </span>
          {winStreak >= STREAK_BADGE_AT && (
            <span
              key={winStreak}
              aria-label={`${winStreak} wins in a row`}
              className="absolute -bottom-3 -right-3 flex h-7 animate-pop items-center gap-0.5 rounded-full border border-orange-400/70 bg-gradient-to-b from-orange-500 to-red-600 px-2 shadow-[0_0_16px_rgba(249,115,22,0.7)]"
            >
              <span aria-hidden className="inline-block animate-flicker text-sm">🔥</span>
              <span className="text-sm font-black tabular-nums text-white">{winStreak}</span>
            </span>
          )}
        </div>

        <div className="flex justify-start">
          {onOpenStats && (
            <button
              type="button"
              onClick={onOpenStats}
              aria-label="Open stats"
              className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-black/70 text-white/80 backdrop-blur active:scale-95"
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M5 20V12M12 20V5M19 20v-9" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <TopUpButton />
    </div>
  )
}
