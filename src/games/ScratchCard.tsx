import confetti from 'canvas-confetti'
import { useEffect, useRef, useState } from 'react'
import BetSelector from '../components/BetSelector'
import { useBet } from '../components/useBet'
import { useWallet } from '../wallet/walletStore'

type SymbolDef = { icon: string; mult: number; chance: number }

// Chance of a card being a winner for each symbol. Total ≈ 27% win rate, ≈ 88% return.
const SYMBOLS: SymbolDef[] = [
  { icon: '🍒', mult: 2, chance: 0.15 },
  { icon: '🍋', mult: 3, chance: 0.07 },
  { icon: '🔔', mult: 5, chance: 0.03 },
  { icon: '💎', mult: 10, chance: 0.012 },
  { icon: '7️⃣', mult: 25, chance: 0.004 },
]
const BRUSH = 38
const REVEAL_AT = 0.55
const AUTO_REVEAL_MS = 600

type Phase = 'idle' | 'scratching' | 'done'
type Card = { cells: string[]; winner: SymbolDef | null }

function generateCard(): Card {
  let roll = Math.random()
  const winner = SYMBOLS.find((s) => (roll -= s.chance) < 0) ?? null
  const cells: string[] = winner ? [winner.icon, winner.icon, winner.icon] : []
  const counts = new Map<string, number>(winner ? [[winner.icon, 3]] : [])
  // Fill the rest so no other symbol appears 3 times.
  while (cells.length < 9) {
    const options = SYMBOLS.filter((s) => s !== winner && (counts.get(s.icon) ?? 0) < 2)
    const pick = options[Math.floor(Math.random() * options.length)].icon
    counts.set(pick, (counts.get(pick) ?? 0) + 1)
    cells.push(pick)
  }
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[cells[i], cells[j]] = [cells[j], cells[i]]
  }
  return { cells, winner }
}

function drawCover(canvas: HTMLCanvasElement) {
  const dpr = window.devicePixelRatio || 1
  const { width, height } = canvas.getBoundingClientRect()
  canvas.width = Math.round(width * dpr)
  canvas.height = Math.round(height * dpr)
  const ctx = canvas.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.globalCompositeOperation = 'source-over'

  const grad = ctx.createLinearGradient(0, 0, width, height)
  grad.addColorStop(0, '#9ca3af')
  grad.addColorStop(0.45, '#f3f4f6')
  grad.addColorStop(0.55, '#d1d5db')
  grad.addColorStop(1, '#6b7280')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, width, height)

  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  for (let i = 0; i < 160; i++) {
    ctx.fillRect(Math.random() * width, Math.random() * height, 2, 2)
  }
  ctx.fillStyle = 'rgba(55,65,81,0.75)'
  ctx.font = '900 26px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('SCRATCH HERE', width / 2, height / 2)
}

/** Fraction of the cover that has been scratched away (sampled for speed). */
function clearedFraction(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')!
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
  let clear = 0
  let total = 0
  for (let i = 3; i < data.length; i += 4 * 24) {
    total++
    if (data[i] === 0) clear++
  }
  return total ? clear / total : 0
}

export default function ScratchCard({ isActive }: { isActive: boolean }) {
  const placeBet = useWallet((s) => s.placeBet)
  const payout = useWallet((s) => s.payout)
  const recordRound = useWallet((s) => s.recordRound)
  const { choice, setChoice, amount } = useBet()

  const [phase, setPhase] = useState<Phase>('idle')
  const [card, setCard] = useState<Card | null>(null)
  const [bet, setBet] = useState(0)
  const [coverGone, setCoverGone] = useState(false)
  const [autoRevealing, setAutoRevealing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const isActiveRef = useRef(isActive)
  isActiveRef.current = isActive

  const finish = () => {
    if (phaseRef.current !== 'scratching' || !card) return
    phaseRef.current = 'done'
    setPhase('done')
    setCoverGone(true)
    setAutoRevealing(false)

    const win = card.winner ? bet * card.winner.mult : 0
    if (win) payout(win)
    recordRound({ game: 'scratch-card', bet, won: win > 0, payout: win })

    if (!isActiveRef.current) return
    if (win) {
      confetti({
        particleCount: 140,
        spread: 80,
        origin: { y: 0.45 },
        colors: ['#facc15', '#22c55e', '#ffffff'],
        disableForReducedMotion: true,
      })
    } else {
      boardRef.current?.animate(
        [0, -12, 12, -8, 8, -4, 0].map((x) => ({ transform: `translateX(${x}px)` })),
        { duration: 450, easing: 'ease-out' },
      )
    }
  }
  // Native listeners below are bound once, so they call the latest finish() through a ref.
  const finishRef = useRef(finish)
  finishRef.current = finish

  useEffect(() => {
    const canvas = canvasRef.current!
    drawCover(canvas)
    const ctx = canvas.getContext('2d')!
    let last: { x: number; y: number } | null = null
    let moves = 0

    const pos = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect()
      return { x: e.clientX - r.left, y: e.clientY - r.top }
    }
    const scratch = (from: { x: number; y: number }, to: { x: number; y: number }) => {
      ctx.globalCompositeOperation = 'destination-out'
      ctx.lineWidth = BRUSH
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      ctx.moveTo(from.x, from.y)
      ctx.lineTo(to.x, to.y)
      ctx.stroke()
    }
    const checkProgress = () => {
      if (clearedFraction(canvas) >= REVEAL_AT) finishRef.current()
    }

    // Native (not React) listeners so propagation stops before Swiper's own listeners see the event.
    const onDown = (e: PointerEvent) => {
      e.stopPropagation()
      if (phaseRef.current !== 'scratching') return
      canvas.setPointerCapture(e.pointerId)
      last = pos(e)
      scratch(last, last)
    }
    const onMove = (e: PointerEvent) => {
      e.stopPropagation()
      if (!last) return
      const p = pos(e)
      scratch(last, p)
      last = p
      if (++moves % 20 === 0) checkProgress()
    }
    const onUp = (e: PointerEvent) => {
      e.stopPropagation()
      if (!last) return
      last = null
      checkProgress()
    }
    const stopTouch = (e: TouchEvent) => {
      e.stopPropagation()
      if (e.cancelable) e.preventDefault()
    }

    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onUp)
    canvas.addEventListener('touchstart', stopTouch, { passive: false })
    canvas.addEventListener('touchmove', stopTouch, { passive: false })
    return () => {
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onUp)
      canvas.removeEventListener('touchstart', stopTouch)
      canvas.removeEventListener('touchmove', stopTouch)
    }
  }, [])

  const buy = () => {
    if (phase === 'scratching') return
    if (!placeBet(amount)) {
      setError('Not enough coins for that bet')
      return
    }
    setError(null)
    drawCover(canvasRef.current!)
    setCard(generateCard())
    setBet(amount)
    setCoverGone(false)
    setPhase('scratching')
  }

  const autoReveal = () => {
    if (phase !== 'scratching' || autoRevealing) return
    setAutoRevealing(true)
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const start = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / AUTO_REVEAL_MS)
      ctx.save()
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width * t, canvas.height)
      ctx.restore()
      if (t < 1) requestAnimationFrame(step)
      else finishRef.current()
    }
    requestAnimationFrame(step)
  }

  const winIcon = phase === 'done' ? card?.winner?.icon : undefined
  const btn = 'min-h-16 rounded-2xl text-2xl font-black transition active:scale-95 disabled:opacity-50'

  return (
    <div className="flex h-dvh w-full flex-col items-center justify-between bg-[radial-gradient(circle_at_50%_35%,#1e1b4b_0%,#07060b_65%)] px-4 pb-[calc(max(1rem,env(safe-area-inset-bottom))+2.75rem)] pt-[calc(max(0.75rem,env(safe-area-inset-top))+6.5rem)]">
      <div className="flex w-full flex-1 flex-col items-center justify-center gap-3">
        <div
          ref={boardRef}
          className="relative aspect-square w-full max-w-[290px] rounded-2xl border-4 border-coin/70 bg-casino-card p-2 shadow-[0_0_28px_rgba(250,204,21,0.25)]"
        >
          <div className="grid h-full grid-cols-3 gap-2">
            {Array.from({ length: 9 }, (_, i) => {
              const icon = card?.cells[i]
              const winning = icon !== undefined && icon === winIcon
              return (
                <div
                  key={i}
                  className={`flex items-center justify-center rounded-xl text-5xl ${
                    winning
                      ? `bg-coin/25 ring-4 ring-coin ${isActive ? 'animate-pulse' : ''}`
                      : 'bg-white/5'
                  }`}
                >
                  {icon}
                </div>
              )
            })}
          </div>
          <canvas
            ref={canvasRef}
            aria-label="Scratch-off layer"
            className={`swiper-no-swiping absolute inset-0 h-full w-full touch-none rounded-xl ${
              coverGone ? 'pointer-events-none opacity-0 transition-opacity duration-300' : 'opacity-100'
            }`}
          />
        </div>

        <div className="flex gap-3 text-xs text-white/60">
          {SYMBOLS.map((s) => (
            <span key={s.icon} className="flex items-center gap-0.5">
              <span className="text-base">{s.icon}</span>
              {s.mult}×
            </span>
          ))}
        </div>

        <div aria-live="polite" className="h-10 text-center">
          {phase === 'done' ? (
            card?.winner ? (
              <span className="text-3xl font-black text-win">+{bet * card.winner.mult}</span>
            ) : (
              <span className="text-3xl font-black text-loss">No match −{bet}</span>
            )
          ) : phase === 'scratching' ? (
            <span className="text-lg text-white/70">Scratch to reveal. Match 3 to win.</span>
          ) : error ? (
            <span className="text-lg font-bold text-loss">{error}</span>
          ) : (
            <span className="text-lg text-white/60">Match 3 symbols to win.</span>
          )}
        </div>
      </div>

      <div className="flex w-full max-w-sm flex-col gap-3">
        {phase === 'scratching' ? (
          <button
            type="button"
            onClick={autoReveal}
            disabled={autoRevealing}
            className={`${btn} border-2 border-coin text-coin`}
          >
            Auto-reveal
          </button>
        ) : (
          <>
            <BetSelector value={choice} onChange={setChoice} />
            <button
              type="button"
              onClick={buy}
              className={`${btn} bg-coin text-black shadow-[0_0_24px_rgba(250,204,21,0.45)]`}
            >
              {phase === 'done' ? `Buy another for ${amount}` : `Buy card for ${amount}`}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
