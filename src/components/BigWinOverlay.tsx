import confetti from 'canvas-confetti'
import { useEffect, useState } from 'react'
import { games } from '../games/registry'
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
    const colors = ['#facc15', '#22c55e', '#e879f9', '#ffffff']
    const end = performance.now() + CANNON_MS
    let frame = 0
    const start = performance.now()

    const tick = (now: number) => {
      // Two side cannons for the first CANNON_MS.
      if (now < end) {
        confetti({ particleCount: 6, angle: 60, spread: 60, origin: { x: 0, y: 0.75 }, colors, disableForReducedMotion: true })
        confetti({ particleCount: 6, angle: 120, spread: 60, origin: { x: 1, y: 0.75 }, colors, disableForReducedMotion: true })
      }
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
      aria-label={`Big win: ${bigWin.payout} coins`}
      onClick={dismiss}
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-[radial-gradient(circle_at_50%_45%,rgba(120,53,15,0.9)_0%,rgba(7,6,11,0.95)_70%)] px-4 text-center backdrop-blur-sm"
    >
      <span className="animate-pop text-sm font-bold uppercase tracking-[0.4em] text-white/70">{name}</span>
      <h2 className="mt-2 animate-pop bg-gradient-to-b from-yellow-100 via-coin to-amber-600 bg-clip-text text-7xl font-black italic leading-none text-transparent drop-shadow-[0_0_30px_rgba(250,204,21,0.7)]">
        BIG WIN
      </h2>
      <span className="mt-4 animate-pop rounded-full bg-coin/20 px-4 py-1 text-2xl font-black text-coin">{mult}×</span>
      <span className="mt-6 text-6xl font-black tabular-nums text-win drop-shadow-[0_0_20px_rgba(34,197,94,0.6)]">
        +{shown.toLocaleString()}
      </span>
      <span className="mt-1 text-lg text-white/60">coins</span>
      <span className="mt-12 text-sm text-white/50">Tap to continue</span>
    </div>
  )
}
