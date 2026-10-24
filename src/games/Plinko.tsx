import confetti from 'canvas-confetti'
import Matter from 'matter-js'
import { useEffect, useRef, useState } from 'react'
import BetSelector from '../components/BetSelector'
import { useBet } from '../components/useBet'
import { useWallet } from '../wallet/walletStore'

const ROWS = 12
// 13 slots, mirrored. Paths are a fair 50/50 at every row, so this returns ≈ 99% of bets.
const MULTIPLIERS = [10, 3, 1.6, 1.4, 1.1, 1, 0.5, 1, 1.1, 1.4, 1.6, 3, 10]
const MAX_BALLS = 25
const PEG_GLOW_MS = 400
const SLOT_FLASH_MS = 600
const BALL_TIMEOUT_MS = 20000
const STEP_MS = 1000 / 60

// Steering, tuned in a headless simulation (100% of balls land in their planned slot):
const GRAVITY = 0.0018
const KICK = 1 // sideways speed after hitting a peg
const BOUNCE = 0.6 // minimum upward speed after hitting a peg
const AIM = 0.15 // aim this far (in peg spacings) to the planned side of the next peg
const STEER = 0.2 // how strongly velocity is pulled toward the planned path each step

type Peg = { x: number; y: number; row: number; hitAt: number }
type Layout = {
  w: number
  h: number
  s: number // horizontal peg spacing = slot width
  cx: number
  top: number
  rowGap: number
  slotY: number
  slotH: number
  pegR: number
  ballR: number
  pegs: Peg[]
}
type Ball = {
  body: Matter.Body
  bet: number
  droppedAt: number
  dirs: number[] // -1 / +1 per row: the path chosen at drop time
  slot: number // where that path ends; this decides the payout
  nextRow: number
}

function computeLayout(w: number, h: number): Layout {
  const slotH = 30
  const s = Math.min(w / 14, (h - slotH) / 13)
  const cx = w / 2
  const top = s * 1.4
  const rowGap = (h - top - slotH - 10) / ROWS
  const pegs: Peg[] = []
  for (let r = 0; r < ROWS; r++) {
    // Row r has r + 3 pegs, so the bottom row has 14 pegs and 13 gaps (the slots).
    for (let i = 0; i < r + 3; i++) {
      pegs.push({ x: cx + (i - (r + 2) / 2) * s, y: top + r * rowGap, row: r, hitAt: 0 })
    }
  }
  const slotY = top + (ROWS - 1) * rowGap + rowGap * 0.55
  return { w, h, s, cx, top, rowGap, slotY, slotH, pegR: Math.max(2.5, s * 0.12), ballR: s * 0.28, pegs }
}

const slotColor = (i: number, light: number) => {
  const d = Math.abs(i - 6)
  return `hsl(${(50 - d * 12 + 360) % 360} 90% ${light}%)`
}

function draw(ctx: CanvasRenderingContext2D, l: Layout, balls: Ball[], slotFlash: number[], now: number) {
  ctx.clearRect(0, 0, l.w, l.h)

  for (const peg of l.pegs) {
    const glow = Math.max(0, 1 - (now - peg.hitAt) / PEG_GLOW_MS)
    ctx.beginPath()
    ctx.arc(peg.x, peg.y, l.pegR * (1 + glow * 0.8), 0, Math.PI * 2)
    ctx.shadowColor = '#e879f9'
    ctx.shadowBlur = 4 + glow * 18
    ctx.fillStyle = glow > 0 ? `rgba(250,${160 + glow * 80},255,1)` : 'rgba(255,255,255,0.75)'
    ctx.fill()
  }

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `800 ${Math.round(l.s * 0.5)}px system-ui, sans-serif`
  MULTIPLIERS.forEach((m, i) => {
    const flash = Math.max(0, 1 - (now - slotFlash[i]) / SLOT_FLASH_MS)
    const x = l.cx + (i - 6) * l.s
    const sw = l.s - 2
    const lift = flash * 6
    ctx.shadowColor = slotColor(i, 60)
    ctx.shadowBlur = 6 + flash * 24
    ctx.fillStyle = slotColor(i, 45 + flash * 25)
    ctx.beginPath()
    ctx.roundRect(x - sw / 2, l.slotY - lift, sw, l.slotH, 5)
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.fillStyle = '#1a1206'
    ctx.fillText(String(m), x, l.slotY - lift + l.slotH / 2)
  })

  ctx.shadowColor = '#facc15'
  ctx.shadowBlur = 14
  ctx.fillStyle = '#fde047'
  for (const b of balls) {
    ctx.beginPath()
    ctx.arc(b.body.position.x, b.body.position.y, l.ballR, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.shadowBlur = 0
}

export default function Plinko({ isActive }: { isActive: boolean }) {
  const placeBet = useWallet((s) => s.placeBet)
  const payout = useWallet((s) => s.payout)
  const recordRound = useWallet((s) => s.recordRound)
  const { choice, setChoice, amount } = useBet()

  const [recent, setRecent] = useState<{ id: number; mult: number }[]>([])
  const [lastWin, setLastWin] = useState<{ win: number; mult: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // Set while the engine is running; null when the card is inactive.
  const dropRef = useRef<((bet: number) => void) | null>(null)
  const ballCountRef = useRef(0)

  // Callbacks used inside the engine loop; kept in a ref so the loop never sees stale ones.
  const landRef = useRef<(bet: number, slot: number, celebrate: boolean) => void>(() => {})
  landRef.current = (bet, slot, celebrate) => {
    const mult = MULTIPLIERS[slot]
    const win = Math.floor(bet * mult)
    if (win > 0) payout(win)
    recordRound({ game: 'plinko', bet, won: win > bet, payout: win })
    setLastWin({ win, mult })
    setRecent((r) => [{ id: performance.now() + Math.random(), mult }, ...r].slice(0, 6))
    if (celebrate && mult >= 3) {
      confetti({
        particleCount: mult >= 10 ? 160 : 70,
        spread: 70,
        origin: { y: 0.7 },
        colors: ['#facc15', '#22c55e', '#e879f9'],
        disableForReducedMotion: true,
      })
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current!
    const wrap = wrapRef.current!
    const { width, height } = wrap.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    const ctx = canvas.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const layout = computeLayout(width, height)
    const slotFlash = MULTIPLIERS.map(() => 0)

    if (!isActive) {
      // Off-screen: draw a still board (visible during the swipe) and run no engine.
      draw(ctx, layout, [], slotFlash, 0)
      return
    }

    const { Engine, Bodies, Body, Composite, Events } = Matter
    const engine = Engine.create({ gravity: { x: 0, y: 1, scale: GRAVITY } })
    const { s, cx, top, rowGap, slotY } = layout

    const pegBodies = new Map<number, Peg>()
    Composite.add(
      engine.world,
      layout.pegs.map((peg) => {
        const body = Bodies.circle(peg.x, peg.y, layout.pegR, { isStatic: true, restitution: 0.5, friction: 0 })
        pegBodies.set(body.id, peg)
        return body
      }),
    )

    let balls: Ball[] = []
    const removeBall = (ball: Ball) => {
      Composite.remove(engine.world, ball.body)
      balls = balls.filter((b) => b !== ball)
      ballCountRef.current = balls.length
    }

    Events.on(engine, 'collisionStart', (e) => {
      const now = performance.now()
      for (const { bodyA, bodyB } of e.pairs) {
        const peg = pegBodies.get(bodyA.id) ?? pegBodies.get(bodyB.id)
        if (!peg) continue
        peg.hitAt = now
        const ball = balls.find((b) => b.body === bodyA || b.body === bodyB)
        if (ball && peg.row >= ball.nextRow) {
          // First hit on a new row: bounce toward this row's planned side.
          ball.nextRow = peg.row + 1
          Body.setVelocity(ball.body, {
            x: ball.dirs[peg.row] * KICK * (0.85 + Math.random() * 0.3),
            y: Math.min(ball.body.velocity.y, -BOUNCE),
          })
        }
      }
    })

    // Pull a ball's sideways speed toward where its path says it should be at the next row.
    const steer = (ball: Ball) => {
      const { body, dirs, nextRow } = ball
      let targetX: number
      let targetY: number
      if (nextRow < ROWS) {
        const offset = dirs.slice(0, nextRow).reduce((a, d) => a + d, 0) * 0.5
        targetX = cx + (offset + dirs[nextRow] * AIM) * s
        targetY = top + nextRow * rowGap
      } else {
        targetX = cx + (ball.slot - 6) * s
        targetY = slotY
      }
      const steps = Math.max(3, (targetY - body.position.y) / Math.max(body.velocity.y, 1))
      const want = (targetX - body.position.x) / steps
      Body.setVelocity(body, { x: body.velocity.x + (want - body.velocity.x) * STEER, y: body.velocity.y })
    }

    dropRef.current = (bet) => {
      const dirs = Array.from({ length: ROWS }, () => (Math.random() < 0.5 ? -1 : 1))
      const slot = 6 + dirs.reduce((a, d) => a + d, 0) / 2
      // The slight random nudge: start a little off-centre so no two drops look the same.
      const body = Bodies.circle(cx + (Math.random() - 0.5) * s * 0.3, top - rowGap * 0.8, layout.ballR, {
        restitution: 0.45,
        friction: 0,
        frictionAir: 0.01,
        density: 0.002,
        collisionFilter: { group: -1 }, // balls pass through each other
      })
      Composite.add(engine.world, body)
      balls.push({ body, bet, droppedAt: performance.now(), dirs, slot, nextRow: 0 })
      ballCountRef.current = balls.length
    }

    let frame = 0
    let lastTime = performance.now()
    let pending = 0
    const loop = (now: number) => {
      // Fixed 60 Hz physics steps, so the steering behaves the same on 60 Hz and 120 Hz screens.
      pending += Math.min(now - lastTime, 100)
      lastTime = now
      while (pending >= STEP_MS) {
        Engine.update(engine, STEP_MS)
        for (const ball of [...balls]) {
          if (ball.body.position.y > slotY + layout.ballR || now - ball.droppedAt > BALL_TIMEOUT_MS) {
            slotFlash[ball.slot] = now
            removeBall(ball)
            landRef.current(ball.bet, ball.slot, true)
          } else {
            steer(ball)
          }
        }
        pending -= STEP_MS
      }

      draw(ctx, layout, balls, slotFlash, now)
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(frame)
      dropRef.current = null
      // Balls still falling are settled at their planned slot so no bet is left hanging.
      for (const ball of balls) landRef.current(ball.bet, ball.slot, false)
      balls = []
      ballCountRef.current = 0
      Events.off(engine, 'collisionStart')
      Composite.clear(engine.world, false)
      Engine.clear(engine)
      layout.pegs.forEach((p) => (p.hitAt = 0))
      draw(ctx, layout, [], MULTIPLIERS.map(() => 0), 0)
    }
  }, [isActive])

  const drop = () => {
    if (!dropRef.current) return
    if (ballCountRef.current >= MAX_BALLS) {
      setError('Too many balls in play')
      return
    }
    if (!placeBet(amount)) {
      setError('Not enough coins for that bet')
      return
    }
    setError(null)
    dropRef.current(amount)
  }

  return (
    <div className="flex h-dvh w-full flex-col items-center bg-[radial-gradient(circle_at_50%_30%,#2e0b3a_0%,#07060b_65%)] px-4 pb-[calc(max(1rem,env(safe-area-inset-bottom))+2.75rem)] pt-[calc(max(0.75rem,env(safe-area-inset-top))+6.25rem)]">
      <div className="flex h-7 items-center gap-1.5">
        {recent.map((r) => (
          <span
            key={r.id}
            className={`rounded-md px-2 py-0.5 text-xs font-black ${r.mult >= 1 ? 'bg-win/20 text-win' : 'bg-loss/20 text-loss'}`}
          >
            {r.mult}×
          </span>
        ))}
      </div>

      <div ref={wrapRef} className="relative w-full max-w-md flex-1">
        <canvas ref={canvasRef} className="absolute inset-0" />
      </div>

      <div aria-live="polite" className="flex h-10 items-center text-center">
        {error ? (
          <span className="text-lg font-bold text-loss">{error}</span>
        ) : lastWin ? (
          <span className={`text-2xl font-black ${lastWin.mult >= 1 ? 'text-win' : 'text-loss'}`}>
            {lastWin.mult}× → {lastWin.win}
          </span>
        ) : (
          <span className="text-lg text-white/60">Drop as many balls as you like.</span>
        )}
      </div>

      <div className="flex w-full max-w-sm flex-col gap-3">
        <BetSelector value={choice} onChange={setChoice} />
        <button
          type="button"
          onClick={drop}
          className="min-h-16 rounded-2xl bg-coin text-2xl font-black text-black shadow-[0_0_24px_rgba(250,204,21,0.45)] transition active:scale-95"
        >
          Drop for {amount}
        </button>
      </div>
    </div>
  )
}
