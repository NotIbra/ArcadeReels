import confetti from 'canvas-confetti'
import { useEffect, useRef, useState } from 'react'
import BetSelector from '../components/BetSelector'
import { useBet } from '../components/useBet'
import { useWallet } from '../wallet/walletStore'

const NAMES = [
  'Neigh Sayer', 'Hoof Hearted', 'Gallop Poll', 'Mane Event', 'Hay Girl', 'Usain Colt',
  'Unstable', 'Whinny the Pooh', 'Trotsky', 'Pony Express', 'Horsey McHorseface', 'Mare-velous',
  'Furlong Shot', 'Stirrup Trouble', 'Bridle Party', 'Canter Believe It', 'Neighbourhood Watch', 'Mustang Sally',
  'Filly Cheesesteak', 'Rein Man', 'Foal Play', 'Sir Trots-a-Lot', 'Haymaker', 'Pasture Bedtime',
  "Bit O' Luck", 'Thunder Hooves', 'Saddle Up Buttercup', 'Galloping Gourmet', 'Oat Couture', 'Seabiscuit Jr',
]
// Traditional saddlecloth colours for numbers 1–6.
const SADDLE = [
  { bg: '#dc2626', fg: '#ffffff' },
  { bg: '#f8fafc', fg: '#111827' },
  { bg: '#2563eb', fg: '#ffffff' },
  { bg: '#facc15', fg: '#111827' },
  { bg: '#16a34a', fg: '#ffffff' },
  { bg: '#111827', fg: '#facc15' },
]
const RUNNERS = 6
// Odds are the longest standard price that still keeps this margin over a horse's true chance.
// Simulated return: win bets ≈ 91%, each-way ≈ 84%.
const MARGIN = 0.03
const LADDER: [number, number][] = [
  [4, 5], [10, 11], [1, 1], [11, 10], [6, 5], [5, 4], [11, 8], [6, 4], [13, 8], [7, 4], [15, 8], [2, 1], [9, 4],
  [5, 2], [11, 4], [3, 1], [10, 3], [7, 2], [4, 1], [9, 2], [5, 1], [11, 2], [6, 1], [13, 2], [7, 1], [15, 2],
  [8, 1], [9, 1], [10, 1], [11, 1], [12, 1],
]
const WIN_MS = 8000 // the winner crosses the line at 8s
const HORSE_W = 44
const FINISH_INSET = 16
const LIVE_UPDATE_MS = 150

type Horse = { num: number; name: string; p: number; odds: [number, number] }
type Wobble = { a: number; k: number }[]
type Plan = { order: number[]; finishMs: number[]; wobble: Wobble[]; endMs: number }
type Phase = 'pick' | 'racing' | 'result'
type Stake = { pick: number; bet: number; eachWay: boolean }
type Result = { rank: number; payout: number; cost: number }

const oddsValue = ([n, d]: [number, number]) => n / d
const formatOdds = ([n, d]: [number, number]) => (n === d ? 'Evens' : `${n}/${d}`)
const ordinal = (i: number) => ['1st', '2nd', '3rd', '4th', '5th', '6th'][i]

function newRace(): Horse[] {
  const names = [...NAMES].sort(() => Math.random() - 0.5).slice(0, RUNNERS)
  const weights = names.map(() => 1 + Math.random() ** 2 * 6)
  const total = weights.reduce((a, b) => a + b, 0)
  return names.map((name, i) => {
    const p = weights[i] / total
    const maxOdds = 1 / (p * (1 + MARGIN)) - 1
    let odds = LADDER[0]
    for (const step of LADDER) if (oddsValue(step) <= maxOdds) odds = step
    return { num: i + 1, name, p, odds }
  })
}

/** Decide the whole finishing order up front: each place is drawn from the horses left, by chance. */
function planRace(horses: Horse[]): Plan {
  const left = horses.map((_, i) => i)
  const order: number[] = []
  while (left.length) {
    let r = Math.random() * left.reduce((a, i) => a + horses[i].p, 0)
    const k = left.findIndex((i) => (r -= horses[i].p) < 0)
    order.push(left.splice(k === -1 ? left.length - 1 : k, 1)[0])
  }
  const finishMs: number[] = []
  let t = WIN_MS
  order.forEach((horse, rank) => {
    if (rank > 0) t += 80 + Math.random() * 220
    finishMs[horse] = t
  })
  // Each horse's surges: sine waves that are zero at the start and the line, small enough that a
  // horse never goes backwards (Σ a·2πk < 1).
  const limits = [0.05, 0.025, 0.015]
  const wobble = horses.map(() => limits.map((lim, j) => ({ a: (Math.random() * 2 - 1) * lim, k: j + 1 })))
  return { order, finishMs, wobble, endMs: Math.max(...finishMs) + 400 }
}

/** Race progress 0 → 1 (the line) for one horse at `ms`; runs on a little past the line. */
function progress(plan: Plan, horse: number, ms: number) {
  const u = ms / plan.finishMs[horse]
  if (u >= 1) return Math.min(1.04, 1 + (u - 1) * 0.6)
  return u + plan.wobble[horse].reduce((x, w) => x + w.a * Math.sin(2 * Math.PI * w.k * u), 0)
}

export default function HorseRacing({ isActive }: { isActive: boolean }) {
  const placeBet = useWallet((s) => s.placeBet)
  const payout = useWallet((s) => s.payout)
  const recordRound = useWallet((s) => s.recordRound)
  const { choice, setChoice, amount } = useBet()

  const [horses, setHorses] = useState<Horse[]>(newRace)
  const [phase, setPhase] = useState<Phase>('pick')
  const [pick, setPick] = useState<number | null>(null)
  const [eachWay, setEachWay] = useState(false)
  const [live, setLive] = useState<number[]>([])
  const [result, setResult] = useState<Result | null>(null)
  const [winners, setWinners] = useState<{ num: number; name: string }[]>([])
  const [error, setError] = useState<string | null>(null)

  const planRef = useRef<Plan | null>(null)
  const stakeRef = useRef<Stake | null>(null)
  const elapsedRef = useRef(0)
  const laneRef = useRef<HTMLButtonElement>(null)
  const horseRefs = useRef<(HTMLDivElement | null)[]>([])
  const trackRef = useRef<HTMLDivElement>(null)
  const flashRef = useRef<HTMLDivElement>(null)
  const isActiveRef = useRef(isActive)
  isActiveRef.current = isActive

  const placeHorses = (ms: number) => {
    const travel = (laneRef.current?.clientWidth ?? 300) - HORSE_W - FINISH_INSET
    const plan = planRef.current
    horseRefs.current.forEach((el, i) => {
      if (!el) return
      const x = plan ? progress(plan, i, ms) : 0
      // A little bob while galloping.
      const bob = plan && ms > 0 && x < 1 ? Math.sin(ms / 55 + i * 1.7) * 2 : 0
      el.style.transform = `translate(${x * travel}px, ${bob}px)`
    })
  }

  const settle = () => {
    const plan = planRef.current!
    const stake = stakeRef.current!
    const rank = plan.order.indexOf(stake.pick)
    const odds = oddsValue(horses[stake.pick].odds)
    const cost = stake.eachWay ? stake.bet * 2 : stake.bet
    let win = rank === 0 ? stake.bet * (odds + 1) : 0
    // Each way: the place half pays a quarter of the odds for 2nd or 3rd.
    if (stake.eachWay && (rank === 1 || rank === 2)) win += stake.bet * (odds / 4 + 1)
    win = Math.floor(win)
    if (win) payout(win)
    recordRound({ game: 'horse-racing', bet: cost, won: win > cost, payout: win })

    const winner = horses[plan.order[0]]
    setWinners((w) => [{ num: winner.num, name: winner.name }, ...w].slice(0, 5))
    setLive(plan.order)
    setResult({ rank, payout: win, cost })
    setPhase('result')

    if (!isActiveRef.current) return
    flashRef.current?.animate([{ opacity: 0.95 }, { opacity: 0 }], { duration: 700, easing: 'ease-out' })
    if (win > cost) {
      confetti({
        particleCount: rank === 0 ? 150 : 70,
        spread: 80,
        origin: { y: 0.45 },
        colors: ['#facc15', '#22c55e', '#ffffff'],
        disableForReducedMotion: true,
      })
    } else if (win === 0) {
      trackRef.current?.animate(
        [0, -10, 10, -6, 6, -3, 0].map((x) => ({ transform: `translateX(${x}px)` })),
        { duration: 450, easing: 'ease-out' },
      )
    }
  }
  const settleRef = useRef(settle)
  settleRef.current = settle

  // The race clock only runs while racing AND on screen: swiping away freezes it mid-stride.
  useEffect(() => {
    if (phase !== 'racing' || !isActive) {
      placeHorses(phase === 'pick' ? 0 : elapsedRef.current)
      return
    }
    let frame = 0
    let last = performance.now()
    let lastLive = 0
    const tick = (now: number) => {
      elapsedRef.current += Math.min(now - last, 100)
      last = now
      const plan = planRef.current!
      const ms = Math.min(elapsedRef.current, plan.endMs)
      placeHorses(ms)
      if (now - lastLive > LIVE_UPDATE_MS) {
        lastLive = now
        // Horses past the line rank by when they crossed it; the rest by how far along they are.
        const key = (i: number) => (ms >= plan.finishMs[i] ? 10 - plan.finishMs[i] / 1e5 : progress(plan, i, ms))
        setLive(horses.map((_, i) => i).sort((a, b) => key(b) - key(a)))
      }
      if (elapsedRef.current >= plan.endMs) {
        settleRef.current()
        return
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
    // placeHorses only reads refs; horses can't change mid-race.
  }, [phase, isActive, horses])

  const start = () => {
    if (phase !== 'pick' || pick === null) return
    const cost = eachWay ? amount * 2 : amount
    if (!placeBet(cost)) {
      setError(eachWay ? `Each way costs ${cost} (2× your bet)` : 'Not enough coins for that bet')
      return
    }
    setError(null)
    planRef.current = planRace(horses)
    stakeRef.current = { pick, bet: amount, eachWay }
    elapsedRef.current = 0
    setLive(horses.map((_, i) => i))
    setPhase('racing')
  }

  const nextRace = () => {
    planRef.current = null
    stakeRef.current = null
    elapsedRef.current = 0
    setHorses(newRace())
    setPick(null)
    setResult(null)
    setLive([])
    setPhase('pick')
  }

  const racing = phase === 'racing'
  const picked = pick !== null ? horses[pick] : null
  const btn = 'min-h-16 rounded-2xl text-2xl font-black transition active:scale-95 disabled:opacity-40'

  let status: React.ReactNode
  if (phase === 'result' && result && stakeRef.current) {
    const stake = stakeRef.current
    const net = result.payout - result.cost
    status = (
      <span className={`text-xl font-black ${net > 0 ? 'text-win' : net === 0 ? 'text-white' : 'text-loss'}`}>
        #{horses[stake.pick].num} {ordinal(result.rank)} · {net > 0 ? `+${net}` : net < 0 ? `−${-net}` : 'even'}
      </span>
    )
  } else if (racing) {
    status = (
      <span className="flex items-center gap-1">
        {live.map((i, pos) => (
          <Badge key={i} horse={horses[i]} size={pos === 0 ? 'lg' : 'sm'} ring={i === stakeRef.current?.pick} />
        ))}
      </span>
    )
  } else if (error) {
    status = <span className="text-base font-bold text-loss">{error}</span>
  } else if (picked) {
    const odds = oddsValue(picked.odds)
    status = (
      <span className="text-sm text-white/70">
        #{picked.num} to win pays <b className="text-coin">{Math.floor(amount * (odds + 1))}</b>
        {eachWay && (
          <>
            {' '}· place <b className="text-coin">{Math.floor(amount * (odds / 4 + 1))}</b>
          </>
        )}
      </span>
    )
  } else {
    status = <span className="text-base text-white/60">Tap a horse to back it.</span>
  }

  return (
    <div className="flex h-dvh w-full flex-col items-center bg-[radial-gradient(circle_at_50%_35%,#14301a_0%,#07060b_70%)] px-4 pb-[calc(max(1rem,env(safe-area-inset-bottom))+2.75rem)] pt-[calc(max(0.75rem,env(safe-area-inset-top))+6.25rem)]">
      <div className="flex h-7 w-full max-w-sm items-center gap-1.5 overflow-hidden" aria-label="Last 5 winners">
        {winners.length > 0 && <span className="shrink-0 text-xs font-bold uppercase text-white/40">Last</span>}
        {winners.map((w, i) => (
          <span key={winners.length - i} className="flex min-w-0 shrink items-center gap-1 rounded-md bg-white/5 py-0.5 pl-0.5 pr-1.5">
            <Badge horse={{ num: w.num }} size="xs" />
            <span className="truncate text-xs font-semibold text-white/70">{w.name.split(' ')[0]}</span>
          </span>
        ))}
      </div>

      <div ref={trackRef} className="relative mt-1 w-full max-w-sm overflow-hidden rounded-2xl border-2 border-coin/40 shadow-[0_0_24px_rgba(34,197,94,0.2)]">
        {horses.map((horse, i) => {
          const selected = pick === i
          return (
            <button
              key={horse.num}
              ref={i === 0 ? laneRef : undefined}
              type="button"
              disabled={phase !== 'pick'}
              onClick={() => setPick(i)}
              aria-pressed={selected}
              aria-label={`${horse.num} ${horse.name}, ${formatOdds(horse.odds)}`}
              className={`relative block h-12 w-full overflow-hidden border-b border-white/10 text-left last:border-b-0 ${
                selected ? 'bg-neon/20 shadow-[inset_0_0_0_2px_#e879f9]' : i % 2 ? 'bg-[#123322]' : 'bg-[#0f2a1c]'
              }`}
            >
              <span
                className="absolute inset-y-0 w-1 bg-[repeating-linear-gradient(0deg,#fff_0_6px,#111_6px_12px)]"
                style={{ right: FINISH_INSET - 4 }}
              />
              <span
                className={`absolute inset-y-0 left-[52px] right-6 flex items-center justify-between gap-2 transition-opacity duration-300 ${
                  phase === 'pick' ? 'opacity-100' : 'opacity-0'
                }`}
              >
                <span className="truncate text-sm font-bold text-white">{horse.name}</span>
                <span className="shrink-0 text-base font-black tabular-nums text-coin">{formatOdds(horse.odds)}</span>
              </span>
              <div
                ref={(el) => void (horseRefs.current[i] = el)}
                className="absolute left-0 top-1/2 -mt-5 flex h-10 items-center will-change-transform"
                style={{ width: HORSE_W }}
              >
                <span className="text-3xl leading-none" style={{ transform: 'scaleX(-1)' }}>
                  🏇
                </span>
                <span className="absolute -left-0.5 top-0">
                  <Badge horse={horse} size="xs" />
                </span>
              </div>
            </button>
          )
        })}

        <div ref={flashRef} className="pointer-events-none absolute inset-0 bg-white opacity-0" />
      </div>

      <div aria-live="polite" className="flex min-h-10 w-full max-w-sm flex-1 flex-col items-center justify-center gap-2 text-center">
        {phase === 'result' && planRef.current && (
          <div className="w-full animate-pop rounded-xl border border-coin/50 bg-black/60 p-2">
            <div className="mb-1 text-[10px] font-black uppercase tracking-[0.3em] text-coin">Photo finish</div>
            <ol className="grid grid-cols-3 gap-1">
              {planRef.current.order.slice(0, 3).map((i, place) => (
                <li key={i} className="flex min-w-0 flex-col items-center">
                  <span className="text-xs font-bold text-white/60">{ordinal(place)}</span>
                  <Badge horse={horses[i]} size="sm" ring={i === stakeRef.current?.pick} />
                  <span className="w-full truncate text-xs font-semibold text-white">{horses[i].name}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
        {status}
      </div>

      <div className="flex w-full max-w-sm flex-col gap-3">
        {phase === 'result' ? (
          <button type="button" onClick={nextRace} className={`${btn} bg-coin text-black shadow-[0_0_24px_rgba(250,204,21,0.45)]`}>
            Next race
          </button>
        ) : (
          <>
            <button
              type="button"
              role="switch"
              aria-checked={eachWay}
              disabled={racing}
              onClick={() => setEachWay((v) => !v)}
              className="flex min-h-12 items-center justify-between rounded-xl border border-white/15 bg-white/5 px-4 disabled:opacity-50"
            >
              <span className="text-left">
                <span className="block text-sm font-bold text-white">Each way</span>
                <span className="block text-xs text-white/50">Costs 2× · ¼ odds for 2nd or 3rd</span>
              </span>
              <span className={`relative h-7 w-12 rounded-full transition-colors ${eachWay ? 'bg-neon' : 'bg-white/20'}`}>
                <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${eachWay ? 'left-6' : 'left-1'}`} />
              </span>
            </button>
            <BetSelector value={choice} onChange={setChoice} disabled={racing} />
            <button
              type="button"
              onClick={start}
              disabled={racing || pick === null}
              className={`${btn} bg-coin text-black shadow-[0_0_24px_rgba(250,204,21,0.45)]`}
            >
              {racing ? 'Racing…' : pick === null ? 'Pick a horse' : "And they're off!"}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function Badge({ horse, size, ring = false }: { horse: { num: number }; size: 'xs' | 'sm' | 'lg'; ring?: boolean }) {
  const { bg, fg } = SADDLE[horse.num - 1]
  const dims = size === 'xs' ? 'h-4 w-4 text-[10px]' : size === 'sm' ? 'h-6 w-6 text-xs' : 'h-8 w-8 text-sm'
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-md font-black ${dims} ${ring ? 'ring-2 ring-neon ring-offset-1 ring-offset-black' : ''}`}
      style={{ background: bg, color: fg }}
    >
      {horse.num}
    </span>
  )
}
