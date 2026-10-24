import { useEffect, useState } from 'react'
import { games } from '../games/registry'
import { spookyCannons } from '../theme/effects'
import { useWallet } from '../wallet/walletStore'

const SHOW_MS = 4500
const CANNON_MS = 1800
const COUNT_MS = 1400

/** Full-screen celebration whenever the wallet records a payout of BIG_WIN_MULT× or more. */
export default function BigWinOverlay() {
  const bigWin = useWallet((s) => s.bigWin)
  const dismiss = useWallet((s) => s.dismissBigWin)
  const [shown, setShown] = useState(0)

  useEffect(() => {
    if (!bigWin) return
    const end = performance.now() + CANNON_MS
    let frame = 0
    let odd = false
    const start = performance.now()

    const tick = (now: number) => {
      // Emoji cannons from both sides for the first CANNON_MS (every other frame keeps it light).
      odd = !odd
      if (now < end && odd) spookyCannons()
      const t = Math.min(1, (now - start) / COUNT_MS)
      setShown(Math.round(bigWin.payout * (1 - (1 - t) ** 3)))
      if (now < end || t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    const timer = setTimeout(dismiss, SHOW_MS)
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(timer)
    }
  }, [bigWin, dismiss])

  if (!bigWin) return null

  const name = games.find((g) => g.id === bigWin.game)?.name ?? bigWin.game
  const mult = Number.isInteger(bigWin.mult) ? bigWin.mult : bigWin.mult.toFixed(1)

  return (
    <div
      role="alertdialog"
      aria-label={`Spooktacular win: ${bigWin.payout} coins`}
      onClick={dismiss}
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_45%,rgba(90,30,10,0.92)_0%,rgba(13,6,20,0.96)_70%)] px-4 text-center backdrop-blur-sm"
    >
      <span
        aria-hidden
        key={bigWin.at}
        className="motion-safe-only pointer-events-none absolute bottom-0 left-1/2 -ml-12 animate-ghost-rise text-8xl opacity-0 drop-shadow-[0_0_30px_rgba(243,238,252,0.6)]"
      >
        👻
      </span>

      <span className="animate-pop text-sm font-bold uppercase tracking-[0.4em] text-white/80">{name}</span>
      <h2 className="mt-2 animate-pop font-display leading-[0.9] text-coin drop-shadow-[0_0_24px_rgba(255,117,24,0.8)]">
        <span className="block text-[clamp(2.75rem,13vw,4.5rem)]">Spooktacular</span>
        <span className="block text-[clamp(3.5rem,18vw,6rem)] text-win drop-shadow-[0_0_24px_rgba(57,255,20,0.6)]">Win!</span>
      </h2>
      <span className="mt-4 animate-pop rounded-full bg-coin/20 px-4 py-1 text-2xl font-black text-coin">{mult}×</span>
      <span className="mt-5 text-6xl font-black tabular-nums text-win drop-shadow-[0_0_20px_rgba(57,255,20,0.5)]">
        +{shown.toLocaleString()}
      </span>
      <span className="mt-1 text-lg text-white/70">candy corn coins</span>
      <span className="mt-10 text-sm text-white/60">Tap to continue</span>
    </div>
  )
}
