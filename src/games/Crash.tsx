import confetti from 'canvas-confetti'
import { useEffect, useRef, useState } from 'react'
import BetSelector from '../components/BetSelector'
import { useBet } from '../components/useBet'
import { useWallet } from '../wallet/walletStore'

// Multiplier = e^(GROWTH × ms): 2× after ~4.6s, 10× after ~15s, 100× after ~31s.
const GROWTH = 0.00015
const MAX_CRASH = 100
const MIN_VIEW_MS = 8000

type Phase = 'idle' | 'running' | 'crashed'

/** House-edge crash point: 0.99 / random(), floored to 2 decimals, between 1.00× and 100×. */
function rollCrashPoint() {
  const raw = 0.99 / Math.random()
  return Math.min(MAX_CRASH, Math.max(1, Math.floor(raw * 100) / 100))
}

const multAt = (ms: number) => Math.exp(GROWTH * ms)

const chipClass = (x: number) =>
  x >= 10 ? 'bg-coin/20 text-coin' : x >= 2 ? 'bg-win/20 text-win' : 'bg-loss/20 text-loss'

function draw(
  canvas: HTMLCanvasElement,
  elapsed: number,
  mult: number,
  phase: Phase,
  cashedAt: number | null,
) {
  const dpr = window.devicePixelRatio || 1
  const { width: w, height: h } = canvas.getBoundingClientRect()
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
  }
  const ctx = canvas.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)

  const pad = 14
  const tMax = Math.max(elapsed, MIN_VIEW_MS)
  const mMax = Math.max(mult * 1.15, 2)
  const X = (t: number) => pad + (t / tMax) * (w - pad * 2)
  const Y = (m: number) => h - pad - ((m - 1) / (mMax - 1)) * (h - pad * 2)

  ctx.font = '600 11px system-ui, sans-serif'
  ctx.textBaseline = 'bottom'
  for (let i = 0; i <= 3; i++) {
    const m = 1 + ((mMax - 1) * i) / 3
    const y = Y(m)
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'
    ctx.beginPath()
    ctx.moveTo(pad, y)
    ctx.lineTo(w - pad, y)
    ctx.stroke()
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    ctx.fillText(`${m.toFixed(1)}×`, pad + 2, y - 2)
  }

  if (cashedAt !== null) {
    const y = Y(cashedAt)
    ctx.setLineDash([6, 6])
    ctx.strokeStyle = 'rgba(34,197,94,0.8)'
    ctx.beginPath()
    ctx.moveTo(pad, y)
    ctx.lineTo(w - pad, y)
    ctx.stroke()
    ctx.setLineDash([])
  }

  if (elapsed <= 0) return

  const color = phase === 'crashed' ? '#ef4444' : '#facc15'
  const steps = 80
  ctx.beginPath()
  for (let i = 0; i <= steps; i++) {
    const t = (elapsed * i) / steps
    const x = X(t)
    const y = Y(Math.min(multAt(t), mult))
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  const headX = X(elapsed)
  const headY = Y(mult)

  ctx.save()
  ctx.lineTo(headX, h - pad)
  ctx.lineTo(X(0), h - pad)
  ctx.closePath()
  const fill = ctx.createLinearGradient(0, headY, 0, h - pad)
  fill.addColorStop(0, phase === 'crashed' ? 'rgba(239,68,68,0.35)' : 'rgba(250,204,21,0.35)')
  fill.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = fill
  ctx.fill()
  ctx.restore()

  ctx.beginPath()
  for (let i = 0; i <= steps; i++) {
    const t = (elapsed * i) / steps
    const x = X(t)
    const y = Y(Math.min(multAt(t), mult))
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.strokeStyle = color
  ctx.lineWidth = 4
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.shadowColor = color
  ctx.shadowBlur = 14
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(headX, headY, 7, 0, Math.PI * 2)
  ctx.fillStyle = phase === 'crashed' ? '#ef4444' : '#fff'
  ctx.fill()
  ctx.shadowBlur = 0
  ctx.lineWidth = 1
}

export default function Crash({ isActive }: { isActive: boolean }) {
  const placeBet = useWallet((s) => s.placeBet)
  const payout = useWallet((s) => s.payout)
  const recordRound = useWallet((s) => s.recordRound)
  const { choice, setChoice, amount } = useBet()

  const [phase, setPhase] = useState<Phase>('idle')
  const [bet, setBet] = useState(0)
  const [cashedAt, setCashedAt] = useState<number | null>(null)
  const [crashPoint, setCrashPoint] = useState(1)
  const [history, setHistory] = useState<number[]>([])
  const [autoInput, setAutoInput] = useState('')
  const [error, setError] = useState<string | null>(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const multTextRef = useRef<HTMLSpanElement>(null)
  // Live round values read every frame; mirrored from state so the loop never sees stale ones.
  const elapsedRef = useRef(0)
  const multRef = useRef(1)
  const crashRef = useRef(1)
  const cashedRef = useRef<number | null>(null)
  const betRef = useRef(0)
  const isActiveRef = useRef(isActive)
  isActiveRef.current = isActive

  const autoValue = parseFloat(autoInput)
  const autoCashOut = Number.isFinite(autoValue) && autoValue >= 1.01 ? autoValue : null
  const autoRef = useRef(autoCashOut)
  autoRef.current = autoCashOut

  const paintText = (m: number) => {
    if (multTextRef.current) multTextRef.current.textContent = `${m.toFixed(2)}×`
  }

  const cashOut = (at: number) => {
    // `at < crash` also blocks a tap that lands in the frame where the round has just crashed.
    if (cashedRef.current !== null || at >= crashRef.current) return
    cashedRef.current = at
    const win = Math.floor(betRef.current * at)
    payout(win)
    recordRound({ game: 'crash', bet: betRef.current, won: win > betRef.current, payout: win })
    setCashedAt(at)
    if (isActiveRef.current) {
      confetti({
        particleCount: at >= 10 ? 160 : 80,
        spread: 75,
        origin: { y: 0.4 },
        colors: ['#facc15', '#22c55e', '#ffffff'],
        disableForReducedMotion: true,
      })
    }
  }
  const cashOutRef = useRef(cashOut)
  cashOutRef.current = cashOut

  // Game loop: only runs while a round is live AND the card is on screen. Swiping away freezes the
  // round exactly where it is; coming back resumes it.
  useEffect(() => {
    const canvas = canvasRef.current!
    if (phase !== 'running' || !isActive) {
      draw(canvas, elapsedRef.current, multRef.current, phase, cashedRef.current)
      paintText(multRef.current)
      return
    }

    let frame = 0
    let last = performance.now()
    const tick = (now: number) => {
      elapsedRef.current += Math.min(now - last, 100)
      last = now
      const crash = crashRef.current
      let m = multAt(elapsedRef.current)

      const auto = autoRef.current
      if (cashedRef.current === null && auto !== null && m >= auto && auto < crash) cashOutRef.current(auto)

      if (m >= crash) {
        m = crash
        multRef.current = m
        if (cashedRef.current === null) {
          recordRound({ game: 'crash', bet: betRef.current, won: false, payout: 0 })
          boardRef.current?.animate(
            [0, -12, 12, -8, 8, -4, 0].map((x) => ({ transform: `translateX(${x}px)` })),
            { duration: 450, easing: 'ease-out' },
          )
        }
        setHistory((hist) => [crash, ...hist].slice(0, 10))
        setPhase('crashed')
        return // the effect re-runs for the new phase and draws the final frame
      }

      multRef.current = m
      draw(canvas, elapsedRef.current, m, 'running', cashedRef.current)
      paintText(m)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [phase, isActive, recordRound])

  const start = () => {
    if (phase === 'running') return
    if (!placeBet(amount)) {
      setError('Not enough coins for that bet')
      return
    }
    setError(null)
    const crash = rollCrashPoint()
    elapsedRef.current = 0
    multRef.current = 1
    crashRef.current = crash
    cashedRef.current = null
    betRef.current = amount
    setBet(amount)
    setCrashPoint(crash)
    setCashedAt(null)
    setPhase('running')
  }

  const running = phase === 'running'
  const btn = 'min-h-16 rounded-2xl text-2xl font-black transition active:scale-95 disabled:opacity-50'

  let status: React.ReactNode
  if (phase === 'crashed') {
    status = cashedAt ? (
      <span className="text-2xl font-black text-win">
        Cashed {cashedAt.toFixed(2)}× → +{Math.floor(bet * cashedAt)}
      </span>
    ) : (
      <span className="text-2xl font-black text-loss">Crashed at {crashPoint.toFixed(2)}× · −{bet}</span>
    )
  } else if (running && cashedAt) {
    status = <span className="text-2xl font-black text-win">+{Math.floor(bet * cashedAt)} banked</span>
  } else if (running) {
    status = <span className="text-lg text-white/70">Cash out before it crashes!</span>
  } else if (error) {
    status = <span className="text-lg font-bold text-loss">{error}</span>
  } else {
    status = <span className="text-lg text-white/60">Ride the multiplier. Don't get greedy.</span>
  }

  return (
    <div className="flex h-dvh w-full flex-col items-center bg-[radial-gradient(circle_at_50%_35%,#0c1f3a_0%,#07060b_65%)] px-4 pb-[calc(max(1rem,env(safe-area-inset-bottom))+2.75rem)] pt-[calc(max(0.75rem,env(safe-area-inset-top))+6.25rem)]">
      <div className="flex h-7 w-full max-w-sm items-center gap-1.5 overflow-hidden" aria-label="Last crash points">
        {history.map((x, i) => (
          <span key={history.length - i} className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-black ${chipClass(x)}`}>
            {x.toFixed(2)}×
          </span>
        ))}
      </div>

      <div
        ref={boardRef}
        className="relative my-2 w-full max-w-sm flex-1 overflow-hidden rounded-2xl border border-white/10 bg-casino-card"
      >
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span
            ref={multTextRef}
            className={`text-6xl font-black tabular-nums drop-shadow-[0_0_16px_rgba(0,0,0,0.8)] ${
              phase === 'crashed' ? 'text-loss' : cashedAt ? 'text-win' : 'text-white'
            }`}
          />
          {phase === 'crashed' && <span className="mt-1 text-lg font-black uppercase tracking-widest text-loss">Crashed</span>}
        </div>
      </div>

      <div aria-live="polite" className="flex h-10 items-center text-center">
        {status}
      </div>

      <div className="flex w-full max-w-sm flex-col gap-3">
        <label className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-white/15 bg-white/5 px-4">
          <span className="text-sm font-semibold text-white/70">Auto cash-out</span>
          <span className="flex items-center gap-1">
            <input
              type="number"
              inputMode="decimal"
              min="1.01"
              step="0.01"
              placeholder="off"
              value={autoInput}
              disabled={running}
              onChange={(e) => setAutoInput(e.target.value)}
              className="h-10 w-20 rounded-lg bg-black/40 text-center text-lg font-bold text-coin outline-none placeholder:text-white/30 focus:ring-2 focus:ring-coin disabled:opacity-50"
            />
            <span className="font-bold text-white/60">×</span>
          </span>
        </label>

        {running ? (
          <button
            type="button"
            onClick={() => cashOut(multRef.current)}
            disabled={cashedAt !== null}
            className={`${btn} bg-win text-black shadow-[0_0_24px_rgba(34,197,94,0.45)]`}
          >
            {cashedAt !== null ? 'Waiting for crash…' : 'Cash out'}
          </button>
        ) : (
          <>
            <BetSelector value={choice} onChange={setChoice} />
            <button
              type="button"
              onClick={start}
              className={`${btn} bg-coin text-black shadow-[0_0_24px_rgba(250,204,21,0.45)]`}
            >
              Start for {amount}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
