import confetti from 'canvas-confetti'
import { useEffect, useRef, useState } from 'react'
import BetSelector from '../components/BetSelector'
import { useBet } from '../components/useBet'
import { useWallet } from '../wallet/walletStore'

const SYMBOLS = ['🍒', '🍋', '🔔', '⭐', '7️⃣', '💎']
const SEVEN = '7️⃣'
// Outcome odds. Return to player = 0.006×20 + 0.035×10 + 0.24×2 = 95%.
const P_SEVENS = 0.006
const P_TRIPLE = 0.035
const P_PAIR = 0.24
const CELL = 76
const BASE_SPIN_MS = 1000
const STAGGER_MS = 400

type Outcome = { mult: number; match: string | null }

const randomSymbol = () => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]

function pickDistinct(n: number, exclude: string[] = []) {
  const pool = SYMBOLS.filter((s) => !exclude.includes(s))
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, n)
}

/** Decide the result first, then lay out the three symbols to match it. */
function spinResult(): string[] {
  let roll = Math.random()
  if ((roll -= P_SEVENS) < 0) return [SEVEN, SEVEN, SEVEN]
  if ((roll -= P_TRIPLE) < 0) {
    const [s] = pickDistinct(1, [SEVEN])
    return [s, s, s]
  }
  if ((roll -= P_PAIR) < 0) {
    const [pair, odd] = pickDistinct(2)
    const result = [pair, pair, pair]
    result[Math.floor(Math.random() * 3)] = odd
    return result
  }
  return pickDistinct(3)
}

function evaluate(result: string[]): Outcome {
  const [a, b, c] = result
  if (a === b && b === c) return { mult: a === SEVEN ? 20 : 10, match: a }
  if (a === b || a === c) return { mult: 2, match: a }
  if (b === c) return { mult: 2, match: b }
  return { mult: 0, match: null }
}

// Each strip shows 3 rows; the middle row (index 1) is the payline.
const idleStrip = (middle: string) => [randomSymbol(), middle, randomSymbol()]

export default function Slots({ isActive }: { isActive: boolean }) {
  const placeBet = useWallet((s) => s.placeBet)
  const payout = useWallet((s) => s.payout)
  const recordRound = useWallet((s) => s.recordRound)
  const { choice, setChoice, amount } = useBet()

  const [strips, setStrips] = useState(() => [idleStrip('🍒'), idleStrip('7️⃣'), idleStrip('💎')])
  const [result, setResult] = useState<string[]>(['🍒', '7️⃣', '💎'])
  const [spinId, setSpinId] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [last, setLast] = useState<{ bet: number; outcome: Outcome } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const stripRefs = useRef<(HTMLDivElement | null)[]>([])
  const machineRef = useRef<HTMLDivElement>(null)
  const animsRef = useRef<Animation[]>([])
  const betRef = useRef(0)
  const isActiveRef = useRef(isActive)
  isActiveRef.current = isActive

  // Swiped away mid-spin: jump the reels to the end so the round settles straight away.
  useEffect(() => {
    if (!isActive) animsRef.current.forEach((a) => a.finish())
  }, [isActive])

  // Runs after the new strips render: animate each one from its old symbols down to the new ones.
  useEffect(() => {
    if (spinId === 0) return
    const anims = stripRefs.current.map((el, i) => {
      const from = -(strips[i].length - 3) * CELL
      return el!.animate(
        [
          { transform: `translateY(${from}px)`, easing: 'cubic-bezier(0.15, 0.6, 0.35, 1)' },
          { transform: 'translateY(14px)', offset: 0.9, easing: 'ease-in-out' },
          { transform: 'translateY(0)' },
        ],
        { duration: BASE_SPIN_MS + i * STAGGER_MS },
      )
    })
    animsRef.current = anims
    if (!isActiveRef.current) anims.forEach((a) => a.finish())

    let cancelled = false
    Promise.all(anims.map((a) => a.finished)).then(() => {
      if (cancelled) return
      const outcome = evaluate(result)
      const bet = betRef.current
      const win = bet * outcome.mult
      if (win) payout(win)
      recordRound({ game: 'slots', bet, won: win > 0, payout: win })
      setLast({ bet, outcome })
      setSpinning(false)
      // Keep only the 3 visible rows (the strip is at translateY(0), so this changes nothing on screen).
      setStrips((s) => s.map((strip) => strip.slice(0, 3)))

      if (!isActiveRef.current) return
      if (win) {
        confetti({
          particleCount: outcome.mult >= 10 ? 160 : 80,
          spread: 75,
          origin: { y: 0.4 },
          colors: ['#facc15', '#22c55e', '#ffffff'],
          disableForReducedMotion: true,
        })
      } else {
        machineRef.current?.animate(
          [0, -12, 12, -8, 8, -4, 0].map((x) => ({ transform: `translateX(${x}px)` })),
          { duration: 450, easing: 'ease-out' },
        )
      }
    })
    return () => {
      cancelled = true
    }
    // Only start a spin when spinId changes; strips/result are set in the same update.
  }, [spinId])

  const spin = () => {
    if (spinning) return
    if (!placeBet(amount)) {
      setError('Not enough coins for that bet')
      return
    }
    setError(null)
    setLast(null)
    betRef.current = amount
    const next = spinResult()
    // New symbols on top, old ones at the bottom; the strip slides down to reveal the new ones.
    setStrips((old) =>
      old.map((strip, i) => [
        ...idleStrip(next[i]),
        ...Array.from({ length: 14 + i * 6 }, randomSymbol),
        ...strip.slice(0, 3),
      ]),
    )
    setResult(next)
    setSpinning(true)
    setSpinId((n) => n + 1)
  }

  const winSymbol = !spinning && last ? last.outcome.match : null

  return (
    <div className="flex h-dvh w-full flex-col items-center justify-between bg-[radial-gradient(circle_at_50%_35%,#3b0a1e_0%,#07060b_65%)] px-4 pb-[calc(max(1rem,env(safe-area-inset-bottom))+2.75rem)] pt-[calc(max(0.75rem,env(safe-area-inset-top))+6.5rem)]">
      <div className="flex w-full flex-1 flex-col items-center justify-center gap-4">
        <div
          ref={machineRef}
          className="relative w-full max-w-[300px] rounded-3xl border-4 border-coin/70 bg-casino-card p-3 shadow-[0_0_32px_rgba(250,204,21,0.3)]"
        >
          <div className="grid grid-cols-3 gap-2">
            {strips.map((strip, i) => (
              <div
                key={i}
                className="relative overflow-hidden rounded-xl bg-gradient-to-b from-zinc-200 via-white to-zinc-200"
                style={{ height: CELL * 3 }}
              >
                <div ref={(el) => void (stripRefs.current[i] = el)} className="flex flex-col">
                  {strip.map((sym, j) => {
                    const onLine = j === 1 && strip.length === 3
                    const hit = onLine && winSymbol !== null && sym === winSymbol
                    return (
                      <div
                        key={j}
                        className={`flex shrink-0 items-center justify-center text-5xl ${
                          hit ? `rounded-lg bg-coin/40 ${isActive ? 'animate-pulse' : ''}` : ''
                        }`}
                        style={{ height: CELL }}
                      >
                        {sym}
                      </div>
                    )
                  })}
                </div>
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.45),transparent_30%,transparent_70%,rgba(0,0,0,0.45))]" />
              </div>
            ))}
          </div>
          <div
            className="pointer-events-none absolute inset-x-1 h-0.5 -translate-y-1/2 bg-loss/80 shadow-[0_0_8px_#ef4444]"
            style={{ top: 12 + CELL * 1.5 }}
          />
        </div>

        <div className="grid w-full max-w-[300px] grid-cols-3 gap-2 text-center text-xs text-white/70">
          <div className="rounded-lg bg-white/5 py-1.5">
            <div className="text-base">7️⃣7️⃣7️⃣</div>
            <div className="font-black text-coin">20×</div>
          </div>
          <div className="rounded-lg bg-white/5 py-1.5">
            <div className="text-base">Any 3</div>
            <div className="font-black text-coin">10×</div>
          </div>
          <div className="rounded-lg bg-white/5 py-1.5">
            <div className="text-base">Any 2</div>
            <div className="font-black text-coin">2×</div>
          </div>
        </div>

        <div aria-live="polite" className="h-10 text-center">
          {spinning ? (
            <span className="text-xl font-bold text-white/60">Spinning…</span>
          ) : last ? (
            last.outcome.mult ? (
              <span className="text-3xl font-black text-win">
                {last.outcome.mult}× → +{last.bet * last.outcome.mult}
              </span>
            ) : (
              <span className="text-3xl font-black text-loss">−{last.bet}</span>
            )
          ) : error ? (
            <span className="text-lg font-bold text-loss">{error}</span>
          ) : (
            <span className="text-lg text-white/60">Line up 2 or 3 to win.</span>
          )}
        </div>
      </div>

      <div className="flex w-full max-w-sm flex-col gap-3">
        <BetSelector value={choice} onChange={setChoice} disabled={spinning} />
        <button
          type="button"
          onClick={spin}
          disabled={spinning}
          className="min-h-16 rounded-2xl bg-coin text-2xl font-black text-black shadow-[0_0_24px_rgba(250,204,21,0.45)] transition active:scale-95 disabled:opacity-50"
        >
          {spinning ? '…' : `Spin for ${amount}`}
        </button>
      </div>
    </div>
  )
}
